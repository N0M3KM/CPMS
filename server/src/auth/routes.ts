import { json, Router, type CookieOptions, type ErrorRequestHandler, type Request, type RequestHandler, type Response } from 'express';
import { z } from 'zod';
import type { Clock } from '../platform/clock.js';
import { clientIp, createRateLimit, rateLimited } from '../platform/rate-limit.js';
import { createAuthService, type AuthStore } from './service.js';

const COOKIE_NAME = 'cpms_session';
const COOKIE_PREFIX = `${COOKIE_NAME}=`;
const SESSION_ID = /^[A-Za-z0-9_-]{43}$/;
const loginBody = z.strictObject({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  password: z.string().min(1),
});

export interface AuthOptions {
  store: AuthStore;
  clock: Clock;
  ttlHours: number;
  secure: boolean;
  allowedOrigin: string;
}

function sessionId(cookieHeader: string | undefined): string | undefined {
  const cookies = cookieHeader?.split(';').map(cookie => cookie.trim());
  const sessions = cookies?.filter(cookie => cookie.startsWith(COOKIE_PREFIX)) ?? [];
  const value = sessions.length === 1 ? sessions[0]?.slice(COOKIE_PREFIX.length) : undefined;
  return value && SESSION_ID.test(value) ? value : undefined;
}

function error(res: Response, status: number, code: string, message: string): void {
  res.status(status).json({ error: { code, message } });
}

const requireJson: RequestHandler = (req, res, next) => {
  const mediaType = req.get('Content-Type')?.split(';', 1)[0]?.trim().toLowerCase();
  if (mediaType !== 'application/json') {
    error(res, 415, 'UNSUPPORTED_MEDIA_TYPE', 'Send an application/json request.');
    return;
  }
  next();
};

const handleJsonError: ErrorRequestHandler = (err, _req, res, next) => {
  if (err.type === 'entity.parse.failed' || err.type === 'request.size.invalid') {
    error(res, 400, 'VALIDATION_ERROR', 'Enter a valid email and password.');
  } else if (err.status === 413) {
    error(res, 413, 'PAYLOAD_TOO_LARGE', 'Request is too large.');
  } else if (err.status === 415) {
    error(res, 415, 'UNSUPPORTED_MEDIA_TYPE', 'Send an application/json request.');
  } else {
    next(err);
  }
};

export function createAuthRouter(options: AuthOptions): Router {
  const router = Router();
  const auth = createAuthService(options.store, options.clock, options.ttlHours);
  const reserveAttempt = createRateLimit(options.clock, 5, 15 * 60_000);
  const cookieOptions: CookieOptions = { httpOnly: true, sameSite: 'lax', path: '/', secure: options.secure };
  const allowedOrigin = new URL(options.allowedOrigin).origin;

  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  const checkOrigin: RequestHandler = (req, res, next) => {
    const origin = req.get('Origin');
    if (origin && origin !== allowedOrigin) {
      error(res, 403, 'FORBIDDEN', 'Request origin is not allowed.');
      return;
    }
    next();
  };

  router.post('/login', checkOrigin, requireJson, json({ limit: '8kb' }), handleJsonError, async (req: Request, res: Response) => {
    const parsed = loginBody.safeParse(req.body);
    if (!parsed.success) {
      error(res, 400, 'VALIDATION_ERROR', 'Enter a valid email and password.');
      return;
    }

    const { email, password } = parsed.data;
    // Reserve before async work so simultaneous password guesses count toward the limit.
    const attempt = reserveAttempt([`ip:${clientIp(req)}`, `email:${email}`]);
    if ('retryAfter' in attempt) {
      rateLimited(res, attempt.retryAfter);
      return;
    }

    const result = await auth.login(email, password, sessionId(req.get('Cookie'))).catch((err: unknown) => {
      attempt.release();
      throw err;
    });
    if (!result) {
      error(res, 401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
      return;
    }
    attempt.release();
    res.cookie(COOKIE_NAME, result.session.id, { ...cookieOptions, expires: result.session.expiresAt });
    res.status(200).json({ user: result.user });
  });

  router.get('/me', async (req, res) => {
    const user = await auth.me(sessionId(req.get('Cookie')));
    if (!user) {
      error(res, 401, 'UNAUTHENTICATED', 'Sign in to continue.');
      return;
    }
    res.status(200).json(user);
  });

  router.post('/logout', checkOrigin, async (req, res) => {
    const revoked = await auth.logout(sessionId(req.get('Cookie')));
    res.clearCookie(COOKIE_NAME, cookieOptions);
    if (!revoked) {
      error(res, 401, 'UNAUTHENTICATED', 'Sign in to continue.');
      return;
    }
    res.status(200).json({ status: 'ok' });
  });

  return router;
}
