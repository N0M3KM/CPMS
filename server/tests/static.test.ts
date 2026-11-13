import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/platform/app.js';

// Static client serving for the single-container deployment (R-01, R-03) and SEC-11 traversal checks.
const OUTSIDE = 'OUTSIDE-SECRET-CONTENT';
let root: string;
let site: string;

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'cpms-static-'));
  site = join(root, 'dist');
  mkdirSync(join(site, 'assets'), { recursive: true });
  writeFileSync(join(root, 'secret-outside.txt'), OUTSIDE);
  writeFileSync(join(site, 'index.html'), '<!doctype html><html><head><title>CPMS</title></head><body><div id="root"></div></body></html>');
  writeFileSync(join(site, 'assets', 'app-abc123.js'), 'console.log("app");');
  writeFileSync(join(site, 'assets', 'app-abc123.css'), 'body{margin:0}');
  writeFileSync(join(site, '.hidden'), 'HIDDEN-DOTFILE');
  writeFileSync(join(site, 'assets', '.env'), 'DATABASE_URL=HIDDEN-ENV');
});

const withSite = () => createApp({ checkDb: async () => undefined, staticDir: site });
const withoutSite = () => createApp({ checkDb: async () => undefined });

// Sends the path exactly as given (no client-side normalisation of ../).
function rawGet(app: ReturnType<typeof createApp>, path: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const { port } = server.address() as AddressInfo;
      const req = http.request({ host: '127.0.0.1', port, path, method: 'GET' }, (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          server.close();
          resolve({ status: res.statusCode ?? 0, body });
        });
      });
      req.on('error', (e) => {
        server.close();
        reject(e);
      });
      req.end();
    });
  });
}

describe('static client serving', () => {
  it('serves index.html at / with no-cache and security headers', async () => {
    const res = await request(withSite()).get('/');
    expect(res.status).toBe(200);
    expect(res.get('Content-Type')).toMatch(/text\/html/);
    expect(res.text).toContain('<div id="root">');
    expect(res.get('Cache-Control')).toMatch(/no-cache/);
    expect(res.get('Content-Security-Policy')).toBeTruthy();
    expect(res.get('X-Content-Type-Options')).toBe('nosniff');
    expect(res.get('X-Powered-By')).toBeUndefined();
  });

  it('serves hashed assets with long-lived immutable caching', async () => {
    const js = await request(withSite()).get('/assets/app-abc123.js');
    expect(js.status).toBe(200);
    expect(js.get('Content-Type')).toMatch(/javascript/);
    expect(js.get('Cache-Control')).toMatch(/max-age=31536000/);
    expect(js.get('Cache-Control')).toMatch(/immutable/);
    const css = await request(withSite()).get('/assets/app-abc123.css');
    expect(css.status).toBe(200);
    expect(css.get('Content-Type')).toMatch(/css/);
  });

  it('falls back to index.html for client routes without a file extension', async () => {
    for (const path of ['/teams/11111111-1111-4111-8111-111111111111', '/milestones/abc', '/login', '/student']) {
      const res = await request(withSite()).get(path);
      expect(res.status, path).toBe(200);
      expect(res.text, path).toContain('<div id="root">');
    }
  });

  it('keeps unknown /api paths as a JSON 404, never index.html', async () => {
    for (const path of ['/api/nope', '/api', '/api/teams/x/y']) {
      const res = await request(withSite()).get(path);
      expect(res.status, path).toBe(404);
      expect(res.body.error.code, path).toBe('NOT_FOUND');
      expect(res.text, path).not.toContain('<div id="root">');
    }
  });

  it('returns 404, not index.html, for a missing file with an extension', async () => {
    for (const path of ['/assets/missing.js', '/favicon.ico', '/robots.txt']) {
      const res = await request(withSite()).get(path);
      expect(res.status, path).toBe(404);
      expect(res.text, path).not.toContain('<div id="root">');
    }
  });

  it('serves nothing when no client directory is configured', async () => {
    const res = await request(withoutSite()).get('/');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('only answers GET and HEAD for pages', async () => {
    expect((await request(withSite()).post('/')).status).toBe(404);
    expect((await request(withSite()).put('/login')).status).toBe(404);
    expect((await request(withSite()).head('/')).status).toBe(200);
  });

  it('never serves dotfiles', async () => {
    for (const path of ['/.hidden', '/assets/.env', '/.git/config', '/.env']) {
      const res = await request(withSite()).get(path);
      expect(res.status, path).toBe(404);
      expect(res.text, path).not.toContain('HIDDEN');
    }
  });

  it('does not list directories', async () => {
    for (const path of ['/assets', '/assets/']) {
      const res = await request(withSite()).get(path);
      expect(res.text, path).not.toContain('app-abc123.js');
    }
  });

  describe('directory traversal and file inclusion (SEC-11)', () => {
    const attacks = [
      '/../secret-outside.txt',
      '/assets/../../secret-outside.txt',
      '/%2e%2e/secret-outside.txt',
      '/assets/%2e%2e/%2e%2e/secret-outside.txt',
      '/assets/..%2f..%2fsecret-outside.txt',
      '/..%2fsecret-outside.txt',
      '/..%5csecret-outside.txt',
      '/%252e%252e/secret-outside.txt',
      '/....//secret-outside.txt',
      '/assets/%c0%ae%c0%ae/secret-outside.txt',
      '/secret-outside.txt',
      '/dist/../secret-outside.txt',
      '/http://evil.example/x.php',
      '//evil.example/x.php',
      '/etc/passwd',
      '/../../../../etc/passwd',
      '/%2e%2e/%2e%2e/%2e%2e/etc/passwd',
    ];
    it.each(attacks)('does not leak files outside the client directory for %s', async (path) => {
      const res = await rawGet(withSite(), path);
      expect(res.body).not.toContain(OUTSIDE);
      expect(res.body).not.toContain('root:');
      expect(res.status).toBeLessThan(500);
    });

    it.each(['/%00', '/assets/app.js%00.png', '/%E0%A4%A', '/%'])('answers malformed path %s with a client error, not a crash', async (path) => {
      const res = await rawGet(withSite(), path);
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
      expect(res.body).not.toMatch(/at .*\.(js|ts):\d+/);
    });
  });
});
