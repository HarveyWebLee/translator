import { z } from 'zod';

/**
 * .env 校验 schema：缺失或非法时进程启动直接失败，避免运行期出错。
 */
export const envValidationSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(19696),
  CORS_ORIGINS: z.string().default('chrome-extension://*'),

  DATABASE_URL: z.string().url(),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET 至少 32 个字符'),
  JWT_ACCESS_TTL_SEC: z.coerce.number().int().positive().default(3600),
  JWT_REFRESH_TTL_SEC: z.coerce.number().int().positive().default(2592000),

  DEEPSEEK_API_KEY: z.string().optional().default(''),
  OPENAI_API_KEY: z.string().optional().default(''),
  ANTHROPIC_API_KEY: z.string().optional().default(''),
  OLLAMA_BASE_URL: z.string().url().optional().default('http://localhost:11434'),

  LIBRE_TRANSLATE_BASE_URL: z.string().url().default('https://libretranslate.com'),
  LIBRE_TRANSLATE_API_KEY: z.string().optional().default(''),

  GOOGLE_OAUTH_CLIENT_ID: z.string().optional().default(''),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().optional().default(''),
  GITHUB_OAUTH_CLIENT_ID: z.string().optional().default(''),
  GITHUB_OAUTH_CLIENT_SECRET: z.string().optional().default(''),
  OAUTH_CALLBACK_BASE_URL: z.string().url().default('http://localhost:19696'),

  SMS_PROVIDER: z.enum(['mock', 'aliyun', 'tencent']).default('mock'),
  SMS_API_KEY: z.string().optional().default(''),
  SMS_SIGN_NAME: z.string().optional().default(''),
});

export type Env = z.infer<typeof envValidationSchema>;
