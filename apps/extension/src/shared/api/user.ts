import { apiRequest } from './client';

import type { MembershipState } from '@translator/shared-types';

export const userApi = {
  membership(): Promise<MembershipState> {
    return apiRequest('/user/membership');
  },
};
