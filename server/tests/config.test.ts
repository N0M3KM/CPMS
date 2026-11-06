import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/platform/config.js';

const base = { DATABASE_URL: 'postgresql://u:p@127.0.0.1:5433/cpms_dev' };

describe('loadConfig', () => {
  it('applies defaults for optional values', () => {
    const cfg = loadConfig(base);
    expect(cfg.port).toBe(3000);
    expect(cfg.nodeEnv).toBe('development');
    expect(cfg.sessionTtlHours).toBe(8);
    expect(cfg.allowedOrigin).toBe('http://localhost:5173');
  });

  it('throws when DATABASE_URL is missing', () => {
    expect(() => loadConfig({})).toThrow(/DATABASE_URL/);
  });

  it('rejects an invalid PORT', () => {
    expect(() => loadConfig({ ...base, PORT: 'abc' })).toThrow(/PORT/);
  });

  it('rejects an invalid ALLOWED_ORIGIN', () => {
    expect(() => loadConfig({ ...base, ALLOWED_ORIGIN: 'not a url' })).toThrow(/ALLOWED_ORIGIN/);
  });

  it('requires a SESSION_SECRET of at least 16 characters in production', () => {
    expect(() => loadConfig({ ...base, NODE_ENV: 'production' })).toThrow(/SESSION_SECRET/);
    expect(() => loadConfig({ ...base, NODE_ENV: 'production', SESSION_SECRET: 'short' })).toThrow(/SESSION_SECRET/);
    expect(loadConfig({ ...base, NODE_ENV: 'production', SESSION_SECRET: 'x'.repeat(16) }).nodeEnv).toBe('production');
  });

  it('does not echo secret values in error messages', () => {
    try {
      loadConfig({ DATABASE_URL: 'postgresql://user:topsecretpw@host/db', PORT: 'abc' });
    } catch (e) {
      expect(String(e)).not.toContain('topsecretpw');
    }
  });
});
