/**
 * 弹出窗口（无 ES import，避免加载失败）
 */

const STORAGE_KEYS = {
  API_KEY: "deepseekApiKey",
  MODEL: "deepseekModel",
  AUTO_PROMPT: "autoPrompt",
  ENABLED: "enabled",
  SELECT_TRANSLATE: "selectTranslate",
};

const $ = (id) => document.getElementById(id);

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

/** 向标签页发消息；若内容脚本未注入则先注入 */
async function sendTab(tabId, message) {
  try {
    return await chrome.tabs.sendMessage(tabId, message);
  } catch (err) {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["src/content/content.js", "src/content/selection-translate.js"],
    });
    await chrome.scripting.insertCSS({
      target: { tabId },
      files: ["src/content/content.css", "src/content/selection-panel.css"],
    });
    return chrome.tabs.sendMessage(tabId, message);
  }
}

async function loadStorage() {
  return chrome.storage.sync.get([
    STORAGE_KEYS.ENABLED,
    STORAGE_KEYS.AUTO_PROMPT,
    STORAGE_KEYS.SELECT_TRANSLATE,
    STORAGE_KEYS.API_KEY,
  ]);
}

async function saveStorage(partial) {
  return chrome.storage.sync.set(partial);
}

async function detectPageLanguage(tabId) {
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      const sample = (document.body?.innerText || "").slice(0, 5000);
      let latin = 0;
      let cjk = 0;
      let total = 0;
      for (const ch of sample) {
        if (/\s/.test(ch)) continue;
        total++;
        if (/[\u4e00-\u9fff]/.test(ch)) cjk++;
        else if (/[a-zA-Z]/.test(ch)) latin++;
      }
      const lang = document.documentElement.lang?.toLowerCase() || "";
      const isEn =
        lang.startsWith("en") || (total > 40 && latin / total > 0.55 && cjk / total < 0.12);
      return { isEnglish: isEn, lang: lang || "未知" };
    },
  });
  return result;
}

function setStatus(isEnglish, lang, hasApiKey) {
  const dot = $("statusDot");
  const text = $("statusText");
  let suffix = hasApiKey ? "" : " · 未配置 API Key";
  if (isEnglish) {
    dot.className = "status__dot status__dot--en";
    text.textContent = `当前页面疑似英文（${lang}）${suffix}`;
  } else {
    dot.className = "status__dot status__dot--other";
    text.textContent = `当前页面可能非英文（${lang}）${suffix}`;
  }
}

async function init() {
  const data = await loadStorage();
  const hasApiKey = Boolean(data[STORAGE_KEYS.API_KEY]);

  $("enabled").checked = data[STORAGE_KEYS.ENABLED] !== false;
  $("autoPrompt").checked = data[STORAGE_KEYS.AUTO_PROMPT] !== false;
  $("selectTranslate").checked = data[STORAGE_KEYS.SELECT_TRANSLATE] === true;

  const tab = await getActiveTab();
  if (tab?.id && tab.url?.startsWith("http")) {
    try {
      const det = await detectPageLanguage(tab.id);
      setStatus(det.isEnglish, det.lang, hasApiKey);
    } catch {
      $("statusText").textContent = "无法检测（请刷新页面后重试）";
    }
  } else {
    $("statusText").textContent = "请在普通 http/https 网页中使用";
  }

  $("enabled").addEventListener("change", (e) => {
    saveStorage({ [STORAGE_KEYS.ENABLED]: e.target.checked });
  });

  $("autoPrompt").addEventListener("change", (e) => {
    saveStorage({ [STORAGE_KEYS.AUTO_PROMPT]: e.target.checked });
  });

  $("selectTranslate").addEventListener("change", (e) => {
    saveStorage({ [STORAGE_KEYS.SELECT_TRANSLATE]: e.target.checked });
  });

  $("btnTranslate").addEventListener("click", async () => {
    const t = await getActiveTab();
    if (!t?.id) return;
    try {
      await sendTab(t.id, { type: "SHOW_TRANSLATE_BAR" });
    } catch (e) {
      alert("无法连接页面脚本，请刷新该网页后重试。\n" + e.message);
    }
    window.close();
  });

  $("btnDetect").addEventListener("click", async () => {
    const t = await getActiveTab();
    if (!t?.id) return;
    try {
      await sendTab(t.id, { type: "RUN_DETECT" });
      const det = await detectPageLanguage(t.id);
      setStatus(det.isEnglish, det.lang, hasApiKey);
    } catch (e) {
      alert("检测失败，请刷新页面后重试。\n" + e.message);
    }
  });

  $("openOptions").addEventListener("click", (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });
}

init();
