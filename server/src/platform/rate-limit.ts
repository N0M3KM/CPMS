import type { Request, Response } from 'express';
import type { Clock } from './clock.js';

interface Window {
  count: number;
  expiresAt: number;
}

export function createRateLimit(clock: Clock, limit: number, windowMs: number) {
  const windows = new Map<string, Window>();
  let sweepAt = 0;

  return (keys: string[]): { retryAfter: number } | { release: () => void } => {
    const now = clock.now().getTime();
    if (now >= sweepAt) {
      for (const [key, window] of windows) {
        if (window.expiresAt <= now) windows.delete(key);
      }
      sweepAt = now + windowMs;
    }

    const active = keys.map(key => {
      const window = windows.get(key);
      return { key, window: window && window.expiresAt > now ? window : { count: 0, expiresAt: now + windowMs } };
    });
    const blockedUntil = Math.max(
      0,
      ...active.filter(({ window }) => window.count >= limit).map(({ window }) => window.expiresAt),
    );
    if (blockedUntil > now) return { retryAfter: Math.ceil((blockedUntil - now) / 1000) };

    for (const { key, window } of active) {
      window.count++;
      windows.set(key, window);
    }
    return {
      release() {
        for (const { window } of active) window.count--;
      },
    };
  };
}

export function clientIp(req: Request): string {
  return req.ip ?? req.socket.remoteAddress ?? 'unknown';
}

export function rateLimited(res: Response, retryAfter: number): void {
  res.set('Retry-After', String(retryAfter));
  res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' } });
}
