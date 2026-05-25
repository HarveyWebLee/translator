/**
 * chrome.storage 的最小封装，区分 local 与 sync。
 * - local：access/refresh token、用户自带 API Key（敏感数据，不跨设备）
 * - sync：偏好设置（自动提示、默认模型 id 等）
 */

type Area = 'local' | 'sync';

function area(name: Area): chrome.storage.StorageArea {
  return chrome.storage[name];
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
