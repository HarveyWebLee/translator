import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { QuotaService } from '../quota/quota.service';

import type { MembershipState } from '@translator/shared-types';

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly quota: QuotaService,
  ) {}

  async getMembership(userId: string): Promise<MembershipState> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const used = await this.quota.getUsedCharsThisPeriod(userId);
    const quota = this.quota.getQuotaForTier(user.tier);

    return {
      tier: user.tier.toLowerCase() as MembershipState['tier'],
      expiresAt: user.tierExpiresAt?.toISOString() ?? null,
      usedChars: used,
      quotaChars: quota,
    };
  }
}
