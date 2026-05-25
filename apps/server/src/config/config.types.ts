export interface AppConfig {
  nodeEnv: 'development' | 'production' | 'test';
  port: number;
  corsOrigins: string[];
  databaseUrl: string;
  jwt: {
    secret: string;
    accessTtlSec: number;
    refreshTtlSec: number;
  };
  llm: {
    deepseekApiKey: string;
    openaiApiKey: string;
    anthropicApiKey: string;
    ollamaBaseUrl: string;
  };
  freeTranslate: {
    libreBaseUrl: string;
    libreApiKey: string;
  };
  oauth: {
    googleClientId: string;
    googleClientSecret: string;
    githubClientId: string;
    githubClientSecret: string;
    callbackBaseUrl: string;
  };
  sms: {
    provider: 'mock' | 'aliyun' | 'tencent';
    apiKey: string;
    signName: string;
  };
}
