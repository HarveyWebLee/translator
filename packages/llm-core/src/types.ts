export type ChatRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ChatOptions {
  model: string;
  temperature?: number;
  maxTokens?: number;
  /** 强制 JSON 输出 */
  responseFormat?: 'text' | 'json_object';
  /** AbortSignal 用于中断请求 */
  signal?: AbortSignal;
}

export interface ChatUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ChatResult {
  content: string;
  usage?: ChatUsage;
}

/** 流式调用产出的增量片段 */
export interface ChatStreamChunk {
  delta: string;
  /** 模型结束原因（OpenAI 兼容） */
  finishReason?: 'stop' | 'length' | 'content_filter' | null;
}
