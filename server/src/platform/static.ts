import express, { type Express } from 'express';
import { AppError } from './errors.js';
import { readFileSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';

const FILE_EXTENSION = /\.[^/]*$/;

// Serves the built client (single-container deployment). Files come only from `dir`; the
// index page is read once at startup and sent from memory, so no request value reaches the
// filesystem except through express.static, which refuses traversal and dotfiles.
export function mountStatic(app: Express, dir: string): void {
  const root = resolve(dir);
  const indexHtml = readFileSync(join(root, 'index.html'), 'utf8');

  app.use(
    express.static(root, {
      index: false,
      dotfiles: 'ignore',
      redirect: false,
      fallthrough: true,
      setHeaders(res, filePath) {
        // Vite fingerprints everything under assets/, so it can be cached for a year.
        const hashed = filePath.includes(`${sep}assets${sep}`);
        res.setHeader('Cache-Control', hashed ? 'public, max-age=31536000, immutable' : 'no-cache');
      },
    }),
  );

  // Client-side routes (no file extension, not /api) get the single-page app.
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    if (req.path === '/api' || req.path.startsWith('/api/')) return next();
    if (FILE_EXTENSION.test(req.path)) return next();
    // Dotfiles and dot-directories (.git, .env, ...) are never pages.
    if (/(^|\/)\./.test(req.path)) return next();
    // express.static ignores client errors (fallthrough), so refuse malformed or NUL paths here.
    try {
      if (decodeURIComponent(req.path).includes('\0')) return next(AppError.validation('Bad path.'));
    } catch {
      return next(AppError.validation('Bad path.'));
    }
    res.set('Cache-Control', 'no-cache').type('html').send(indexHtml);
  });
}
