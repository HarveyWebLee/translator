import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { AppConfigService } from '../../../config/app-config.service';
import { PrismaService } from '../../prisma/prisma.service';

import type { Tier } from '../../../prisma-types';

interface JwtPayload {
  sub: string;
  email: string;
  tier: Tier;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: AppConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        // SSE：允许 ?token=... 兜底（Chrome 扩展无法在 EventSource 中设置 header）
        (req): string | null => {
          const q = (req?.query as Record<string, string> | undefined)?.token;
          return typeof q === 'string' && q.length > 0 ? q : null;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: config.jwtSecret,
    });
  }

  async validate(payload: JwtPayload): Promise<Express.User> {
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) throw new UnauthorizedException('用户不存在');
    return { id: user.id, email: user.email, tier: user.tier };
  }
}
