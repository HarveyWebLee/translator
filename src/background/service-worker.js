/**
 * Service Worker：处理 DeepSeek API 调用与配置读取。
 */

import { MSG, STORAGE_KEYS, MAX_CHARS_PER_BATCH } from "../shared/constants.js";
import { translateBatch, translateSelection } from "../shared/deepseek-client.js";

/**
 * 从扩展根目录 config.local.json 同步 API Key（.env 不会被扩展读取）
 * 格式: { "deepseekApiKey": "sk-..." }
 */
async function syncApiKeyFromLocalConfig() {
  try {
    const url = chrome.runtime.getURL("config.local.json");
    const res = await fetch(url);
    if (!res.ok) return;
    const cfg = await res.json();
    const key = cfg.deepseekApiKey || cfg.apiKey || "";
    if (!key.trim()) return;

    const existing = await chrome.storage.sync.get(STORAGE_KEYS.API_KEY);
    if (!existing[STORAGE_KEYS.API_KEY]) {
      await chrome.storage.sync.set({ [STORAGE_KEYS.API_KEY]: key.trim() });
      console.log("[translator] 已从 config.local.json 导入 API Key");
    }
  } catch (e) {
    // 无配置文件时忽略
  }
}

chrome.runtime.onInstalled.addListener(() => {
  syncApiKeyFromLocalConfig();
});

chrome.runtime.onStartup.addListener(() => {
  syncApiKeyFromLocalConfig();
});

/** 读取用户配置 */
async function loadSettings() {
  const data = await chrome.storage.sync.get([
    STORAGE_KEYS.API_KEY,
    STORAGE_KEYS.MODEL,
    STORAGE_KEYS.AUTO_PROMPT,
    STORAGE_KEYS.ENABLED,
    STORAGE_KEYS.SELECT_TRANSLATE,
  ]);
  return {
    apiKey: data[STORAGE_KEYS.API_KEY] || "",
    model: data[STORAGE_KEYS.MODEL] || "deepseek-chat",
    autoPrompt: data[STORAGE_KEYS.AUTO_PROMPT] !== false,
    enabled: data[STORAGE_KEYS.ENABLED] !== false,
    selectTranslate: data[STORAGE_KEYS.SELECT_TRANSLATE] === true,
  };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handler = async () => {
    switch (message.type) {
      case MSG.GET_SETTINGS: {
        const s = await loadSettings();
        return {
          enabled: s.enabled,
          autoPrompt: s.autoPrompt,
          selectTranslate: s.selectTranslate,
          hasApiKey: Boolean(s.apiKey),
          model: s.model,
        };
      }

      case MSG.UPDATE_MODEL: {
        const { model } = message.payload || {};
        if (model) await chrome.storage.sync.set({ [STORAGE_KEYS.MODEL]: model });
        return { model };
      }

      case MSG.TRANSLATE_SELECTION: {
        const settings = await loadSettings();
        if (!settings.enabled) throw new Error("扩展已禁用");
        const { text, context } = message.payload || {};
        if (!text?.trim()) throw new Error("未选中有效文本");
        const result = await translateSelection({
          apiKey: settings.apiKey,
          model: settings.model,
          text: text.trim(),
          context: context || "",
        });
        return { ...result, model: settings.model };
      }

      case MSG.DETECT_LANGUAGE: {
        // 由 content 传入采样结果；若在 content 已检测可跳过
        // 此处保留接口供 popup 手动触发
        return { ok: true };
      }

      case MSG.TRANSLATE_BATCH: {
        const settings = await loadSettings();
        if (!settings.enabled) {
          throw new Error("扩展已禁用，请在弹出窗口中启用");
        }
        const { segments } = message.payload;
        if (!Array.isArray(segments) || segments.length === 0) {
          return { translations: [] };
        }

        // 按 JSON 批量请求：每批条数不宜过多，避免模型截断或数组错位
        const MAX_ITEMS_PER_BATCH = 15;
        const batches = [];
        let batch = [];
        let len = 0;

        for (let i = 0; i < segments.length; i++) {
          const t = segments[i];
          const add = t.length + 50; // JSON 转义开销估算
          if (
            batch.length &&
            (len + add > MAX_CHARS_PER_BATCH || batch.length >= MAX_ITEMS_PER_BATCH)
          ) {
            batches.push(batch);
            batch = [];
            len = 0;
          }
          batch.push({ index: i, text: t });
          len += add;
        }
        if (batch.length) batches.push(batch);

        const all = new Map();
        for (const b of batches) {
          const part = await translateBatch({
            apiKey: settings.apiKey,
            model: settings.model,
            batch: b,
          });
          part.forEach((v, k) => all.set(k, v));
        }

        const translations = segments.map((_, i) => all.get(i) ?? segments[i]);
        return { translations };
      }

      default:
        throw new Error(`未知消息类型: ${message.type}`);
    }
  };

  handler()
    .then((result) => sendResponse({ ok: true, data: result }))
    .catch((err) => sendResponse({ ok: false, error: err.message || String(err) }));

  return true;
});
