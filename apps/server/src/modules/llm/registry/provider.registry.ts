import { Inject, Injectable, NotFoundException } from '@nestjs/common';

import { LLM_PROVIDERS_TOKEN } from '../llm.tokens';

import type { LlmProvider, SimpleTranslator } from '@translator/llm-core';

type AnyProvider = LlmProvider | SimpleTranslator;

@Injectable()
export class ProviderRegistry {
  private readonly map = new Map<string, AnyProvider>();

  constructor(@Inject(LLM_PROVIDERS_TOKEN) providers: AnyProvider[]) {
    for (const p of providers) {
      this.map.set(p.id, p);
    }
  }

  get(id: string): AnyProvider {
    const p = this.map.get(id);
    if (!p) throw new NotFoundException(`Provider 不存在: ${id}`);
    return p;
  }

  isLlm(p: AnyProvider): p is LlmProvider {
    return 'chat' in p && typeof p.chat === 'function';
  }

  isSimple(p: AnyProvider): p is SimpleTranslator {
    return 'translate' in p && typeof p.translate === 'function';
  }
}
