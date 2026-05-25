import { apiRequest } from './client';

import type {
  AuthTokens,
  LoginRequest,
  RegisterRequest,
  UserProfile,
} from '@translator/shared-types';

export const authApi = {
  register(payload: RegisterRequest): Promise<AuthTokens> {
    return apiRequest('/auth/register', { method: 'POST', body: payload, anonymous: true });
  },
  login(payload: LoginRequest): Promise<AuthTokens> {
    return apiRequest('/auth/login', { method: 'POST', body: payload, anonymous: true });
  },
  refresh(refreshToken: string): Promise<AuthTokens> {
    return apiRequest('/auth/refresh', {
      method: 'POST',
      body: { refreshToken },
      anonymous: true,
    });
  },
  me(): Promise<UserProfile> {
    return apiRequest('/auth/me');
  },
  logout(): Promise<void> {
    return apiRequest('/auth/logout', { method: 'POST' });
  },
};
