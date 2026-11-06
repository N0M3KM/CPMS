import type { Role } from '@prisma/client';
import type { Request } from 'express';
import { AppError } from '../platform/errors.js';

// The authenticated caller, derived only from the server-side session.
export interface Principal {
  userId: string;
  role: Role;
}

// Use instead of req.principal! so a missing principal is a 401, never a crash.
export function principalOf(req: Request): Principal {
  if (!req.principal) throw AppError.unauthenticated();
  return req.principal;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      principal?: Principal;
    }
  }
}
