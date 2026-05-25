export interface TranslateSegment {
  /** 段索引，用于回填 DOM */
  index: number;
  /** 待译英文文本 */
  text: string;
}

export interface TranslateBatchRequest {
  providerId: string;
  modelId: string;
  /** 当 model.keySource === 'user' 时必填 */
  userApiKey?: string;
  segments: TranslateSegment[];
  targetLang?: string;
}

export interface TranslateBatchResponse {
  translations: string[];
  /** 字符消耗（用于计费/限流提示） */
  usedChars: number;
}

export interface TranslateSelectionRequest {
  providerId: string;
  modelId: string;
  userApiKey?: string;
  text: string;
  context?: string;
}

export interface TranslateSelectionResponse {
  term: string;
  phonetic: string;
  partOfSpeech: string;
  briefDefinition: string;
  exampleEn: string;
  exampleZh: string;
  contextExplanation: string;
}

/** SSE 流式返回的事件载荷 */
export type TranslateStreamEvent =
  | { type: 'chunk'; segmentIndex: number; delta: string }
  | { type: 'segment-done'; segmentIndex: number; text: string }
  | { type: 'done'; usedChars: number }
  | { type: 'error'; message: string };
