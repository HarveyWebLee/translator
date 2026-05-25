import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-github2';

import { AppConfigService } from '../../../config/app-config.service';

/**
 * GitHub OAuth 策略骨架。TODO: 集成真实凭据。
 */
@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
  private readonly logger = new Logger(GithubStrategy.name);

  constructor(config: AppConfigService) {
    super({
      clientID: config.get('GITHUB_OAUTH_CLIENT_ID') || 'mock-client-id',
      clientSecret: config.get('GITHUB_OAUTH_CLIENT_SECRET') || 'mock-client-secret',
      callbackURL: `${config.get('OAUTH_CALLBACK_BASE_URL')}/auth/oauth/github/callback`,
      scope: ['user:email'],
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: { id: string; username?: string; emails?: { value: string }[] },
    done: (err: Error | null, user?: unknown) => void,
  ): Promise<void> {
    this.logger.warn('GitHub OAuth 仅为骨架，未连接真实账号体系');
    done(null, {
      provider: 'github',
      providerId: profile.id,
      email: profile.emails?.[0]?.value ?? '',
      displayName: profile.username ?? '',
    });
  }
}
