import { describe, expect, it } from 'vitest';
import { A1, ORIGIN, PASSWORD, createFixture } from './helpers/fake-auth.js';

// Behind Cloud Run every request reaches the app through one proxy. With TRUST_PROXY=1 the rate
// limiters must see the real client address from X-Forwarded-For; without it that header must be ignored.
const from = (ip: string) => ({ 'X-Forwarded-For': ip });

describe('proxy trust and rate limiting', () => {
  it('ignores X-Forwarded-For when no proxy is trusted, so spoofing does not escape the limit', async () => {
    const { api } = await createFixture();
    let last = 0;
    for (let i = 0; i < 101; i++) {
      last = (await api.get('/api/auth/me').set(from(`203.0.113.${i % 250}`))).status;
    }
    expect(last).toBe(429);
  });

  it('counts clients separately when one proxy hop is trusted', async () => {
    const { api } = await createFixture({ trustProxy: 1 });
    let status = 0;
    for (let i = 0; i < 101; i++) status = (await api.get('/api/auth/me').set(from('198.51.100.7'))).status;
    expect(status).toBe(429);
    const other = await api.get('/api/auth/me').set(from('198.51.100.8'));
    expect(other.status).toBe(401);
  });

  it('does not let one client address exhaust the limit for everyone else', async () => {
    const { api } = await createFixture({ trustProxy: 1 });
    for (let i = 0; i < 100; i++) await api.get('/api/auth/me').set(from('198.51.100.9'));
    const blocked = await api.get('/api/auth/me').set(from('198.51.100.9'));
    const free = await api.get('/api/auth/me').set(from('198.51.100.10'));
    expect(blocked.status).toBe(429);
    expect(free.status).toBe(401);
  });

  it('throttles failed logins per client address, not for the whole proxy', async () => {
    const { api } = await createFixture({ trustProxy: 1 });
    const attempt = (ip: string, email: string, password: string) =>
      api.post('/api/auth/login').set('Origin', ORIGIN).set(from(ip)).send({ email, password });
    for (let i = 0; i < 5; i++) expect((await attempt('192.0.2.1', `nobody${i}@example.test`, 'wrong')).status).toBe(401);
    expect((await attempt('192.0.2.1', A1.email, PASSWORD)).status).toBe(429);
    expect((await attempt('192.0.2.2', A1.email, PASSWORD)).status).toBe(200);
  });
});
