import type { RequestHandler } from 'express';

// Read endpoints that return private data must not be cached by the browser or a proxy.
export const noStore: RequestHandler = (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
};
