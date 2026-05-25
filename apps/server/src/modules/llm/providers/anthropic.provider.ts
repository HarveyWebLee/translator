import Anthropic from '@anthropic-ai/sdk';
import { Injectable, Logger } from '@nestjs/common';

import type {
  ChatMessage,
  ChatOptions,
  ChatResult,
  ChatStreamChunk,
  LlmProvider,
} from '@translator/llm-core';
import type { ProviderDescriptor } from '@translator/shared-types';

import { ModelCatalog } from '../catalog/model.catalog';

@Injectable()
export class AnthropicProvider implements LlmProvider {
  readonly id = 'anthropic';
  private readonly logger = new Logger(AnthropicProvider.name);

  constructor(private readonly catalog: ModelCatalog) {}

  describe(): ProviderDescriptor {
    return this.catalog.all().find((p) => p.id === this.id)!;
  }

  private client(apiKey?: string): Anthropic {
    if (!apiKey) throw new Error('anthropic: 缺少 API Key');
    return new Anthropic({ apiKey });
  }

  /** Anthropic Messages API：将 system 抽出来，其余作为 messages */
  private split(messages: ChatMessage[]) {
    const system = messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n\n');
    const rest = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
    return { system, rest };
  }

  async chat(messages: ChatMessage[], opts: ChatOptions, apiKey?: string): Promise<ChatResult> {
    const c = this.client(apiKey);
    const { system, rest } = this.split(messages);
    const res = await c.messages.create({
      model: opts.model,
      max_tokens: opts.maxTokens ?? 4096,
      temperature: opts.temperature,
      system,
      messages: rest,
    });
    const text = res.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
    return {
      content: text,
      usage: {
        promptTokens: res.usage.input_tokens,
        completionTokens: res.usage.output_tokens,
        totalTokens: res.usage.input_tokens + res.usage.output_tokens,
      },
    };
  }

  async *chatStream(
    messages: ChatMessage[],
    opts: ChatOptions,
    apiKey?: string,
  ): AsyncIterable<ChatStreamChunk> {
    const c = this.client(apiKey);
    const { system, rest } = this.split(messages);
    const stream = c.messages.stream({
      model: opts.model,
      max_tokens: opts.maxTokens ?? 4096,
      temperature: opts.temperature,
      system,
      messages: rest,
    });
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield { delta: event.delta.text, finishReason: null };
      }
    }
    yield { delta: '', finishReason: 'stop' };
  }
}
