/**
 * 划词翻译：选中英文后在选区附近显示词典式翻译面板
 */
(function () {
  "use strict";

  var PANEL_ID = "ds-selection-panel";
  var MAX_SELECT_LEN = 400;
  var MOUSEUP_DELAY_MS = 180;

  var MSG = {
    GET_SETTINGS: "GET_SETTINGS",
    TRANSLATE_SELECTION: "TRANSLATE_SELECTION",
    UPDATE_MODEL: "UPDATE_MODEL",
  };

  var MODEL_OPTIONS = [
    { value: "deepseek-chat", label: "DeepSeek Chat" },
    { value: "deepseek-v4-flash", label: "DeepSeek V4 Flash" },
    { value: "deepseek-v4-pro", label: "DeepSeek V4 Pro" },
  ];

  var state = {
    enabled: false,
    pinned: false,
    panel: null,
    lastSelectionText: "",
    mouseupTimer: null,
    currentData: null,
  };

  function sendBg(type, payload) {
    return new Promise(function (resolve, reject) {
      chrome.runtime.sendMessage({ type: type, payload: payload || {} }, function (res) {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
        else if (!res || !res.ok) reject(new Error((res && res.error) || "请求失败"));
        else resolve(res.data);
      });
    });
  }

  /** 判断划选文本是否为英文 */
  function isEnglishText(text) {
    if (!text || !text.trim()) return false;
    var s = text.trim();
    if (s.length > MAX_SELECT_LEN) s = s.slice(0, MAX_SELECT_LEN);

    var latin = 0, cjk = 0, total = 0;
    for (var i = 0; i < s.length; i++) {
      var ch = s[i];
      if (/\s/.test(ch)) continue;
      total++;
      if (/[\u4e00-\u9fff]/.test(ch)) cjk++;
      else if (/[a-zA-Z]/.test(ch)) latin++;
    }
    if (total === 0) return false;
    if (cjk / total > 0.25) return false;
    return latin / total >= 0.45 || /[a-zA-Z]{2,}/.test(s);
  }

  /** 获取选区附近的页面上下文 */
  function getSelectionContext() {
    var sel = window.getSelection();
    if (!sel || !sel.rangeCount) return "";
    var node = sel.anchorNode;
    if (!node) return "";
    var el = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
    if (!el) return "";
    var block = el.closest("p, li, td, th, h1, h2, h3, h4, h5, h6, article, section, div");
    var text = (block && block.innerText) || el.innerText || document.body.innerText || "";
    return text.replace(/\s+/g, " ").trim().slice(0, 1200);
  }

  /** 高亮例句中的关键词 */
  function highlightTermInExample(exampleEn, term) {
    if (!exampleEn || !term) return escapeHtml(exampleEn);
    var escaped = escapeHtml(exampleEn);
    var words = term.trim().split(/\s+/).filter(Boolean);
    words.sort(function (a, b) { return b.length - a.length; });
    words.forEach(function (w) {
      if (w.length < 2) return;
      var re = new RegExp("(" + w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "gi");
      escaped = escaped.replace(re, '<span class="ds-sel-panel__highlight">$1</span>');
    });
    return escaped;
  }

  function escapeHtml(s) {
    var d = document.createElement("div");
    d.textContent = s || "";
    return d.innerHTML;
  }

  function getSelectionRect() {
    var sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) return null;
    var range = sel.getRangeAt(0);
    var rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      var span = document.createElement("span");
      range.insertNode(span);
      rect = span.getBoundingClientRect();
      span.remove();
    }
    return rect;
  }

  function removePanel() {
    state.pinned = false;
    state.currentData = null;
    if (state.panel) {
      state.panel.remove();
      state.panel = null;
    }
  }

  function positionPanel(panel, rect) {
    var w = panel.offsetWidth || 380;
    var h = panel.offsetHeight || 320;
    var gap = 10;
    var left = rect.left + rect.width / 2 - w / 2;
    var top = rect.bottom + gap;

    if (top + h > window.innerHeight - 8) {
      top = rect.top - h - gap;
    }
    left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
    top = Math.max(8, Math.min(top, window.innerHeight - h - 8));

    panel.style.left = left + "px";
    panel.style.top = top + "px";
  }

  function speakText(text, lang) {
    if (!text || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(text);
    u.lang = lang || "en-US";
    u.rate = 0.9;
    window.speechSynthesis.speak(u);
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return Promise.reject(new Error("无法访问剪贴板"));
  }

  function buildModelOptions(selected) {
    return MODEL_OPTIONS.map(function (o) {
      var sel = o.value === selected ? " selected" : "";
      return '<option value="' + o.value + '"' + sel + ">" + o.label + "</option>";
    }).join("");
  }

  function createPanelShell(model) {
    var panel = document.createElement("div");
    panel.id = PANEL_ID;
    panel.className = "ds-sel-panel";
    panel.innerHTML =
      '<header class="ds-sel-panel__header">' +
      '<div class="ds-sel-panel__brand" title="英文翻译助手">A</div>' +
      '<div class="ds-sel-panel__model-wrap">' +
      '<select class="ds-sel-panel__model" aria-label="翻译模型">' +
      buildModelOptions(model) +
      "</select></div>" +
      '<div class="ds-sel-panel__tools">' +
      '<button type="button" class="ds-sel-panel__icon-btn" data-action="copy-all" title="复制全部">📋</button>' +
      '<button type="button" class="ds-sel-panel__icon-btn" data-action="pin" title="固定面板">📌</button>' +
      '<button type="button" class="ds-sel-panel__icon-btn" data-action="close" title="关闭">✕</button>' +
      "</div></header>" +
      '<div class="ds-sel-panel__body">' +
      '<div class="ds-sel-panel__loading"><span class="ds-sel-panel__spinner"></span>正在翻译…</div>' +
      "</div>" +
      '<footer class="ds-sel-panel__footer">' +
      '<button type="button" class="ds-sel-panel__icon-btn" data-action="like" title="有帮助">👍</button>' +
      '<button type="button" class="ds-sel-panel__icon-btn" data-action="dislike" title="无帮助">👎</button>' +
      "</footer>";

    bindPanelEvents(panel);
    return panel;
  }

  function bindPanelEvents(panel) {
    panel.addEventListener("mousedown", function (e) {
      e.stopPropagation();
    });

    panel.querySelector('[data-action="close"]').addEventListener("click", removePanel);

    panel.querySelector('[data-action="pin"]').addEventListener("click", function () {
      state.pinned = !state.pinned;
      panel.classList.toggle("ds-sel-panel--pinned", state.pinned);
      panel.querySelector('[data-action="pin"]').classList.toggle("ds-sel-panel__icon-btn--active", state.pinned);
    });

    panel.querySelector(".ds-sel-panel__model").addEventListener("change", function (e) {
      var model = e.target.value;
      sendBg(MSG.UPDATE_MODEL, { model: model }).then(function () {
        if (state.lastSelectionText) fetchAndRender(state.lastSelectionText, getSelectionContext());
      });
    });

    panel.querySelector('[data-action="copy-all"]').addEventListener("click", function () {
      if (!state.currentData) return;
      var d = state.currentData;
      var text =
        d.term + "\n" + (d.phonetic || "") + "\n" + d.partOfSpeech + " " + d.briefDefinition +
        "\n" + d.exampleEn + "\n" + d.exampleZh + "\n" + d.contextExplanation;
      copyText(text).catch(function () {});
    });

    panel.querySelector('[data-action="like"]').addEventListener("click", function (e) {
      e.currentTarget.classList.add("ds-sel-panel__icon-btn--liked");
    });

    panel.querySelector('[data-action="dislike"]').addEventListener("click", function (e) {
      e.currentTarget.classList.add("ds-sel-panel__icon-btn--disliked");
    });
  }

  function renderPanelContent(panel, data) {
    state.currentData = data;
    var body = panel.querySelector(".ds-sel-panel__body");
    var posLabel = data.partOfSpeech ? data.partOfSpeech + " " : "";
    var exampleHtml = highlightTermInExample(data.exampleEn, data.term);

    body.innerHTML =
      '<div class="ds-sel-panel__dict">' +
      '<div class="ds-sel-panel__term-row">' +
      "<h3 class=\"ds-sel-panel__term\">" + escapeHtml(data.term) + "</h3>" +
      (data.phonetic
        ? '<span class="ds-sel-panel__phonetic">' + escapeHtml(data.phonetic) + "</span>" +
          '<button type="button" class="ds-sel-panel__icon-btn" data-action="speak-term" title="朗读">🔊</button>'
        : '<button type="button" class="ds-sel-panel__icon-btn" data-action="speak-term" title="朗读">🔊</button>') +
      "</div>" +
      '<p class="ds-sel-panel__brief">' + escapeHtml(posLabel + data.briefDefinition) + "</p>" +
      (data.exampleEn
        ? '<p class="ds-sel-panel__example">' + exampleHtml + "<br>" + escapeHtml(data.exampleZh) + "</p>"
        : "") +
      "</div>" +
      '<div class="ds-sel-panel__ai">' +
      '<div class="ds-sel-panel__ai-head">' +
      "<strong>" + escapeHtml(data.briefDefinition.split(/[，。；]/)[0] || data.term) + "</strong>" +
      '<button type="button" class="ds-sel-panel__icon-btn" data-action="speak-ai" title="朗读释义">🔊</button>' +
      '<button type="button" class="ds-sel-panel__icon-btn" data-action="copy-ai" title="复制释义">📋</button>' +
      "</div>" +
      '<p class="ds-sel-panel__ai-text">' + escapeHtml(data.contextExplanation) + "</p>" +
      "</div>";

    body.querySelector('[data-action="speak-term"]').addEventListener("click", function () {
      speakText(data.term, "en-US");
    });
    body.querySelector('[data-action="speak-ai"]').addEventListener("click", function () {
      speakText(data.contextExplanation, "zh-CN");
    });
    body.querySelector('[data-action="copy-ai"]').addEventListener("click", function () {
      copyText(data.contextExplanation).catch(function () {});
    });

    if (panel.isConnected) {
      var rect = getSelectionRect();
      if (rect) positionPanel(panel, rect);
    }
  }

  function showError(panel, message) {
    panel.querySelector(".ds-sel-panel__body").innerHTML =
      '<div class="ds-sel-panel__error">' + escapeHtml(message) + "</div>";
  }

  function fetchAndRender(text, context) {
    var panel = state.panel;
    if (!panel) return;

    sendBg(MSG.TRANSLATE_SELECTION, { text: text, context: context })
      .then(function (data) {
        if (data.model) {
          var sel = panel.querySelector(".ds-sel-panel__model");
          if (sel) sel.value = data.model;
        }
        renderPanelContent(panel, data);
      })
      .catch(function (err) {
        showError(panel, err.message || "翻译失败");
      });
  }

  function showPanelForSelection(text, rect) {
    sendBg(MSG.GET_SETTINGS).then(function (settings) {
      if (!settings.hasApiKey) {
        alert("请先在扩展选项中配置 DeepSeek API Key");
        chrome.runtime.openOptionsPage && chrome.runtime.openOptionsPage();
        return;
      }

      removePanel();
      state.lastSelectionText = text;

      var panel = createPanelShell(settings.model);
      document.documentElement.appendChild(panel);
      state.panel = panel;

      positionPanel(panel, rect);
      fetchAndRender(text, getSelectionContext());
    });
  }

  function onMouseUp() {
    if (!state.enabled) return;

    clearTimeout(state.mouseupTimer);
    state.mouseupTimer = setTimeout(function () {
      if (state.panel && state.pinned) return;

      var sel = window.getSelection();
      if (!sel || sel.isCollapsed) {
        if (!state.pinned) removePanel();
        return;
      }

      if (state.panel && state.panel.contains(sel.anchorNode)) return;

      var text = sel.toString().trim();
      if (!text || text.length < 1) {
        if (!state.pinned) removePanel();
        return;
      }
      if (text.length > MAX_SELECT_LEN) text = text.slice(0, MAX_SELECT_LEN);

      if (!isEnglishText(text)) {
        if (!state.pinned) removePanel();
        return;
      }

      var rect = getSelectionRect();
      if (!rect) return;

      showPanelForSelection(text, rect);
    }, MOUSEUP_DELAY_MS);
  }

  function onDocumentMouseDown(e) {
    if (!state.panel || state.pinned) return;
    if (state.panel.contains(e.target)) return;
    removePanel();
  }

  function onKeyDown(e) {
    if (e.key === "Escape") removePanel();
  }

  function onScroll() {
    if (!state.panel || state.pinned) return;
    removePanel();
  }

  function loadEnabledFlag() {
    chrome.storage.sync.get(["selectTranslate", "enabled"], function (data) {
      state.enabled = data.enabled !== false && data.selectTranslate === true;
    });
  }

  function init() {
    loadEnabledFlag();

    chrome.storage.onChanged.addListener(function (changes, area) {
      if (area !== "sync") return;
      if (changes.selectTranslate || changes.enabled) loadEnabledFlag();
    });

    document.addEventListener("mouseup", onMouseUp);
    document.addEventListener("mousedown", onDocumentMouseDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onScroll, { passive: true, capture: true });
  }

  init();
})();
