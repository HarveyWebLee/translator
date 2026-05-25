import type { ProviderDescriptor } from '@translator/shared-types';

import type { ChatMessage, ChatOptions, ChatResult, ChatStreamChunk } from './types';

/**
 * LLM Provider 统一契约。后端各实现类需要满足此接口。
 * 前端仅在类型层引用此接口，不实现具体类。
 */
export interface LlmProvider {
  readonly id: string;

  /** 返回模型目录（含 minTier、keySource 等元数据） */
  describe(): ProviderDescriptor;

  /**
   * 非流式聊天/翻译
   * @param messages 消息数组
   * @param opts 包含 model 与温度等
   * @param apiKey 当 Provider 需要 Key 时由调度层注入
   */
  chat(messages: ChatMessage[], opts: ChatOptions, apiKey?: string): Promise<ChatResult>;

  /**
   * 流式聊天/翻译。可选实现：免费引擎可不支持。
   */
  chatStream?(
    messages: ChatMessage[],
    opts: ChatOptions,
    apiKey?: string,
  ): AsyncIterable<ChatStreamChunk>;
}

/** 简易翻译能力接口，用于免费引擎（非 LLM） */
export interface SimpleTranslator {
  readonly id: string;
  translate(text: string, opts: { source?: string; target: string }): Promise<string>;
  describe(): ProviderDescriptor;
}
