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
    expect(loadConfig({ ...base, NODE_ENV: 'production', SESSION_SECRET: 'x'.repeat(16), ALLOWED_ORIGIN: 'https://cpms.example.test' }).nodeEnv).toBe('production');
  });

  it('does not echo secret values in error messages', () => {
    try {
      loadConfig({ DATABASE_URL: 'postgresql://user:topsecretpw@host/db', PORT: 'abc' });
    } catch (e) {
      expect(String(e)).not.toContain('topsecretpw');
    }
  });
});

describe('loadConfig for deployment', () => {
  const prod = { ...base, NODE_ENV: 'production', SESSION_SECRET: 'x'.repeat(16), ALLOWED_ORIGIN: 'https://cpms.example.test' };

  it('TRUST_PROXY defaults to 0 and accepts 0 to 5 hops', () => {
    expect(loadConfig(base).trustProxy).toBe(0);
    expect(loadConfig({ ...base, TRUST_PROXY: '1' }).trustProxy).toBe(1);
    expect(loadConfig({ ...base, TRUST_PROXY: '5' }).trustProxy).toBe(5);
  });

  it.each(['abc', '-1', '6', '1.5', ''])('rejects TRUST_PROXY=%j', (value) => {
    expect(() => loadConfig({ ...base, TRUST_PROXY: value })).toThrow(/TRUST_PROXY/);
  });

  it('reads an optional CLIENT_DIST', () => {
    expect(loadConfig(base).clientDist).toBeUndefined();
    expect(loadConfig({ ...base, CLIENT_DIST: '/app/client/dist' }).clientDist).toBe('/app/client/dist');
  });

  it('requires an explicit ALLOWED_ORIGIN in production instead of the development default', () => {
    const { ALLOWED_ORIGIN: _omit, ...withoutOrigin } = prod;
    expect(() => loadConfig(withoutOrigin)).toThrow(/ALLOWED_ORIGIN/);
    expect(loadConfig(prod).allowedOrigin).toBe('https://cpms.example.test');
  });

  it('requires an https ALLOWED_ORIGIN in production, except for localhost', () => {
    expect(() => loadConfig({ ...prod, ALLOWED_ORIGIN: 'http://cpms.example.test' })).toThrow(/ALLOWED_ORIGIN/);
    expect(loadConfig({ ...prod, ALLOWED_ORIGIN: 'http://localhost:3000' }).allowedOrigin).toBe('http://localhost:3000');
  });

  it('keeps the development default outside production', () => {
    expect(loadConfig(base).allowedOrigin).toBe('http://localhost:5173');
  });
});


describe('REQUEST_LIMIT_PER_MINUTE (NFR-10 request burst limit)', () => {
  it('defaults to 100 requests per minute per address', () => {
    expect(loadConfig(base).requestLimitPerMinute).toBe(100);
  });

  it('accepts a whole number from 1 to 100000 (the browser journeys raise it, production keeps the default)', () => {
    expect(loadConfig({ ...base, REQUEST_LIMIT_PER_MINUTE: '1000' }).requestLimitPerMinute).toBe(1000);
  });

  it.each(['0', '-5', 'abc', '1.5', '100001'])('rejects %s', (value) => {
    expect(() => loadConfig({ ...base, REQUEST_LIMIT_PER_MINUTE: value })).toThrow(/REQUEST_LIMIT_PER_MINUTE/);
  });
});

describe('REQUEST_LIMIT_PER_MINUTE in production', () => {
  const prod = { ...base, NODE_ENV: 'production', SESSION_SECRET: 'x'.repeat(32), ALLOWED_ORIGIN: 'https://cpms.example.test' };

  it('keeps the default of 100 and allows lowering it', () => {
    expect(loadConfig(prod).requestLimitPerMinute).toBe(100);
    expect(loadConfig({ ...prod, REQUEST_LIMIT_PER_MINUTE: '50' }).requestLimitPerMinute).toBe(50);
  });

  it('refuses a limit above the default of 100, so the burst protection cannot be loosened by mistake', () => {
    expect(() => loadConfig({ ...prod, REQUEST_LIMIT_PER_MINUTE: '1000' })).toThrow(/REQUEST_LIMIT_PER_MINUTE/);
  });
});
