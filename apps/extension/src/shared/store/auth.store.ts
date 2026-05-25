import { create } from 'zustand';

import { authApi } from '../api/auth';
import { ApiError } from '../api/client';
import { storageGet, storageRemove, storageSet } from '../storage/chrome-storage';
import { LOCAL_KEYS } from '../storage/keys';

import type { UserProfile } from '@translator/shared-types';

interface AuthState {
  user: UserProfile | null;
  loading: boolean;
  init: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, nickname?: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,

  async init() {
    const token = await storageGet<string>('local', LOCAL_KEYS.ACCESS_TOKEN);
    if (!token) {
      set({ user: null, loading: false });
      return;
    }
    try {
      const user = await authApi.me();
      set({ user, loading: false });
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        await storageRemove('local', [LOCAL_KEYS.ACCESS_TOKEN, LOCAL_KEYS.REFRESH_TOKEN]);
      }
      set({ user: null, loading: false });
    }
  },

  async login(email, password) {
    const tokens = await authApi.login({ email, password });
    await storageSet('local', {
      [LOCAL_KEYS.ACCESS_TOKEN]: tokens.accessToken,
      [LOCAL_KEYS.REFRESH_TOKEN]: tokens.refreshToken,
    });
    const user = await authApi.me();
    set({ user });
  },

  async register(email, password, nickname) {
    const tokens = await authApi.register({ email, password, nickname });
    await storageSet('local', {
      [LOCAL_KEYS.ACCESS_TOKEN]: tokens.accessToken,
      [LOCAL_KEYS.REFRESH_TOKEN]: tokens.refreshToken,
    });
    const user = await authApi.me();
    set({ user });
  },

  async logout() {
    try {
      await authApi.logout();
    } catch {
      /* ignore */
    }
    await storageRemove('local', [LOCAL_KEYS.ACCESS_TOKEN, LOCAL_KEYS.REFRESH_TOKEN]);
    set({ user: null });
  },

  async refresh() {
    const user = await authApi.me();
    set({ user });
  },
}));
