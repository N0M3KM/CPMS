import type { Role } from '@prisma/client';
import type { RequestHandler } from 'express';
import { AppError } from '../platform/errors.js';
import './principal.js';

// Must run after requireAuth. The role check comes before any team check (403 before 404).
export function requireRole(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.principal) throw AppError.unauthenticated();
    if (!roles.includes(req.principal.role)) throw AppError.forbidden();
    next();
  };
}
