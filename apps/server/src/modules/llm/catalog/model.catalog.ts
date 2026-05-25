import { Injectable } from '@nestjs/common';

import type { ModelDescriptor, ProviderDescriptor } from '@translator/shared-types';
import { isTierAtLeast } from '@translator/shared-types';
import type { MembershipTier } from '@translator/shared-types';

/**
 * 模型目录：声明每个模型的 minTier、keySource、能力。
 * 后续可改为从数据库或配置中心读取，方便运营调整。
 */
const PROVIDERS: ProviderDescriptor[] = [
  {
    id: 'google-free',
    label: 'Google 翻译（免费）',
    authMode: 'none',
    models: [
      {
        id: 'google-free',
        label: 'Google 翻译（公开端点）',
        providerId: 'google-free',
        capabilities: ['translate'],
        contextWindow: 5000,
        minTier: 'free',
        keySource: 'none',
        priceHint: '免费 · 公开端点不稳定',
      },
    ],
  },
  {
    id: 'libre-translate',
    label: 'LibreTranslate（免费）',
    authMode: 'none',
    models: [
      {
        id: 'libre-translate',
        label: 'LibreTranslate',
        providerId: 'libre-translate',
        capabilities: ['translate'],
        contextWindow: 5000,
        minTier: 'free',
        keySource: 'none',
        priceHint: '免费 · 可自托管',
      },
    ],
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    authMode: 'api-key',
    models: [
      {
        id: 'deepseek-chat',
        label: 'DeepSeek Chat',
        providerId: 'deepseek',
        capabilities: ['chat', 'json', 'stream', 'translate', 'dict'],
        contextWindow: 64_000,
        minTier: 'basic',
        keySource: 'user',
        priceHint: '通用 · 性价比高',
        defaultTemperature: 0.3,
      },
    ],
  },
  {
    id: 'openai',
    label: 'OpenAI',
    authMode: 'api-key',
    models: [
      {
        id: 'gpt-4o-mini',
        label: 'GPT-4o mini',
        providerId: 'openai',
        capabilities: ['chat', 'json', 'stream', 'translate', 'dict'],
        contextWindow: 128_000,
        minTier: 'basic',
        keySource: 'user',
        priceHint: '轻量通用',
        defaultTemperature: 0.3,
      },
      {
        id: 'gpt-4-turbo',
        label: 'GPT-4 Turbo',
        providerId: 'openai',
        capabilities: ['chat', 'json', 'stream', 'translate', 'dict'],
        contextWindow: 128_000,
        minTier: 'premium',
        keySource: 'system',
        priceHint: '高级翻译质量（开发者赞助）',
        defaultTemperature: 0.3,
      },
    ],
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    authMode: 'api-key',
    models: [
      {
        id: 'claude-3-5-haiku',
        label: 'Claude 3.5 Haiku',
        providerId: 'anthropic',
        capabilities: ['chat', 'json', 'stream', 'translate', 'dict'],
        contextWindow: 200_000,
        minTier: 'basic',
        keySource: 'user',
        priceHint: '低延迟通用',
        defaultTemperature: 0.3,
      },
      {
        id: 'claude-3-5-sonnet',
        label: 'Claude 3.5 Sonnet',
        providerId: 'anthropic',
        capabilities: ['chat', 'json', 'stream', 'translate', 'dict'],
        contextWindow: 200_000,
        minTier: 'premium',
        keySource: 'system',
        priceHint: '高质量长文翻译',
        defaultTemperature: 0.3,
      },
    ],
  },
  {
    id: 'ollama',
    label: 'Ollama（自托管）',
    authMode: 'none',
    models: [
      {
        id: 'llama3.1',
        label: 'llama3.1（Ollama）',
        providerId: 'ollama',
        capabilities: ['chat', 'translate'],
        contextWindow: 8_000,
        minTier: 'basic',
        keySource: 'none',
        priceHint: '本地推理 · 需用户运行 Ollama',
      },
    ],
  },
];

@Injectable()
export class ModelCatalog {
  /** 返回所有 Provider 与其模型（不过滤） */
  all(): ProviderDescriptor[] {
    return PROVIDERS;
  }

  /** 按会员等级过滤可见模型 */
  forTier(tier: MembershipTier): ProviderDescriptor[] {
    return PROVIDERS.map((p) => ({
      ...p,
      models: p.models.filter((m) => isTierAtLeast(tier, m.minTier)),
    })).filter((p) => p.models.length > 0);
  }

  /** 通过 modelId 查找；找不到返回 null */
  findModel(modelId: string): ModelDescriptor | null {
    for (const p of PROVIDERS) {
      const m = p.models.find((x) => x.id === modelId);
      if (m) return m;
    }
    return null;
  }
}
