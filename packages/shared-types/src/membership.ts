/**
 * 会员等级体系。
 * - free：仅可使用免费翻译引擎（Google 公开端点 / LibreTranslate）
 * - basic：使用通用 LLM，API Key 由用户自带（保存浏览器本地）
 * - premium：使用高级 LLM，API Key 由后端持有（开发者赞助）
 */
export type MembershipTier = 'free' | 'basic' | 'premium';

export const MEMBERSHIP_TIER_RANK: Record<MembershipTier, number> = {
  free: 0,
  basic: 1,
  premium: 2,
};

export function isTierAtLeast(actual: MembershipTier, required: MembershipTier): boolean {
  return MEMBERSHIP_TIER_RANK[actual] >= MEMBERSHIP_TIER_RANK[required];
}

export interface MembershipState {
  tier: MembershipTier;
  /** ISO 时间，premium/basic 订阅过期时间；free 为 null */
  expiresAt: string | null;
  /** 当期已用字符数 */
  usedChars: number;
  /** 当期配额上限；null 表示无显式上限（仍受限流保护） */
  quotaChars: number | null;
}
