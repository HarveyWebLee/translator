/**
 * 扩展全局常量：DeepSeek API、存储键、消息类型等。
 */

/** DeepSeek Chat Completions 端点（OpenAI 兼容格式） */
export const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";

/** 默认模型；可在选项页切换为 deepseek-v4-flash 等 */
export const DEFAULT_MODEL = "deepseek-chat";

/** chrome.storage.sync 中的配置键 */
export const STORAGE_KEYS = {
  API_KEY: "deepseekApiKey",
  MODEL: "deepseekModel",
  /** 是否在检测到英文页时自动弹出提示条 */
  AUTO_PROMPT: "autoPrompt",
  /** 是否启用扩展 */
  ENABLED: "enabled",
  /** 是否开启划词翻译（选中英文后弹出翻译面板） */
  SELECT_TRANSLATE: "selectTranslate",
};

/** content ↔ background 消息类型 */
export const MSG = {
  /** 检测当前页语言 */
  DETECT_LANGUAGE: "DETECT_LANGUAGE",
  /** 批量翻译文本 */
  TRANSLATE_BATCH: "TRANSLATE_BATCH",
  /** 获取用户配置（不含完整 API Key 时可只返回是否已配置） */
  GET_SETTINGS: "GET_SETTINGS",
  /** 划词翻译：返回词典式释义 + 上下文解释 */
  TRANSLATE_SELECTION: "TRANSLATE_SELECTION",
  /** 更新当前使用的模型（划词面板内切换） */
  UPDATE_MODEL: "UPDATE_MODEL",
};

/** 单次请求送入模型的最大字符数（避免超出上下文） */
export const MAX_CHARS_PER_BATCH = 3500;

/** 语言检测：判定为英文的拉丁字母占比阈值 */
export const ENGLISH_LATIN_RATIO = 0.55;

/** 语言检测：中文占比超过此值则视为非英文页 */
export const CJK_RATIO_BLOCK = 0.12;
