import { apiRequest } from './client';

import type { MembershipTier, ProviderDescriptor } from '@translator/shared-types';

export interface ModelsResponse {
  providers: ProviderDescriptor[];
  userTier: MembershipTier;
}

export const llmApi = {
  models(): Promise<ModelsResponse> {
    return apiRequest('/llm/models');
  },
};
