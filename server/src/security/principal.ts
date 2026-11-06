import type { Role } from '@prisma/client';

// The authenticated caller, derived only from the server-side session.
export interface Principal {
  userId: string;
  role: Role;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      principal?: Principal;
    }
  }
}
