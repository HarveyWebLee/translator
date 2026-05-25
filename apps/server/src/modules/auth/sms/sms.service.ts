import { BadRequestException, Injectable, Logger } from '@nestjs/common';

import { AppConfigService } from '../../../config/app-config.service';
import { PrismaService } from '../../prisma/prisma.service';

const CODE_TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;

/**
 * 短信验证码服务骨架。
 * - mock 模式：验证码固定 '000000'，写入 DB 用于流程演练
 * - aliyun/tencent：TODO 接入真实 SDK
 */
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
  ) {}

  async sendCode(phone: string): Promise<{ sent: true; mock?: boolean }> {
    const provider = this.config.get('SMS_PROVIDER');
    const code = provider === 'mock' ? '000000' : this.generateCode();

    await this.prisma.smsCode.upsert({
      where: { phone },
      create: {
        phone,
        code,
        expiresAt: new Date(Date.now() + CODE_TTL_MS),
      },
      update: {
        code,
        attempts: 0,
        expiresAt: new Date(Date.now() + CODE_TTL_MS),
      },
    });

    if (provider === 'mock') {
      this.logger.warn(`[SMS mock] phone=${phone} code=${code}`);
      return { sent: true, mock: true };
    }

    // TODO: 集成阿里云/腾讯云短信 SDK
    this.logger.warn(`[SMS ${provider}] 未实现，phone=${phone}`);
    return { sent: true };
  }

  async verifyCode(phone: string, code: string): Promise<true> {
    const record = await this.prisma.smsCode.findUnique({ where: { phone } });
    if (!record) throw new BadRequestException('请先获取验证码');
    if (record.expiresAt < new Date()) throw new BadRequestException('验证码已过期');
    if (record.attempts >= MAX_ATTEMPTS) throw new BadRequestException('验证次数超限');

    if (record.code !== code) {
      await this.prisma.smsCode.update({
        where: { phone },
        data: { attempts: record.attempts + 1 },
      });
      throw new BadRequestException('验证码错误');
    }
    await this.prisma.smsCode.delete({ where: { phone } });
    return true;
  }

  private generateCode(): string {
    return String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0');
  }
}
