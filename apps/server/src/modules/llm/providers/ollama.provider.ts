import { Injectable, Logger } from '@nestjs/common';

import { AppConfigService } from '../../../config/app-config.service';
import { ModelCatalog } from '../catalog/model.catalog';

import type {
  ChatMessage,
  ChatOptions,
  ChatResult,
  ChatStreamChunk,
  LlmProvider,
} from '@translator/llm-core';
import type { ProviderDescriptor } from '@translator/shared-types';

/**
 * Ollama 本地推理 Provider。
 * 走 HTTP /api/chat 接口，stream=true 时按行解析 JSON。
 */
@Injectable()
export class OllamaProvider implements LlmProvider {
  readonly id = 'ollama';
  private readonly logger = new Logger(OllamaProvider.name);

  constructor(
    private readonly config: AppConfigService,
    private readonly catalog: ModelCatalog,
  ) {}

  describe(): ProviderDescriptor {
    return this.catalog.all().find((p) => p.id === this.id)!;
  }

  private get baseUrl(): string {
    return this.config.get('OLLAMA_BASE_URL');
  }

  async chat(messages: ChatMessage[], opts: ChatOptions): Promise<ChatResult> {
    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: opts.model,
        messages,
        stream: false,
        options: { temperature: opts.temperature },
      }),
      signal: opts.signal,
    });
    if (!res.ok) {
      throw new Error(`Ollama 请求失败: ${res.status}`);
    }
    const data = (await res.json()) as { message?: { content?: string } };
    return { content: data.message?.content ?? '' };
  }

  async *chatStream(messages: ChatMessage[], opts: ChatOptions): AsyncIterable<ChatStreamChunk> {
    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: opts.model,
        messages,
        stream: true,
        options: { temperature: opts.temperature },
      }),
      signal: opts.signal,
    });
    if (!res.ok || !res.body) throw new Error(`Ollama 请求失败: ${res.status}`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line) as { message?: { content?: string }; done?: boolean };
          if (parsed.message?.content) {
            yield { delta: parsed.message.content, finishReason: parsed.done ? 'stop' : null };
          }
        } catch (e) {
          this.logger.warn(`Ollama 行解析失败: ${(e as Error).message}`);
        }
      }
    }
  }
}
