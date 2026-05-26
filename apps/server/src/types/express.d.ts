import type { Tier } from '../prisma-types';

declare global {
  namespace Express {
    interface User {
      id: string;
      email: string;
      tier: Tier;
    }
  }
}

export {};
