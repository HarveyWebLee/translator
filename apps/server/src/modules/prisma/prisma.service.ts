import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';

import { AppConfigService } from '../../config/app-config.service';
import { PrismaClient } from '../../prisma-types';

/**
 * Prisma 7 必须通过 driver adapter 连接 PostgreSQL（不再使用 Rust 查询引擎）。
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(appConfig: AppConfigService) {
    const adapter = new PrismaPg({
      connectionString: appConfig.get('DATABASE_URL'),
    });
    super({ adapter });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Prisma 已连接');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
