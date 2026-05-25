import { randomBytes, createHash } from 'node:crypto';

import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Tier } from '@prisma/client';
import * as argon2 from 'argon2';

import { AppConfigService } from '../../config/app-config.service';
import { PrismaService } from '../prisma/prisma.service';

import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';
import type { AuthTokens, UserProfile } from '@translator/shared-types';

interface JwtPayload {
  sub: string;
  email: string;
  tier: Tier;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: AppConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthTokens> {
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (exists) throw new ConflictException('邮箱已注册');

    const passwordHash = await argon2.hash(dto.password);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        nickname: dto.nickname ?? null,
        tier: Tier.FREE,
      },
    });
    return this.issueTokens(user.id, user.email, user.tier);
  }

  async login(dto: LoginDto): Promise<AuthTokens> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || !user.passwordHash) throw new UnauthorizedException('邮箱或密码错误');
    const ok = await argon2.verify(user.passwordHash, dto.password);
    if (!ok) throw new UnauthorizedException('邮箱或密码错误');
    return this.issueTokens(user.id, user.email, user.tier);
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    const tokenHash = this.hashToken(refreshToken);
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (!record || record.revokedAt || record.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token 无效');
    }
    // 撤销旧 token，签发新 token（refresh rotation）
    await this.prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date() },
    });
    return this.issueTokens(record.user.id, record.user.email, record.user.tier);
  }

  async logout(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async getProfile(userId: string): Promise<UserProfile> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return {
      id: user.id,
      email: user.email,
      nickname: user.nickname,
      tier: user.tier.toLowerCase() as UserProfile['tier'],
      tierExpiresAt: user.tierExpiresAt?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(),
    };
  }

  /**
   * 内部签发 access + refresh，refresh 持久化（hash 形式）以便撤销。
   */
  private async issueTokens(userId: string, email: string, tier: Tier): Promise<AuthTokens> {
    const accessTtl = this.config.jwtAccessTtl;
    const refreshTtl = this.config.jwtRefreshTtl;

    const payload: JwtPayload = { sub: userId, email, tier };
    const accessToken = await this.jwt.signAsync(payload, { expiresIn: `${accessTtl}s` });

    const refreshToken = randomBytes(48).toString('base64url');
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: this.hashToken(refreshToken),
        expiresAt: new Date(Date.now() + refreshTtl * 1000),
      },
    });

    return { accessToken, refreshToken, expiresIn: accessTtl };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
