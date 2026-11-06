import type { RequestHandler } from 'express';
import type { AuthStore } from '../auth/service.js';
import { sessionIdFromCookieHeader } from '../auth/session-cookie.js';
import type { Clock } from '../platform/clock.js';
import { AppError } from '../platform/errors.js';
import './principal.js';

// Authenticates from the session cookie only. Headers, query and body are never identity.
export function createRequireAuth(store: Pick<AuthStore, 'findSessionUser'>, clock: Clock): RequestHandler {
  return async (req, _res, next) => {
    const id = sessionIdFromCookieHeader(req.get('Cookie'));
    const user = id ? await store.findSessionUser(id, clock.now()) : null;
    if (!user) throw AppError.unauthenticated();
    req.principal = { userId: user.id, role: user.role };
    next();
  };
}
