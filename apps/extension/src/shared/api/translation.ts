import { apiRequest } from './client';

import type {
  TranslateBatchRequest,
  TranslateBatchResponse,
  TranslateSelectionRequest,
  TranslateSelectionResponse,
} from '@translator/shared-types';

export const translationApi = {
  batch(payload: TranslateBatchRequest): Promise<TranslateBatchResponse> {
    return apiRequest('/translation/batch', { method: 'POST', body: payload });
  },
  selection(payload: TranslateSelectionRequest): Promise<TranslateSelectionResponse> {
    return apiRequest('/translation/selection', { method: 'POST', body: payload });
  },
  createStreamSession(payload: TranslateBatchRequest): Promise<{ sessionId: string }> {
    return apiRequest('/translation/stream/session', { method: 'POST', body: payload });
  },
};
