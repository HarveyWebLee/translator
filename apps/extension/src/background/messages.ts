/**
 * background ↔ content / popup 之间消息类型。
 */

import type {
  TranslateBatchRequest,
  TranslateSelectionRequest,
  TranslateSelectionResponse,
  TranslateStreamEvent,
} from '@translator/shared-types';

export type BgMessage =
  | { type: 'GET_SETTINGS' }
  | { type: 'TRANSLATE_BATCH'; payload: TranslateBatchRequest }
  | { type: 'TRANSLATE_SELECTION'; payload: TranslateSelectionRequest }
  | { type: 'START_TRANSLATE_STREAM'; payload: TranslateBatchRequest; streamId: string }
  | { type: 'ABORT_TRANSLATE_STREAM'; streamId: string }
  | { type: 'SHOW_TRANSLATE_BAR' }
  | { type: 'RUN_DETECT' };

export interface SettingsResponse {
  enabled: boolean;
  autoPrompt: boolean;
  selectTranslate: boolean;
  hasAuth: boolean;
  tier: 'free' | 'basic' | 'premium';
  currentProvider: string;
  currentModel: string;
}

/** content 监听到的流事件（由 background 通过 sendMessage 推送） */
export interface StreamEnvelope {
  type: 'TRANSLATE_STREAM_EVENT';
  streamId: string;
  event: TranslateStreamEvent;
}

/** 划词翻译结果包装（非流式） */
export interface SelectionEnvelope {
  type: 'TRANSLATE_SELECTION_RESULT';
  data: TranslateSelectionResponse;
}
