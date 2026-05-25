import { Logger } from '@nestjs/common';
import OpenAI from 'openai';

import type {
  ChatMessage,
  ChatOptions,
  ChatResult,
  ChatStreamChunk,
  LlmProvider,
} from '@translator/llm-core';
import type { ProviderDescriptor } from '@translator/shared-types';

/**
 * OpenAI 兼容 Provider 基类，DeepSeek / OpenAI 等共用。
 * 子类需提供 baseURL（DeepSeek 使用 https://api.deepseek.com/v1）。
 */
export abstract class OpenAICompatibleProvider implements LlmProvider {
  protected readonly logger: Logger;

  abstract readonly id: string;
  protected abstract readonly baseURL: string | undefined;

  constructor(loggerName: string) {
    this.logger = new Logger(loggerName);
  }

  abstract describe(): ProviderDescriptor;

  private client(apiKey?: string): OpenAI {
    if (!apiKey) {
      throw new Error(`${this.id}: 缺少 API Key`);
    }
    return new OpenAI({ apiKey, baseURL: this.baseURL });
  }

  async chat(messages: ChatMessage[], opts: ChatOptions, apiKey?: string): Promise<ChatResult> {
    const c = this.client(apiKey);
    const res = await c.chat.completions.create(
      {
        model: opts.model,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        temperature: opts.temperature,
        max_tokens: opts.maxTokens,
        response_format:
          opts.responseFormat === 'json_object' ? { type: 'json_object' } : undefined,
        stream: false,
      },
      { signal: opts.signal },
    );
    return {
      content: res.choices[0]?.message?.content ?? '',
      usage: res.usage
        ? {
            promptTokens: res.usage.prompt_tokens,
            completionTokens: res.usage.completion_tokens,
            totalTokens: res.usage.total_tokens,
          }
        : undefined,
    };
  }

  async *chatStream(
    messages: ChatMessage[],
    opts: ChatOptions,
    apiKey?: string,
  ): AsyncIterable<ChatStreamChunk> {
    const c = this.client(apiKey);
    const stream = await c.chat.completions.create(
      {
        model: opts.model,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        temperature: opts.temperature,
        max_tokens: opts.maxTokens,
        stream: true,
      },
      { signal: opts.signal },
    );
    for await (const part of stream) {
      const choice = part.choices[0];
      if (!choice) continue;
      yield {
        delta: choice.delta?.content ?? '',
        finishReason: (choice.finish_reason as ChatStreamChunk['finishReason']) ?? null,
      };
    }
  }
}
