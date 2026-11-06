import type { RequestHandler } from 'express';
import { AppError } from '../platform/errors.js';

const STATE_CHANGING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// State-changing requests must come from the app's own origin. A missing Origin is refused too.
export function createOriginCheck(allowedOrigin: string): RequestHandler {
  const allowed = new URL(allowedOrigin).origin;
  return (req, _res, next) => {
    if (STATE_CHANGING.has(req.method) && req.get('Origin') !== allowed) {
      throw AppError.forbidden('Request origin is not allowed.');
    }
    next();
  };
}
