import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { AppConfigModule } from './config/config.module';
import { AuthModule } from './modules/auth/auth.module';
import { BillingModule } from './modules/billing/billing.module';
import { HealthModule } from './modules/health/health.module';
import { LlmModule } from './modules/llm/llm.module';
import { PrismaModule } from './modules/prisma/prisma.module';
import { QuotaModule } from './modules/quota/quota.module';
import { TranslationModule } from './modules/translation/translation.module';
import { UserModule } from './modules/user/user.module';

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    AuthModule,
    UserModule,
    BillingModule,
    LlmModule,
    TranslationModule,
    QuotaModule,
    HealthModule,
  ],
  providers: [
    /**
     * 全局开启 JWT 鉴权，路由可通过 @Public() 解开。
     */
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
