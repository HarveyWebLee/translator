import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Env } from './env.validation';

/**
 * 强类型 ConfigService 包装，提供命名属性而非字符串 key。
 */
@Injectable()
export class AppConfigService {
  constructor(private readonly config: ConfigService<Env, true>) {}

  get<K extends keyof Env>(key: K): Env[K] {
    return this.config.get(key, { infer: true });
  }

  get port(): number {
    return this.get('PORT');
  }

  get isProd(): boolean {
    return this.get('NODE_ENV') === 'production';
  }

  get corsOrigins(): (string | RegExp)[] {
    return this.get('CORS_ORIGINS')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((origin) => {
        if (origin.includes('*')) {
          return new RegExp('^' + origin.replace(/\*/g, '.*') + '$');
        }
        return origin;
      });
  }

  get jwtSecret(): string {
    return this.get('JWT_SECRET');
  }

  get jwtAccessTtl(): number {
    return this.get('JWT_ACCESS_TTL_SEC');
  }

  get jwtRefreshTtl(): number {
    return this.get('JWT_REFRESH_TTL_SEC');
  }

  systemApiKey(providerId: string): string {
    switch (providerId) {
      case 'deepseek':
        return this.get('DEEPSEEK_API_KEY');
      case 'openai':
        return this.get('OPENAI_API_KEY');
      case 'anthropic':
        return this.get('ANTHROPIC_API_KEY');
      default:
        return '';
    }
  }
}
