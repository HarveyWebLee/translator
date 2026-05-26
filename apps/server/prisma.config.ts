/**
 * Prisma 7 CLI 配置：数据库连接、迁移目录、schema 入口。
 * 运行 `prisma migrate` / `prisma studio` 等命令时由 CLI 读取；应用运行时仍通过 Nest AppConfigService + adapter 连接。
 */
import 'dotenv/config';

import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    /** Prisma 7 需显式 `pnpm prisma:seed`，migrate 不会自动执行 */
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
