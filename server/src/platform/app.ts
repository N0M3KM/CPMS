import express, { type Express, type NextFunction, type Request, type Response } from 'express';

export interface AppDeps {
  // Resolves when the database answers, rejects otherwise.
  checkDb: () => Promise<void>;
}

// Builds the Express app. Used by server.ts and by tests with injected dependencies.
export function createApp(deps: AppDeps): Express {
  const app = express();
  app.disable('x-powered-by');

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

  app.use((_req, res) => {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found.' } });
  });

  // Last resort: never leak stack traces or internals.
  app.use((_err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    res.status(500).json({ error: { code: 'INTERNAL', message: 'Something went wrong.' } });
  });

  return app;
}
