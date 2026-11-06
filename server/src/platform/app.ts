import express, { type Express } from 'express';
import { createAuthRouter, type AuthOptions } from '../auth/routes.js';
import { securityHeaders } from '../security/headers.js';
import { createSecurityKit, type SecurityKit } from '../security/kit.js';
import { createOriginCheck } from '../security/origin-check.js';
import type { TeamAccessRepo } from '../security/team-access.js';
import { errorHandler } from './errors.js';
import { clientIp, createRateLimit, rateLimited } from './rate-limit.js';

export interface AppDeps {
  // Resolves when the database answers, rejects otherwise.
  checkDb: () => Promise<void>;
  auth?: AuthOptions;
  teamAccess?: TeamAccessRepo;
  // Feature modules register their routes here, behind the shared security chain.
  mountRoutes?: (app: Express, security: SecurityKit) => void;
}

// Builds the Express app. Used by server.ts and by tests with injected dependencies.
export function createApp(deps: AppDeps): Express {
  if (deps.mountRoutes && !deps.auth) throw new Error('mountRoutes requires auth to be configured');

  const app = express();
  app.disable('x-powered-by');
  app.use(securityHeaders());

  app.get('/api/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  app.get('/api/ready', async (_req, res) => {
    try {
      await deps.checkDb();
      res.status(200).json({ status: 'ready' });
    } catch {
      res.status(503).json({ error: { code: 'NOT_READY', message: 'Service is not ready.' } });
    }
  });

  if (deps.auth) {
    const reserveRequest = createRateLimit(deps.auth.clock, 100, 60_000);
    app.use('/api', (req, res, next) => {
      const request = reserveRequest([clientIp(req)]);
      if ('retryAfter' in request) {
        res.set('Cache-Control', 'no-store');
        rateLimited(res, request.retryAfter);
        return;
      }
      next();
    });
    // Only the Origin check is app-wide. JSON parsing lives in each route chain (security.jsonBody)
    // after authentication and authorization, so 401 and 403 are never masked by body errors.
    app.use('/api', createOriginCheck(deps.auth.allowedOrigin));
    app.use('/api/auth', createAuthRouter(deps.auth));
    deps.mountRoutes?.(app, createSecurityKit(deps.auth, deps.teamAccess));
  }

  app.use((_req, res) => {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found.' } });
  });

  app.use(errorHandler);

  return app;
}
