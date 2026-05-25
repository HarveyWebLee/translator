import { Module } from '@nestjs/common';

import { ModelCatalog } from './catalog/model.catalog';
import { LlmController } from './llm.controller';
import { LlmService } from './llm.service';
import { LLM_PROVIDERS_TOKEN } from './llm.tokens';
import { AnthropicProvider } from './providers/anthropic.provider';
import { DeepSeekProvider } from './providers/deepseek.provider';
import { GoogleFreeProvider } from './providers/google-free.provider';
import { LibreTranslateProvider } from './providers/libre-translate.provider';
import { OllamaProvider } from './providers/ollama.provider';
import { OpenAIProvider } from './providers/openai.provider';
import { ProviderRegistry } from './registry/provider.registry';

const providerClasses = [
  DeepSeekProvider,
  OpenAIProvider,
  AnthropicProvider,
  OllamaProvider,
  GoogleFreeProvider,
  LibreTranslateProvider,
];

@Module({
  controllers: [LlmController],
  providers: [
    ModelCatalog,
    LlmService,
    ProviderRegistry,
    ...providerClasses,
    {
      provide: LLM_PROVIDERS_TOKEN,
      useFactory: (...providers: unknown[]) => providers,
      inject: providerClasses,
    },
  ],
  exports: [LlmService, ModelCatalog, ProviderRegistry],
})
export class LlmModule {}
