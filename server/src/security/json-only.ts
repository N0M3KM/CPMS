import type { RequestHandler } from 'express';
import { AppError } from '../platform/errors.js';

const STATE_CHANGING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// A state-changing request that carries a body must declare application/json.
export const jsonOnly: RequestHandler = (req, _res, next) => {
  const hasBody = Number(req.get('Content-Length') ?? 0) > 0 || req.get('Transfer-Encoding') !== undefined;
  if (STATE_CHANGING.has(req.method) && hasBody) {
    const mediaType = req.get('Content-Type')?.split(';', 1)[0]?.trim().toLowerCase();
    if (mediaType !== 'application/json') throw AppError.unsupportedMediaType();
  }
  next();
};
