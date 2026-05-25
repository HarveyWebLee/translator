/** chrome.storage.local（敏感） */
export const LOCAL_KEYS = {
  ACCESS_TOKEN: 'accessToken',
  REFRESH_TOKEN: 'refreshToken',
  USER_API_KEYS: 'userApiKeys', // 形如 { deepseek: 'sk-xxx', openai: 'sk-xxx' }
} as const;

/** chrome.storage.sync（偏好） */
export const SYNC_KEYS = {
  ENABLED: 'enabled',
  AUTO_PROMPT: 'autoPrompt',
  SELECT_TRANSLATE: 'selectTranslate',
  CURRENT_PROVIDER: 'currentProvider',
  CURRENT_MODEL: 'currentModel',
  TARGET_LANG: 'targetLang',
} as const;
