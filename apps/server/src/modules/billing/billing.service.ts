import { Injectable, Logger } from '@nestjs/common';
import { SubscriptionStatus, Tier } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import type { SubscribeDto } from './dto/subscribe.dto';

/**
 * 订阅服务骨架：
 * - 本期不接入真实支付 SDK
 * - 创建订阅时即写入 PENDING，由 webhook（或开发期管理接口）置为 ACTIVE
 * - ACTIVE 时回写 User.tier 与 tierExpiresAt
 */
@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createSubscription(userId: string, dto: SubscribeDto) {
    // dto.tier 已通过 DTO 限定为 BASIC/PREMIUM，FREE 等级在前端拦截
    const now = new Date();
    const expires = new Date(now.getTime() + dto.durationDays * 24 * 60 * 60 * 1000);
    const sub = await this.prisma.subscription.create({
      data: {
        userId,
        tier: dto.tier as Tier,
        status: SubscriptionStatus.PENDING,
        startsAt: now,
        expiresAt: expires,
        provider: dto.provider ?? 'mock',
      },
    });
    // TODO: 调起支付 SDK（Stripe / 支付宝 / 微信），获取支付链接
    this.logger.warn(`[Billing] 创建订阅 ${sub.id} PENDING（支付 SDK 未接入）`);
    return {
      subscriptionId: sub.id,
      payUrl: `https://example.com/pay/mock/${sub.id}`,
      note: '支付 SDK 未接入，开发期可调用 /billing/admin/activate 直接激活',
    };
  }

  /**
   * 开发期管理接口：手动激活订阅，回写 User.tier。
   * 生产应改为支付回调驱动。
   */
  async adminActivate(subscriptionId: string) {
    const sub = await this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: { status: SubscriptionStatus.ACTIVE },
    });
    await this.prisma.user.update({
      where: { id: sub.userId },
      data: { tier: sub.tier, tierExpiresAt: sub.expiresAt },
    });
    return { ok: true, subscriptionId, tier: sub.tier, expiresAt: sub.expiresAt };
  }
}
