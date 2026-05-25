import { create } from 'zustand';

import { storageGetMany, storageSet } from '../storage/chrome-storage';
import { SYNC_KEYS } from '../storage/keys';

export interface PrefsState {
  enabled: boolean;
  autoPrompt: boolean;
  selectTranslate: boolean;
  currentProvider: string;
  currentModel: string;
  targetLang: string;
  init: () => Promise<void>;
  patch: (patch: Partial<Omit<PrefsState, 'init' | 'patch'>>) => Promise<void>;
}

const DEFAULTS = {
  enabled: true,
  autoPrompt: true,
  selectTranslate: false,
  currentProvider: 'libre-translate',
  currentModel: 'libre-translate',
  targetLang: 'zh-CN',
};

export const usePrefsStore = create<PrefsState>((set, get) => ({
  ...DEFAULTS,

  async init() {
    const data = await storageGetMany<Record<string, unknown>>('sync', Object.values(SYNC_KEYS));
    set({
      enabled: (data[SYNC_KEYS.ENABLED] as boolean | undefined) ?? DEFAULTS.enabled,
      autoPrompt: (data[SYNC_KEYS.AUTO_PROMPT] as boolean | undefined) ?? DEFAULTS.autoPrompt,
      selectTranslate:
        (data[SYNC_KEYS.SELECT_TRANSLATE] as boolean | undefined) ?? DEFAULTS.selectTranslate,
      currentProvider:
        (data[SYNC_KEYS.CURRENT_PROVIDER] as string | undefined) ?? DEFAULTS.currentProvider,
      currentModel: (data[SYNC_KEYS.CURRENT_MODEL] as string | undefined) ?? DEFAULTS.currentModel,
      targetLang: (data[SYNC_KEYS.TARGET_LANG] as string | undefined) ?? DEFAULTS.targetLang,
    });
  },

  async patch(patch) {
    const next = { ...get(), ...patch };
    set(patch);
    const mapping: Record<string, string> = {
      enabled: SYNC_KEYS.ENABLED,
      autoPrompt: SYNC_KEYS.AUTO_PROMPT,
      selectTranslate: SYNC_KEYS.SELECT_TRANSLATE,
      currentProvider: SYNC_KEYS.CURRENT_PROVIDER,
      currentModel: SYNC_KEYS.CURRENT_MODEL,
      targetLang: SYNC_KEYS.TARGET_LANG,
    };
    const payload: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(patch)) {
      const mapped = mapping[k];
      if (mapped) payload[mapped] = v;
    }
    if (Object.keys(payload).length) await storageSet('sync', payload);
    return Promise.resolve(next).then(() => undefined);
  },
}));
