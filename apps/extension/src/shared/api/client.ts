import { API_BASE_URL } from '../env';
import { storageGet, storageSet } from '../storage/chrome-storage';
import { LOCAL_KEYS } from '../storage/keys';

import type { ApiResponse } from '@translator/shared-types';

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** 不附加 Authorization */
  anonymous?: boolean;
  /** 401 时是否自动 refresh 一次 */
  noRetry?: boolean;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

async function getAccessToken(): Promise<string | undefined> {
  return storageGet<string>('local', LOCAL_KEYS.ACCESS_TOKEN);
}

async function tryRefresh(): Promise<string | null> {
  const refreshToken = await storageGet<string>('local', LOCAL_KEYS.REFRESH_TOKEN);
  if (!refreshToken) return null;
  const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as ApiResponse<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  }>;
  if (!json.ok) return null;
  await storageSet('local', {
    [LOCAL_KEYS.ACCESS_TOKEN]: json.data.accessToken,
    [LOCAL_KEYS.REFRESH_TOKEN]: json.data.refreshToken,
  });
  return json.data.accessToken;
}

/**
 * 统一封装 fetch：
 * - 自动附加 Bearer token
 * - 401 时自动刷新一次
 * - 拆包 { ok, data }
 */
export async function apiRequest<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const headers = new Headers(opts.headers);
  headers.set('content-type', 'application/json');

  if (!opts.anonymous) {
    const token = await getAccessToken();
    if (token) headers.set('authorization', `Bearer ${token}`);
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    signal: opts.signal,
  });

  if (res.status === 401 && !opts.anonymous && !opts.noRetry) {
    const newToken = await tryRefresh();
    if (newToken) {
      return apiRequest<T>(path, { ...opts, noRetry: true });
    }
  }

  const text = await res.text();
  let json: ApiResponse<T> | undefined;
  try {
    json = text ? (JSON.parse(text) as ApiResponse<T>) : undefined;
  } catch {
    /* fallthrough */
  }

  if (!res.ok || !json || !json.ok) {
    const err = json && !json.ok ? json.error : { code: `HTTP_${res.status}`, message: text };
    throw new ApiError(res.status, err.code, err.message);
  }
  return json.data;
}
