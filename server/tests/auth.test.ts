import bcrypt from 'bcrypt';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import type { AuthStore, Session, UserCredentials } from '../src/auth/service.js';
import { createApp } from '../src/platform/app.js';
import { fixedClock } from '../src/platform/clock.js';

const password = 'synthetic-test-password';
const student = { id: 'student', email: 'student.a1@example.test', name: 'Student A1', role: 'STUDENT' } as const;
const supervisor = { id: 'supervisor', email: 'supervisor1@example.test', name: 'Supervisor One', role: 'SUPERVISOR' } as const;
let passwordHash: string;

beforeAll(async () => {
  passwordHash = await bcrypt.hash(password, 10);
});

function fixture(secure = false) {
  const clock = fixedClock(new Date('2026-11-06T08:00:00Z'));
  const users: UserCredentials[] = [student, supervisor].map(user => ({ ...user, passwordHash }));
  const sessions = new Map<string, Session>();
  const store: AuthStore = {
    async findCredentials(email) {
      return users.find(user => user.email === email) ?? null;
    },
    async rotateSession(session, previousId) {
      if (previousId) sessions.delete(previousId);
      sessions.set(session.id, session);
    },
    async findSessionUser(id, now) {
      const session = sessions.get(id);
      return session && session.expiresAt > now
        ? users.find(user => user.id === session.userId) ?? null
        : null;
    },
    async revokeSession(id, now) {
      const session = sessions.get(id);
      return !!session && session.expiresAt > now && sessions.delete(id);
    },
  };
  const deps = {
    checkDb: async () => undefined,
    auth: { store, clock, ttlHours: 1, secure, allowedOrigin: 'http://localhost:5173' },
  };
  return { api: request(createApp(deps)), clock, sessions };
}

function setCookie(response: request.Response): string {
  const cookies = response.get('set-cookie');
  return Array.isArray(cookies) ? cookies[0] ?? '' : cookies ?? '';
}

function sessionCookie(response: request.Response): string {
  return setCookie(response).split(';')[0] ?? '';
}

describe('F-01 authentication HTTP contract', () => {
  it.each([student, supervisor])('TEST-01/02 signs in as $role with safe identity and cookie flags', async user => {
    const { api, sessions } = fixture(user.role === 'SUPERVISOR');
    const res = await api.post('/api/auth/login').send({ email: ` ${user.email.toUpperCase()} `, password });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ user });
    expect(res.get('Cache-Control')).toBe('no-store');
    const cookie = setCookie(res);
    expect(cookie).toMatch(/^cpms_session=[A-Za-z0-9_-]{43};/);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Path=/');
    expect(cookie.includes('Secure')).toBe(user.role === 'SUPERVISOR');
    expect(sessions.size).toBe(1);
  });

  it('TEST-03 returns identical generic errors and creates no session', async () => {
    const { api, sessions } = fixture();
    const registered = await api.post('/api/auth/login').send({ email: student.email, password: 'wrong' });
    const unknown = await api.post('/api/auth/login').send({ email: 'unknown@example.test', password: 'wrong' });
    expect(registered.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(unknown.body).toEqual(registered.body);
    expect(unknown.get('Cache-Control')).toBe(registered.get('Cache-Control'));
    expect(unknown.get('Set-Cookie')).toBeUndefined();
    expect(registered.get('Set-Cookie')).toBeUndefined();
    expect(sessions.size).toBe(0);
  });

  it('TEST-04 reads, revokes, and expires sessions', async () => {
    const { api, clock, sessions } = fixture();
    expect((await api.get('/api/auth/me')).status).toBe(401);
    const login = () => api.post('/api/auth/login').send({ email: student.email, password });
    const active = sessionCookie(await login());
    const me = await api.get('/api/auth/me').set('Cookie', active);
    expect(me.status).toBe(200);
    expect(me.body).toEqual(student);
    const logout = await api.post('/api/auth/logout').set('Cookie', active);
    expect(logout.status).toBe(200);
    expect(setCookie(logout)).toMatch(/^cpms_session=;/);
    expect(sessions.size).toBe(0);
    expect((await api.get('/api/auth/me').set('Cookie', active)).status).toBe(401);
    expect((await api.post('/api/auth/logout').set('Cookie', active)).status).toBe(401);

    const expiring = sessionCookie(await login());
    clock.advance(3_600_000);
    expect((await api.get('/api/auth/me').set('Cookie', expiring)).status).toBe(401);
  });

  it('TEST-06 validates input, ignores redirect queries and rejects tampered sessions', async () => {
    const { api, sessions } = fixture();
    const credentials = { email: student.email, password };
    for (const body of [
      { ...credentials, role: 'SUPERVISOR' },
      { ...credentials, next: 'https://example.test' },
      { ...credentials, email: { $ne: null } },
      { ...credentials, password: 42 },
    ]) {
      expect((await api.post('/api/auth/login').send(body)).status).toBe(400);
    }
    expect((await api.post('/api/auth/login').type('json').send('{')).status).toBe(400);
    expect((await api.post('/api/auth/login').type('json').send('')).status).toBe(400);
    expect((await api.post('/api/auth/login').type('form').send(credentials)).status).toBe(415);
    expect((await api.post('/api/auth/login').set('Origin', 'https://example.test').send(credentials)).status).toBe(403);
    expect(sessions.size).toBe(0);
    const first = sessionCookie(await api.post('/api/auth/login').send(credentials));
    const rotated = await api.post('/api/auth/login?next=https://example.test').set('Cookie', first).send(credentials);
    expect(rotated.status).toBe(200);
    expect(rotated.get('Location')).toBeUndefined();
    expect(rotated.body.user.role).toBe('STUDENT');
    const fresh = sessionCookie(rotated);
    expect(fresh).not.toBe(first);
    expect(sessions.size).toBe(1);
    expect((await api.get('/api/auth/me').set('Cookie', first)).status).toBe(401);
    const tampered = fresh.slice(0, -1) + (fresh.endsWith('A') ? 'B' : 'A');
    expect((await api.get('/api/auth/me').set('Cookie', tampered)).status).toBe(401);
    expect((await api.get('/api/auth/me').set('Cookie', `${fresh}; role=SUPERVISOR`)).body).toEqual(student);
  });

  it.each([student.email, 'unknown@example.test'])('TEST-07 throttles repeated failures for %s', async email => {
    const { api, clock } = fixture();
    const login = () => api.post('/api/auth/login').send({ email, password: 'wrong' });
    const attempts = await Promise.all(Array.from({ length: 8 }, login));
    expect(attempts.map(res => res.status).sort()).toEqual([401, 401, 401, 401, 401, 429, 429, 429]);
    expect(attempts.find(res => res.status === 429)?.get('Retry-After')).toBe('900');
    clock.advance(15 * 60_000);
    expect((await api.post('/api/auth/login').send({ email: student.email, password })).status).toBe(200);
  });

  it('TEST-07 limits password spraying and general API bursts per IP', async () => {
    const { api, clock } = fixture();
    for (let i = 0; i < 5; i++) {
      expect((await api.post('/api/auth/login').send({ email: `spray${i}@example.test`, password })).status).toBe(401);
    }
    expect((await api.post('/api/auth/login').send({ email: student.email, password })).status).toBe(429);
    clock.advance(60_000);
    for (let i = 0; i < 100; i++) {
      expect((await api.get('/api/auth/me')).status).toBe(401);
    }
    const limited = await api.get('/api/auth/me');
    expect(limited.status).toBe(429);
    expect(limited.get('Retry-After')).toBe('60');
  });
});
