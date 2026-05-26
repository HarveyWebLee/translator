import { ForbiddenException, Injectable, Logger } from '@nestjs/common';

import { Tier } from '../../prisma-types';
import { PrismaService } from '../prisma/prisma.service';

/**
 * 三档配额（字符/月）。可在 .env 或后续移到运营平台。
 */
const QUOTA_BY_TIER: Record<Tier, number | null> = {
  FREE: 50_000,
  BASIC: 1_000_000,
  PREMIUM: 10_000_000,
};

@Injectable()
export class QuotaService {
  private readonly logger = new Logger(QuotaService.name);

  constructor(private readonly prisma: PrismaService) {}

  getQuotaForTier(tier: Tier): number | null {
    return QUOTA_BY_TIER[tier];
  }

  /** 当月已用字符数 */
  async getUsedCharsThisPeriod(userId: string): Promise<number> {
    const start = startOfMonth();
    const agg = await this.prisma.usageLog.aggregate({
      where: { userId, createdAt: { gte: start } },
      _sum: { chars: true },
    });
    return agg._sum.chars ?? 0;
  }

  async assertWithinQuota(userId: string, tier: Tier, addChars: number): Promise<void> {
    const limit = this.getQuotaForTier(tier);
    if (limit == null) return;
    const used = await this.getUsedCharsThisPeriod(userId);
    if (used + addChars > limit) {
      throw new ForbiddenException(
        `本月翻译配额已用尽（${used}/${limit}），请升级会员或等待下月重置`,
      );
    }
  }

  async record(input: {
    userId: string;
    tier: Tier;
    providerId: string;
    modelId: string;
    chars: number;
    tokens?: number;
  }): Promise<void> {
    await this.prisma.usageLog.create({ data: input });
  }
}

function startOfMonth(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
