/**
 * 内容脚本（单文件，无 ES import）
 * 逐步翻译：先译视口内 + 视口下方 20% 预加载区，滚动后再译新进入区域的内容
 */
(function () {
  "use strict";

  const MSG = {
    GET_SETTINGS: "GET_SETTINGS",
    TRANSLATE_BATCH: "TRANSLATE_BATCH",
  };

  const BANNER_ID = "deepseek-translator-banner";
  /** 不翻译这些标签及其子树（含 pre/code 内 hljs 拆分的 span） */
  const SKIP_SELECTOR =
    "script,style,noscript,iframe,svg,code,pre,textarea,input,select,option";

  /** 文本节点是否位于应跳过的容器内（如 pre/code，不仅看直接父元素） */
  function isInsideSkipContainer(node) {
    var parent = node && node.parentElement;
    return !!(parent && parent.closest(SKIP_SELECTOR));
  }
  const ATTR_TRANSLATED = "data-ds-translated";
  const ATTR_ORIGINAL = "data-ds-original";
  const ATTR_TRANSLATING = "data-ds-translating";

  /** 视口下方预加载区域 = 视口高度的 20% */
  const VIEWPORT_PRELOAD_RATIO = 0.2;
  /** 每批 API 请求段数 */
  const CHUNK_SIZE = 15;
  /** 滚动触发防抖（毫秒） */
  const SCROLL_DEBOUNCE_MS = 120;

  let isTranslating = false;

  /** 逐步翻译会话状态 */
  var lazySession = {
    active: false,
    banner: null,
    observer: null,
    mutationObserver: null,
    scrollTimer: null,
    registry: [],
    totalEnglishNodes: 0,
    translatedCount: 0,
  };

  function sanitizeTranslation(text) {
    if (!text || typeof text !== "string") return text || "";
    return text
      .replace(/<<<SEG>>>/gi, "")
      .replace(/&lt;&lt;&lt;SEG&gt;&gt;&gt;/gi, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  /** 翻译区域下边界（相对视口，px）：innerHeight * 1.2 */
  function getZoneBottomPx() {
    return window.innerHeight * (1 + VIEWPORT_PRELOAD_RATIO);
  }

  /**
   * 判断元素是否与「视口 + 下方 20%」区域相交
   * @param {Element} el
   */
  function isElementInTranslateZone(el) {
    if (!el || !el.getBoundingClientRect) return false;
    var rect = el.getBoundingClientRect();
    return rect.bottom > 0 && rect.top < getZoneBottomPx();
  }

  function isNodeDone(node) {
    var parent = node.parentElement;
    if (!parent) return true;
    return parent.hasAttribute(ATTR_TRANSLATED) || parent.hasAttribute(ATTR_TRANSLATING);
  }

  // ---------- 语言检测 ----------
  function collectVisibleText(doc, maxLen) {
    maxLen = maxLen || 8000;
    var parts = [];
    var total = 0;
    var root = doc.body || doc.documentElement;
    if (!root) return "";

    var walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        var parent = node.parentElement;
        if (!parent || isInsideSkipContainer(node)) return NodeFilter.FILTER_REJECT;
        try {
          var style = doc.defaultView && doc.defaultView.getComputedStyle(parent);
          if (style && (style.display === "none" || style.visibility === "hidden")) {
            return NodeFilter.FILTER_REJECT;
          }
        } catch (e) {}
        var t = node.textContent && node.textContent.trim();
        if (!t) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    while (walker.nextNode() && total < maxLen) {
      var t = walker.currentNode.textContent.trim();
      if (t.length < 2) continue;
      parts.push(t);
      total += t.length;
    }
    return parts.join(" ").slice(0, maxLen);
  }

  function analyzeScriptRatios(text) {
    var latin = 0, cjk = 0, total = 0;
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (/\s/.test(ch)) continue;
      total++;
      if (/[\u4e00-\u9fff\u3400-\u4dbf]/.test(ch)) cjk++;
      else if (/[a-zA-Z]/.test(ch)) latin++;
    }
    return {
      total: total,
      latinRatio: total ? latin / total : 0,
      cjkRatio: total ? cjk / total : 0,
    };
  }

  function getDeclaredLanguage(doc) {
    var htmlLang = doc.documentElement.getAttribute("lang");
    if (htmlLang) return htmlLang.trim().toLowerCase();
    var meta = doc.querySelector('meta[http-equiv="content-language"]');
    if (meta) return (meta.getAttribute("content") || "").trim().toLowerCase();
    return null;
  }

  function detectEnglishPage(doc) {
    var declared = getDeclaredLanguage(doc);
    if (declared) {
      if (/^zh|^ja|^ko/.test(declared)) {
        return { isEnglish: false, confidence: 0.9, reason: "声明语言: " + declared };
      }
      if (/^en/.test(declared)) {
        return { isEnglish: true, confidence: 0.85, reason: "声明语言: " + declared };
      }
    }

    var sample = collectVisibleText(doc);
    if (sample.length < 80) {
      return { isEnglish: false, confidence: 0.3, reason: "正文过少" };
    }

    var ratios = analyzeScriptRatios(sample);
    if (ratios.total < 40) {
      return { isEnglish: false, confidence: 0.3, reason: "有效字符过少" };
    }
    if (ratios.cjkRatio >= 0.12) {
      return { isEnglish: false, confidence: 0.8, reason: "中文占比较高" };
    }
    if (ratios.latinRatio >= 0.55) {
      return {
        isEnglish: true,
        confidence: Math.min(0.95, 0.5 + ratios.latinRatio),
        reason: "拉丁字母占比 " + Math.round(ratios.latinRatio * 100) + "%",
      };
    }
    return { isEnglish: false, confidence: 0.5, reason: "未达英文阈值" };
  }

  // ---------- 通信 ----------
  function sendBg(type, payload) {
    payload = payload || {};
    return new Promise(function (resolve, reject) {
      chrome.runtime.sendMessage({ type: type, payload: payload }, function (res) {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (!res || !res.ok) {
          reject(new Error((res && res.error) || "后台服务无响应，请刷新扩展"));
          return;
        }
        resolve(res.data);
      });
    });
  }

  /** 收集页面中所有待译英文文本节点 */
  function collectTextNodes(root) {
    root = root || document.body;
    if (!root) return [];
    var nodes = [];
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        var parent = node.parentElement;
        if (!parent || isInsideSkipContainer(node)) return NodeFilter.FILTER_REJECT;
        if (parent.closest("[" + ATTR_TRANSLATED + "]")) return NodeFilter.FILTER_REJECT;
        if (parent.hasAttribute(ATTR_TRANSLATING)) return NodeFilter.FILTER_REJECT;
        try {
          var style = window.getComputedStyle(parent);
          if (style.display === "none" || style.visibility === "hidden") return NodeFilter.FILTER_REJECT;
        } catch (e) {}
        var t = node.textContent && node.textContent.trim();
        if (!t || t.length < 2) return NodeFilter.FILTER_REJECT;
        if (!/[a-zA-Z]/.test(t)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    while (walker.nextNode()) nodes.push(walker.currentNode);
    return nodes;
  }

  /** 刷新待译节点注册表（含动态插入内容） */
  function refreshRegistry() {
    var nodes = collectTextNodes();
    lazySession.registry = nodes.map(function (node) {
      return { node: node, parent: node.parentElement };
    });
    lazySession.totalEnglishNodes = lazySession.translatedCount + nodes.length;
  }

  /** 获取当前翻译区内、尚未翻译的节点 */
  function getPendingNodesInZone() {
    var pending = [];
    for (var i = 0; i < lazySession.registry.length; i++) {
      var item = lazySession.registry[i];
      if (!item.node.isConnected) continue;
      if (isNodeDone(item.node)) continue;
      if (!item.parent || !item.parent.isConnected) continue;
      if (isElementInTranslateZone(item.parent)) {
        pending.push(item.node);
      }
    }
    return pending;
  }

  function updateBannerProgress(banner, extra) {
    if (!banner) return;
    var meta = banner.querySelector(".ds-translator-banner__meta");
    var strong = banner.querySelector(".ds-translator-banner__text strong");
    if (strong) strong.textContent = "逐步翻译中";
    if (meta) {
      var done = lazySession.translatedCount;
      var total = lazySession.totalEnglishNodes;
      meta.textContent =
        "已译 " + done + " / " + total + " 段 · 视口内优先，下滚继续" + (extra ? " · " + extra : "");
    }
  }

  function markNodeTranslating(node) {
    var parent = node.parentElement;
    if (parent) parent.setAttribute(ATTR_TRANSLATING, "1");
  }

  function applyTranslation(node, zh) {
    zh = sanitizeTranslation(zh);
    if (!node || !zh) return;
    var parent = node.parentElement;
    if (parent) {
      if (!parent.hasAttribute(ATTR_ORIGINAL)) {
        parent.setAttribute(ATTR_ORIGINAL, node.textContent);
      }
      parent.removeAttribute(ATTR_TRANSLATING);
      parent.setAttribute(ATTR_TRANSLATED, "1");
    }
    node.textContent = zh;
    lazySession.translatedCount++;
  }

  /**
   * 翻译一批视口内节点（串行队列，避免并发写 DOM/API）
   */
  function flushTranslateQueue() {
    if (!lazySession.active || isTranslating) return Promise.resolve();

    var pending = getPendingNodesInZone();
    if (pending.length === 0) {
      updateBannerProgress(lazySession.banner);
      return Promise.resolve();
    }

    isTranslating = true;
    var batch = pending.slice(0, CHUNK_SIZE);
    batch.forEach(markNodeTranslating);
    updateBannerProgress(lazySession.banner, "翻译中…");

    var segments = batch.map(function (n) { return n.textContent; });

    return sendBg(MSG.TRANSLATE_BATCH, { segments: segments })
      .then(function (data) {
        data.translations.forEach(function (zh, i) {
          applyTranslation(batch[i], zh);
        });
        updateBannerProgress(lazySession.banner);
      })
      .catch(function (err) {
        batch.forEach(function (node) {
          var p = node.parentElement;
          if (p) p.removeAttribute(ATTR_TRANSLATING);
        });
        throw err;
      })
      .finally(function () {
        isTranslating = false;
        if (lazySession.active) {
          var more = getPendingNodesInZone();
          if (more.length > 0) {
            flushTranslateQueue();
          } else {
            checkAllComplete();
          }
        }
      });
  }

  function checkAllComplete() {
    refreshRegistry();
    var remaining = collectTextNodes().length;
    if (remaining === 0 && lazySession.banner) {
      var banner = lazySession.banner;
      var titleEl = banner.querySelector(".ds-translator-banner__text strong");
      var metaEl = banner.querySelector(".ds-translator-banner__meta");
      if (titleEl) titleEl.textContent = "翻译完成";
      if (metaEl) metaEl.textContent = "全文已译 · 由 DeepSeek 提供 · 刷新可恢复原文";
      teardownLazyWatchers();
      restoreBannerActions(banner);
      var actions = banner.querySelector(".ds-translator-banner__actions");
      if (actions) {
        actions.innerHTML =
          '<button type="button" class="ds-btn ds-btn--ghost" data-action="close">关闭</button>';
        actions.querySelector('[data-action="close"]').onclick = function () {
          banner.remove();
        };
      }
    }
  }

  /** 绑定 IntersectionObserver：元素进入视口+20% 区域时触发翻译 */
  function setupIntersectionObserver() {
    teardownIntersectionObserver();

    var marginBottom = Math.round(VIEWPORT_PRELOAD_RATIO * 100) + "%";
    lazySession.observer = new IntersectionObserver(
      function () {
        if (lazySession.active) flushTranslateQueue();
      },
      {
        root: null,
        rootMargin: "0px 0px " + marginBottom + " 0px",
        threshold: 0,
      }
    );

    var seen = new Set();
    lazySession.registry.forEach(function (item) {
      if (item.parent && !seen.has(item.parent)) {
        seen.add(item.parent);
        lazySession.observer.observe(item.parent);
      }
    });
  }

  function teardownIntersectionObserver() {
    if (lazySession.observer) {
      lazySession.observer.disconnect();
      lazySession.observer = null;
    }
  }

  /** 滚动时防抖触发：翻译新进入区域的英文 */
  function onScrollDebounced() {
    if (!lazySession.active) return;
    clearTimeout(lazySession.scrollTimer);
    lazySession.scrollTimer = setTimeout(function () {
      flushTranslateQueue();
      refreshRegistry();
      setupIntersectionObserver();
    }, SCROLL_DEBOUNCE_MS);
  }

  /** 监听 DOM 变化（SPA / 懒加载），刷新注册表 */
  function setupMutationObserver() {
    teardownMutationObserver();
    lazySession.mutationObserver = new MutationObserver(function () {
      if (!lazySession.active) return;
      clearTimeout(lazySession.mutationTimer);
      lazySession.mutationTimer = setTimeout(function () {
        refreshRegistry();
        setupIntersectionObserver();
        flushTranslateQueue();
      }, 300);
    });
    lazySession.mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  function teardownMutationObserver() {
    if (lazySession.mutationObserver) {
      lazySession.mutationObserver.disconnect();
      lazySession.mutationObserver = null;
    }
  }

  function teardownLazyWatchers() {
    lazySession.active = false;
    teardownIntersectionObserver();
    teardownMutationObserver();
    window.removeEventListener("scroll", onScrollDebounced);
    clearTimeout(lazySession.scrollTimer);
    clearTimeout(lazySession.mutationTimer);
  }

  function startLazyWatchers(banner) {
    lazySession.active = true;
    lazySession.banner = banner;
    lazySession.translatedCount = 0;
    refreshRegistry();

    if (lazySession.totalEnglishNodes === 0) {
      alert("未找到可翻译的英文文本。");
      lazySession.active = false;
      return;
    }

    setupIntersectionObserver();
    setupMutationObserver();
    window.addEventListener("scroll", onScrollDebounced, { passive: true });

    updateBannerProgress(banner);
    flushTranslateQueue();
  }

  // ---------- UI ----------
  function escapeHtml(s) {
    var d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  function bindDefaultBannerActions(banner) {
    var translateBtn = banner.querySelector('[data-action="translate"]');
    var dismissBtn = banner.querySelector('[data-action="dismiss"]');
    if (!translateBtn || !dismissBtn) return false;
    translateBtn.onclick = function () { startTranslation(banner); };
    dismissBtn.onclick = function () {
      teardownLazyWatchers();
      banner.remove();
      try { sessionStorage.setItem("ds-translator-dismissed", "1"); } catch (e) {}
    };
    return true;
  }

  function restoreBannerActions(banner) {
    if (!banner) return;
    var actions = banner.querySelector(".ds-translator-banner__actions");
    if (!actions) return;
    actions.innerHTML =
      '<button type="button" class="ds-btn ds-btn--primary" data-action="translate">翻译为中文</button>' +
      '<button type="button" class="ds-btn ds-btn--ghost" data-action="dismiss">暂不翻译</button>';
    bindDefaultBannerActions(banner);
  }

  function setBannerTranslatingActions(banner) {
    var actions = banner.querySelector(".ds-translator-banner__actions");
    if (!actions) return;
    actions.innerHTML =
      '<button type="button" class="ds-btn ds-btn--primary" data-action="stop">停止翻译</button>' +
      '<button type="button" class="ds-btn ds-btn--ghost" data-action="cancel">取消翻译</button>';
    actions.querySelector('[data-action="stop"]').onclick = function () {
      teardownLazyWatchers();
      restoreBannerActions(banner);
      var meta = banner.querySelector(".ds-translator-banner__meta");
      if (meta) meta.textContent = "已停止 · 可再次点击「翻译为中文」";
    };
    actions.querySelector('[data-action="cancel"]').onclick = function () {
      teardownLazyWatchers();
      restoreBannerActions(banner);
      var meta = banner.querySelector(".ds-translator-banner__meta");
      if (meta) meta.textContent = "已取消 · 刷新页面可恢复原文";
    };
  }

  function createBanner(detection) {
    var existing = document.getElementById(BANNER_ID);
    if (existing) {
      if (existing.querySelector('[data-action="translate"]')) {
        bindDefaultBannerActions(existing);
        return;
      }
      restoreBannerActions(existing);
      return;
    }

    var banner = document.createElement("div");
    banner.id = BANNER_ID;
    banner.className = "ds-translator-banner";
    banner.innerHTML =
      '<div class="ds-translator-banner__inner">' +
      '<span class="ds-translator-banner__icon" aria-hidden="true">🌐</span>' +
      '<div class="ds-translator-banner__text">' +
      "<strong>检测到英文页面</strong>" +
      '<span class="ds-translator-banner__meta">' +
      escapeHtml(detection.reason) +
      " · 置信度 " +
      Math.round(detection.confidence * 100) +
      "%</span></div>" +
      '<div class="ds-translator-banner__actions">' +
      '<button type="button" class="ds-btn ds-btn--primary" data-action="translate">翻译为中文</button>' +
      '<button type="button" class="ds-btn ds-btn--ghost" data-action="dismiss">暂不翻译</button>' +
      "</div></div>";

    bindDefaultBannerActions(banner);
    document.documentElement.appendChild(banner);
  }

  function setBannerLoading(banner, loading, text) {
    if (!banner) return;
    var primary = banner.querySelector('[data-action="translate"], [data-action="stop"]');
    if (loading) {
      banner.classList.add("ds-translator-banner--loading");
      if (primary) {
        primary.disabled = true;
        if (text) primary.textContent = text;
      }
    } else {
      banner.classList.remove("ds-translator-banner--loading");
      if (primary) primary.disabled = false;
    }
  }

  function startTranslation(banner) {
    if (lazySession.active) return;

    setBannerLoading(banner, true, "正在连接 DeepSeek…");

    sendBg(MSG.GET_SETTINGS)
      .then(function (settings) {
        if (!settings.hasApiKey) {
          alert("请先在扩展「选项」中配置 DeepSeek API Key，或在本项目根目录创建 config.local.json");
          chrome.runtime.openOptionsPage && chrome.runtime.openOptionsPage();
          throw new Error("未配置 API Key");
        }

        setBannerTranslatingActions(banner);
        setBannerLoading(banner, true, "正在翻译可见区域…");

        startLazyWatchers(banner);
      })
      .catch(function (err) {
        if (err.message !== "未配置 API Key") {
          alert("翻译失败：" + err.message);
        }
        teardownLazyWatchers();
        restoreBannerActions(banner);
        setBannerLoading(banner, false);
      })
      .finally(function () {
        if (!lazySession.active) {
          setBannerLoading(banner, false);
        } else {
          banner.classList.remove("ds-translator-banner--loading");
        }
      });
  }

  function runDetection(forceShow) {
    if (!forceShow) {
      try {
        if (sessionStorage.getItem("ds-translator-dismissed")) return;
      } catch (e) {}
    }

    sendBg(MSG.GET_SETTINGS)
      .catch(function () { return { enabled: true, autoPrompt: true }; })
      .then(function (settings) {
        if (!settings.enabled) return;
        var detection = detectEnglishPage(document);
        if (!detection.isEnglish) return;
        if (settings.autoPrompt !== false) createBanner(detection);
      });
  }

  /** 修复旧版残留横幅（有顶栏但无按钮） */
  function repairBannerIfNeeded() {
    var banner = document.getElementById(BANNER_ID);
    if (!banner || lazySession.active) return;
    if (!banner.querySelector('[data-action="translate"]')) {
      restoreBannerActions(banner);
    } else {
      bindDefaultBannerActions(banner);
    }
  }

  function showManualBar() {
    try { sessionStorage.removeItem("ds-translator-dismissed"); } catch (e) {}
    var detection = detectEnglishPage(document);
    createBanner(
      detection.isEnglish
        ? detection
        : { isEnglish: true, confidence: 0.5, reason: "手动触发翻译" }
    );
    repairBannerIfNeeded();
  }

  chrome.runtime.onMessage.addListener(function (msg) {
    if (msg.type === "SHOW_TRANSLATE_BAR") showManualBar();
    if (msg.type === "RUN_DETECT") {
      try { sessionStorage.removeItem("ds-translator-dismissed"); } catch (e) {}
      runDetection(true);
    }
  });

  function scheduleDetect() {
    setTimeout(function () {
      runDetection(false);
      repairBannerIfNeeded();
    }, 800);
    setTimeout(function () {
      runDetection(false);
      repairBannerIfNeeded();
    }, 2500);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scheduleDetect);
  } else {
    scheduleDetect();
  }

  window.__dsTranslatorLoaded = true;
})();
