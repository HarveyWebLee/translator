import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';

import type {
  ChatMessage,
  ChatOptions,
  ChatResult,
  ChatStreamChunk,
} from '@translator/llm-core';
import type { ModelDescriptor } from '@translator/shared-types';

import { AppConfigService } from '../../config/app-config.service';

import { ModelCatalog } from './catalog/model.catalog';
import { ProviderRegistry } from './registry/provider.registry';

export interface LlmChatInput {
  providerId: string;
  modelId: string;
  /** 用户自带 Key；仅当 model.keySource === 'user' 时使用 */
  userApiKey?: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'text' | 'json_object';
  signal?: AbortSignal;
}

@Injectable()
export class LlmService {
  constructor(
    private readonly registry: ProviderRegistry,
    private readonly catalog: ModelCatalog,
    private readonly config: AppConfigService,
  ) {}

  /** 根据 modelId 解析使用的 Key */
  resolveKey(model: ModelDescriptor, userApiKey?: string): string | undefined {
    if (model.keySource === 'none') return undefined;
    if (model.keySource === 'system') {
      const k = this.config.systemApiKey(model.providerId);
      if (!k) throw new ForbiddenException(`服务端未配置 ${model.providerId} 的系统 Key`);
      return k;
    }
    // user
    if (!userApiKey || !userApiKey.trim()) {
      throw new BadRequestException(`模型 ${model.id} 需要您在前端填写 API Key`);
    }
    return userApiKey.trim();
  }

  resolveModel(modelId: string): ModelDescriptor {
    const m = this.catalog.findModel(modelId);
    if (!m) throw new BadRequestException(`未知模型: ${modelId}`);
    return m;
  }

  async chat(input: LlmChatInput): Promise<ChatResult> {
    const model = this.resolveModel(input.modelId);
    const provider = this.registry.get(model.providerId);
    if (!this.registry.isLlm(provider)) {
      throw new BadRequestException(`${model.providerId} 不支持 chat`);
    }
    const apiKey = this.resolveKey(model, input.userApiKey);
    const opts: ChatOptions = {
      model: model.id,
      temperature: input.temperature ?? model.defaultTemperature ?? 0.3,
      maxTokens: input.maxTokens,
      responseFormat: input.responseFormat,
      signal: input.signal,
    };
    return provider.chat(input.messages, opts, apiKey);
  }

  async *chatStream(input: LlmChatInput): AsyncIterable<ChatStreamChunk> {
    const model = this.resolveModel(input.modelId);
    const provider = this.registry.get(model.providerId);
    if (!this.registry.isLlm(provider) || !provider.chatStream) {
      throw new BadRequestException(`${model.providerId} 不支持流式 chat`);
    }
    const apiKey = this.resolveKey(model, input.userApiKey);
    const opts: ChatOptions = {
      model: model.id,
      temperature: input.temperature ?? model.defaultTemperature ?? 0.3,
      maxTokens: input.maxTokens,
      signal: input.signal,
    };
    yield* provider.chatStream(input.messages, opts, apiKey);
  }

  async translateSimple(modelId: string, text: string, target = 'zh-CN'): Promise<string> {
    const model = this.resolveModel(modelId);
    const provider = this.registry.get(model.providerId);
    if (!this.registry.isSimple(provider)) {
      throw new BadRequestException(`${model.providerId} 不是简单翻译引擎`);
    }
    return provider.translate(text, { target });
  }
}
