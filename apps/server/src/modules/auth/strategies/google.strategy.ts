import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, type VerifyCallback } from 'passport-google-oauth20';

import { AppConfigService } from '../../../config/app-config.service';

/**
 * Google OAuth 策略骨架。
 * TODO: 替换 mock-client-id/secret 为真实凭据后启用；当前仅占位以保留调用链。
 */
@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  private readonly logger = new Logger(GoogleStrategy.name);

  constructor(config: AppConfigService) {
    super({
      clientID: config.get('GOOGLE_OAUTH_CLIENT_ID') || 'mock-client-id',
      clientSecret: config.get('GOOGLE_OAUTH_CLIENT_SECRET') || 'mock-client-secret',
      callbackURL: `${config.get('OAUTH_CALLBACK_BASE_URL')}/auth/oauth/google/callback`,
      scope: ['email', 'profile'],
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: { id: string; emails?: { value: string }[]; displayName?: string },
    done: VerifyCallback,
  ): Promise<void> {
    // TODO: 集成真实 Google OAuth 后，根据 profile 查/建用户并签发 JWT
    this.logger.warn('Google OAuth 仅为骨架，未连接真实账号体系');
    const mockUser = {
      provider: 'google',
      providerId: profile.id,
      email: profile.emails?.[0]?.value ?? '',
      displayName: profile.displayName ?? '',
    } as unknown as Express.User;
    done(null, mockUser);
  }
}
