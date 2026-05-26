/**
 * 开发环境数据库种子（幂等 upsert）。
 *
 * 执行：pnpm --filter @translator/server prisma:seed
 * Prisma 7 不会在 migrate 后自动 seed，需显式运行上述命令。
 *
 * 默认账号（密码均为 DEV_SEED_PASSWORD）：
 * - free@dev.local    → FREE
 * - basic@dev.local   → BASIC
 * - premium@dev.local → PREMIUM
 */
import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';
import * as argon2 from 'argon2';

import { PrismaClient, Tier } from '../src/generated/prisma/client';

/** 开发种子统一密码，勿用于生产 */
const DEV_SEED_PASSWORD = 'dev-password-123';

const DEV_USERS: Array<{ email: string; tier: Tier; nickname: string }> = [
  { email: 'free@dev.local', tier: Tier.FREE, nickname: '免费会员' },
  { email: 'basic@dev.local', tier: Tier.BASIC, nickname: '初级会员' },
  { email: 'premium@dev.local', tier: Tier.PREMIUM, nickname: '高级会员' },
];

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('缺少 DATABASE_URL，请先在 apps/server 配置 .env');
  }

  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });
  const passwordHash = await argon2.hash(DEV_SEED_PASSWORD);

  try {
    for (const user of DEV_USERS) {
      await prisma.user.upsert({
        where: { email: user.email },
        create: {
          email: user.email,
          nickname: user.nickname,
          tier: user.tier,
          passwordHash,
        },
        update: {
          nickname: user.nickname,
          tier: user.tier,
          passwordHash,
        },
      });
      console.log(`[seed] ${user.email} (${user.tier})`);
    }
    console.log(`[seed] 完成，统一密码: ${DEV_SEED_PASSWORD}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err: unknown) => {
  console.error('[seed] 失败:', err);
  process.exit(1);
});
