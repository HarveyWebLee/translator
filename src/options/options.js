/**
 * 选项页：保存 DeepSeek API Key、模型与行为开关。
 */

import { STORAGE_KEYS } from "../shared/constants.js";

const form = document.getElementById("optionsForm");
const hint = document.getElementById("saveHint");

/** 若 storage 为空，尝试从 config.local.json 读取（与 .env 配合：复制 example 为 config.local.json） */
async function tryLoadLocalConfig() {
  try {
    const res = await fetch(chrome.runtime.getURL("config.local.json"));
    if (!res.ok) return null;
    const cfg = await res.json();
    return cfg.deepseekApiKey || cfg.apiKey || "";
  } catch {
    return null;
  }
}

async function load() {
  const data = await chrome.storage.sync.get([
    STORAGE_KEYS.API_KEY,
    STORAGE_KEYS.MODEL,
    STORAGE_KEYS.ENABLED,
    STORAGE_KEYS.AUTO_PROMPT,
    STORAGE_KEYS.SELECT_TRANSLATE,
  ]);

  let apiKey = data[STORAGE_KEYS.API_KEY] || "";
  if (!apiKey) {
    apiKey = (await tryLoadLocalConfig()) || "";
    if (apiKey) {
      await chrome.storage.sync.set({ [STORAGE_KEYS.API_KEY]: apiKey });
    }
  }

  document.getElementById("apiKey").value = apiKey;
  document.getElementById("model").value = data[STORAGE_KEYS.MODEL] || "deepseek-chat";
  document.getElementById("enabled").checked = data[STORAGE_KEYS.ENABLED] !== false;
  document.getElementById("autoPrompt").checked = data[STORAGE_KEYS.AUTO_PROMPT] !== false;
  document.getElementById("selectTranslate").checked = data[STORAGE_KEYS.SELECT_TRANSLATE] === true;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  hint.textContent = "";
  hint.className = "hint";

  const apiKey = document.getElementById("apiKey").value.trim();
  const model = document.getElementById("model").value;
  const enabled = document.getElementById("enabled").checked;
  const autoPrompt = document.getElementById("autoPrompt").checked;
  const selectTranslate = document.getElementById("selectTranslate").checked;

  if (!apiKey) {
    hint.textContent = "请填写 API Key";
    hint.classList.add("hint--error");
    return;
  }

  await chrome.storage.sync.set({
    [STORAGE_KEYS.API_KEY]: apiKey,
    [STORAGE_KEYS.MODEL]: model,
    [STORAGE_KEYS.ENABLED]: enabled,
    [STORAGE_KEYS.AUTO_PROMPT]: autoPrompt,
    [STORAGE_KEYS.SELECT_TRANSLATE]: selectTranslate,
  });

  hint.textContent = "已保存";
});

load();
