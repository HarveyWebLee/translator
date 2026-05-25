import type { Tier } from '@prisma/client';

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
