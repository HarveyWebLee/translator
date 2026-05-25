import type { MembershipTier } from './membership';

export interface RegisterRequest {
  email: string;
  password: string;
  nickname?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  /** access token 过期秒数 */
  expiresIn: number;
}

export interface UserProfile {
  id: string;
  email: string;
  nickname: string | null;
  tier: MembershipTier;
  tierExpiresAt: string | null;
  createdAt: string;
}

export interface RefreshRequest {
  refreshToken: string;
}

/** OAuth 第三方提供方 */
export type OAuthProvider = 'google' | 'github';

export interface SmsSendRequest {
  phone: string;
}

export interface SmsVerifyRequest {
  phone: string;
  code: string;
}
