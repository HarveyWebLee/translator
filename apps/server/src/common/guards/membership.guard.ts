import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { isTierAtLeast } from '@translator/shared-types';

import { REQUIRE_TIER_KEY } from '../decorators/require-tier.decorator';

import type { MembershipTier } from '@translator/shared-types';

/**
 * 会员等级守卫：依据 @RequireTier 元数据，校验当前用户 tier 是否达标。
 */
@Injectable()
export class MembershipGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<MembershipTier | undefined>(
      REQUIRE_TIER_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required) return true;

    const user = context.switchToHttp().getRequest<{ user?: Express.User }>().user;
    if (!user) throw new ForbiddenException('未登录');

    const actual = user.tier.toLowerCase() as MembershipTier;
    if (!isTierAtLeast(actual, required)) {
      throw new ForbiddenException(`需要 ${required} 等级，当前为 ${actual}`);
    }
    return true;
  }
}
