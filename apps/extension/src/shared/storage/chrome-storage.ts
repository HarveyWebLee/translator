/**
 * chrome.storage 的最小封装，区分 local 与 sync。
 * - local：access/refresh token、用户自带 API Key（敏感数据，不跨设备）
 * - sync：偏好设置（自动提示、默认模型 id 等）
 *
 * 开发时在普通浏览器标签打开 popup/options（localhost:9696）没有 chrome.storage，
 * 会自动降级到 localStorage，便于 UI 调试与登录联调。
 */

import { isChromeExtensionContext } from '../utils/extension-context';

type Area = 'local' | 'sync';

const DEV_PREFIX: Record<Area, string> = {
  local: 'translator:dev:local:',
  sync: 'translator:dev:sync:',
};

function normalizeKeys(keys: string | string[] | null | Record<string, unknown>): string[] {
  if (keys === null) {
    return Object.keys(localStorage).filter((k) => k.startsWith('translator:dev:'));
  }
  if (typeof keys === 'string') return [keys];
  if (Array.isArray(keys)) return keys;
  return Object.keys(keys);
}

/** 用 localStorage 模拟 chrome.storage.StorageArea，仅 dev 降级路径使用 */
function createDevStorageArea(name: Area): chrome.storage.StorageArea {
  const prefix = DEV_PREFIX[name];

  const areaImpl = {
    get(
      keys: string | string[] | Record<string, unknown> | null,
      callback: (items: Record<string, unknown>) => void,
    ) {
      const keyList = normalizeKeys(keys);
      const data: Record<string, unknown> = {};
      for (const key of keyList) {
        const raw = localStorage.getItem(`${prefix}${key}`);
        if (raw === null) continue;
        try {
          data[key] = JSON.parse(raw) as unknown;
        } catch {
          data[key] = raw;
        }
      }
      callback(data);
    },
    set(items: Record<string, unknown>, callback?: () => void) {
      for (const [key, value] of Object.entries(items)) {
        localStorage.setItem(`${prefix}${key}`, JSON.stringify(value));
      }
      callback?.();
    },
    remove(keys: string | string[], callback?: () => void) {
      for (const key of normalizeKeys(keys)) {
        localStorage.removeItem(`${prefix}${key}`);
      }
      callback?.();
    },
    clear(callback?: () => void) {
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith(prefix)) localStorage.removeItem(key);
      }
      callback?.();
    },
    getBytesInUse(_keys: string | string[] | null, callback: (bytes: number) => void) {
      callback(0);
    },
    setAccessLevel(_options: chrome.storage.AccessLevel, callback?: () => void) {
      callback?.();
    },
    onChanged: {
      addListener: () => undefined,
      removeListener: () => undefined,
      hasListener: () => false,
      hasListeners: () => false,
    },
  };

  return areaImpl as unknown as chrome.storage.StorageArea;
}

function area(name: Area): chrome.storage.StorageArea {
  if (isChromeExtensionContext() && chrome.storage?.[name]) {
    return chrome.storage[name];
  }
  return createDevStorageArea(name);
}

export async function storageGet<T = unknown>(name: Area, key: string): Promise<T | undefined> {
  return new Promise((resolve) => {
    area(name).get([key], (data) => resolve(data[key] as T | undefined));
  });
}

export async function storageGetMany<T extends Record<string, unknown>>(
  name: Area,
  keys: string[],
): Promise<Partial<T>> {
  return new Promise((resolve) => {
    area(name).get(keys, (data) => resolve(data as Partial<T>));
  });
}

export async function storageSet(name: Area, items: Record<string, unknown>): Promise<void> {
  return new Promise((resolve) => area(name).set(items, () => resolve()));
}

export async function storageRemove(name: Area, keys: string | string[]): Promise<void> {
  return new Promise((resolve) => area(name).remove(keys, () => resolve()));
}
