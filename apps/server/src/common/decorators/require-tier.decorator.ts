import { SetMetadata } from '@nestjs/common';

import type { MembershipTier } from '@translator/shared-types';

export const REQUIRE_TIER_KEY = 'requireTier';

/**
 * 声明路由所需的最低会员等级，配合 MembershipGuard 使用。
 */
export const RequireTier = (
  tier: MembershipTier,
): MethodDecorator & ClassDecorator => SetMetadata(REQUIRE_TIER_KEY, tier);
