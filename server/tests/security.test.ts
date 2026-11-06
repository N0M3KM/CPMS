import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { AppError } from '../src/platform/errors.js';
import { pickFields } from '../src/security/dto.js';
import { parse, uuidSchema } from '../src/security/validate.js';
import { A1, B1, MISSING_TEAM, ORIGIN, S1, S2, TEAM_A, TEAM_B, TEAM_C, createFixture } from './helpers/fake-auth.js';
import type { AppDeps } from '../src/platform/app.js';

let supervisorOnlyCalls = 0;

// Probe routes stand in for the real feature routes that arrive in F-03 to F-07.
const mountRoutes: NonNullable<AppDeps['mountRoutes']> = (app, kit) => {
  app.get('/api/probe/teams/:teamId', kit.requireAuth, async (req, res) => {
    const teamId = parse(uuidSchema, req.params.teamId);
    const team = await kit.teams.requireTeam(req.principal!, teamId);
    res.json({ id: team.id });
  });
  app.post('/api/probe/supervisor-only', kit.requireAuth, kit.requireRole('SUPERVISOR'), (_req, res) => {
    supervisorOnlyCalls++;
    res.status(201).json({ ok: true });
  });
  app.post('/api/probe/student-only', kit.requireAuth, kit.requireRole('STUDENT'), (_req, res) => {
    res.status(201).json({ ok: true });
  });
  app.post('/api/probe/echo', kit.requireAuth, (req, res) => {
    const body = parse(z.strictObject({ title: z.string().min(1).max(100) }), req.body);
    res.status(200).json(body);
  });
  app.get('/api/probe/boom', (_req, _res) => {
    throw new Error("SELECT * FROM \"User\" WHERE password = 'x'\n    at Object.<anonymous> (/srv/app.js:1:1)");
  });
};

const envelope = (code: string) => ({ error: { code, message: expect.any(String) } });

describe('AC-08 anonymous requests (NFR-01)', () => {
  it('returns 401 with the standard envelope and no private fields', async () => {
    const { api } = await createFixture({ mountRoutes });
    for (const res of [
      await api.get(`/api/probe/teams/${TEAM_A}`),
      await api.post('/api/probe/supervisor-only').set('Origin', ORIGIN),
      await api.post('/api/probe/echo').set('Origin', ORIGIN).send({ title: 'x' }),
    ]) {
      expect(res.status).toBe(401);
      expect(res.body).toEqual(envelope('UNAUTHENTICATED'));
    }
  });

  it('treats an unknown, malformed or expired session cookie as anonymous', async () => {
    const { api, clock, login } = await createFixture({ mountRoutes });
    expect((await api.get(`/api/probe/teams/${TEAM_A}`).set('Cookie', 'cpms_session=nope')).status).toBe(401);
    const cookie = await login(A1);
    clock.advance(3_600_000);
    expect((await api.get(`/api/probe/teams/${TEAM_A}`).set('Cookie', cookie)).status).toBe(401);
  });

  it('does not accept an Authorization header as a credential', async () => {
    const { api } = await createFixture({ mountRoutes });
    const res = await api.get(`/api/probe/teams/${TEAM_A}`).set('Authorization', 'Bearer anything');
    expect(res.status).toBe(401);
  });
});

describe('AC-09 role guards (BR-07)', () => {
  it('returns 403 for the wrong role and runs no handler', async () => {
    const { api, login } = await createFixture({ mountRoutes });
    const before = supervisorOnlyCalls;
    const studentCookie = await login(A1);
    const supervisorCookie = await login(S1);
    const student = await api.post('/api/probe/supervisor-only').set('Origin', ORIGIN).set('Cookie', studentCookie);
    expect(student.status).toBe(403);
    expect(student.body).toEqual(envelope('FORBIDDEN'));
    expect(supervisorOnlyCalls).toBe(before);
    const supervisor = await api.post('/api/probe/student-only').set('Origin', ORIGIN).set('Cookie', supervisorCookie);
    expect(supervisor.status).toBe(403);
    const allowed = await api.post('/api/probe/supervisor-only').set('Origin', ORIGIN).set('Cookie', supervisorCookie);
    expect(allowed.status).toBe(201);
  });
});

describe('AC-10 and AC-11 team scope with uniform 404 (BR-06)', () => {
  it('lets a student read only their own team and hides others exactly like missing ones', async () => {
    const { api, login } = await createFixture({ mountRoutes });
    const cookie = await login(A1);
    const own = await api.get(`/api/probe/teams/${TEAM_A}`).set('Cookie', cookie);
    expect(own.status).toBe(200);
    const foreign = await api.get(`/api/probe/teams/${TEAM_B}`).set('Cookie', cookie);
    const missing = await api.get(`/api/probe/teams/${MISSING_TEAM}`).set('Cookie', cookie);
    expect(foreign.status).toBe(404);
    expect(foreign.status).toBe(missing.status);
    expect(foreign.body).toEqual(missing.body);
    expect(foreign.body).toEqual(envelope('NOT_FOUND'));
  });

  it('lets a supervisor read only supervised teams and hides others exactly like missing ones', async () => {
    const { api, login } = await createFixture({ mountRoutes });
    const s1 = await login(S1);
    expect((await api.get(`/api/probe/teams/${TEAM_A}`).set('Cookie', s1)).status).toBe(200);
    expect((await api.get(`/api/probe/teams/${TEAM_B}`).set('Cookie', s1)).status).toBe(200);
    const foreign = await api.get(`/api/probe/teams/${TEAM_C}`).set('Cookie', s1);
    const missing = await api.get(`/api/probe/teams/${MISSING_TEAM}`).set('Cookie', s1);
    expect(foreign.status).toBe(404);
    expect(foreign.body).toEqual(missing.body);
    const s2 = await login(S2);
    expect((await api.get(`/api/probe/teams/${TEAM_A}`).set('Cookie', s2)).status).toBe(404);
    expect((await api.get(`/api/probe/teams/${TEAM_C}`).set('Cookie', s2)).status).toBe(200);
  });

  it('never trusts a client-supplied user, role or team', async () => {
    const { api, login } = await createFixture({ mountRoutes });
    const cookie = await login(A1);
    const res = await api
      .get(`/api/probe/teams/${TEAM_B}?userId=a1&role=SUPERVISOR&teamId=${TEAM_B}`)
      .set('Cookie', `${cookie}; role=SUPERVISOR; userId=s1`)
      .set('X-User-Id', 's1')
      .set('X-Role', 'SUPERVISOR');
    expect(res.status).toBe(404);
  });
});

describe('AC-12 safe errors (NFR-03)', () => {
  it('hides stack traces and SQL from unexpected errors', async () => {
    const { api } = await createFixture({ mountRoutes });
    const res = await api.get('/api/probe/boom');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: { code: 'INTERNAL', message: 'Something went wrong.' } });
    expect(JSON.stringify(res.body)).not.toMatch(/SELECT|password|at Object|\/srv\//);
  });

  it('maps AppError factories to the envelope with the right status', () => {
    expect(AppError.unauthenticated().status).toBe(401);
    expect(AppError.forbidden().status).toBe(403);
    expect(AppError.notFound().status).toBe(404);
    expect(AppError.validation().status).toBe(400);
    expect(AppError.conflict('DUPLICATE_SUBMISSION', 'Already submitted.').status).toBe(409);
    expect(AppError.conflict('DUPLICATE_SUBMISSION', 'Already submitted.').code).toBe('DUPLICATE_SUBMISSION');
  });
});

describe('AC-13 hostile input has no effect (NFR-07)', () => {
  it.each(["' OR 1=1--", '"; DROP TABLE "User";--', '../../etc/passwd', '..%2f..%2f.env', '; ls', '$(id)', '`id`', 'http://169.254.169.254/'])(
    'rejects %s as an id without echoing it',
    async (payload) => {
      const { api, login } = await createFixture({ mountRoutes });
      const cookie = await login(A1);
      const res = await api.get(`/api/probe/teams/${encodeURIComponent(payload)}`).set('Cookie', cookie);
      expect(res.status).toBe(400);
      expect(res.body).toEqual(envelope('VALIDATION_ERROR'));
      expect(JSON.stringify(res.body)).not.toContain(payload);
    },
  );

  it('returns hostile text only as inert JSON data', async () => {
    const { api, login } = await createFixture({ mountRoutes });
    const title = '<script>alert(1)</script>';
    const cookie = await login(A1);
    const res = await api.post('/api/probe/echo').set('Origin', ORIGIN).set('Cookie', cookie).send({ title });
    expect(res.status).toBe(200);
    expect(res.get('Content-Type')).toMatch(/^application\/json/);
    expect(res.body).toEqual({ title });
  });
});

describe('AC-14 origin and content type (NFR-08)', () => {
  it('rejects state-changing requests with a foreign or missing Origin and runs no handler', async () => {
    const { api, login } = await createFixture({ mountRoutes });
    const cookie = await login(S1);
    const before = supervisorOnlyCalls;
    const foreign = await api.post('/api/probe/supervisor-only').set('Cookie', cookie).set('Origin', 'https://evil.example');
    const none = await api.post('/api/probe/supervisor-only').set('Cookie', cookie);
    expect(foreign.status).toBe(403);
    expect(none.status).toBe(403);
    expect(foreign.body).toEqual(envelope('FORBIDDEN'));
    expect(supervisorOnlyCalls).toBe(before);
    for (const method of ['put', 'patch', 'delete'] as const) {
      expect((await api[method]('/api/probe/supervisor-only').set('Cookie', cookie)).status).toBe(403);
    }
  });

  it('accepts the allowed Origin and never blocks safe methods', async () => {
    const { api, login } = await createFixture({ mountRoutes });
    const cookie = await login(S1);
    expect((await api.post('/api/probe/supervisor-only').set('Cookie', cookie).set('Origin', ORIGIN)).status).toBe(201);
    expect((await api.get(`/api/probe/teams/${TEAM_A}`).set('Cookie', cookie).set('Origin', 'https://evil.example')).status).toBe(200);
  });

  it('rejects non-JSON request bodies with 415', async () => {
    const { api, login } = await createFixture({ mountRoutes });
    const cookie = await login(A1);
    const form = await api.post('/api/probe/echo').set('Origin', ORIGIN).set('Cookie', cookie).type('form').send({ title: 'x' });
    const text = await api.post('/api/probe/echo').set('Origin', ORIGIN).set('Cookie', cookie).type('text/plain').send('{"title":"x"}');
    expect(form.status).toBe(415);
    expect(text.status).toBe(415);
    expect(form.body).toEqual(envelope('UNSUPPORTED_MEDIA_TYPE'));
  });
});

describe('AC-15 strict schemas and response whitelist (NFR-11)', () => {
  it('rejects unknown fields including mass-assignment attempts', async () => {
    const { api, login } = await createFixture({ mountRoutes });
    const cookie = await login(A1);
    const res = await api.post('/api/probe/echo').set('Origin', ORIGIN).set('Cookie', cookie).send({ title: 'ok', role: 'SUPERVISOR' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual(envelope('VALIDATION_ERROR'));
    expect(JSON.stringify(res.body)).not.toContain('SUPERVISOR');
  });

  it('rejects non-object and wrongly typed bodies', async () => {
    const { api, login } = await createFixture({ mountRoutes });
    const cookie = await login(A1);
    for (const body of [[], 'text', 42, { title: 7 }, { title: { $ne: null } }, {}]) {
      const res = await api.post('/api/probe/echo').set('Origin', ORIGIN).set('Cookie', cookie).type('json').send(JSON.stringify(body));
      expect(res.status).toBe(400);
    }
  });

  it('pickFields copies only the listed fields', () => {
    const source = { id: '1', name: 'A', passwordHash: 'secret', email: 'a@example.test' };
    expect(pickFields(source, ['id', 'name'])).toEqual({ id: '1', name: 'A' });
    expect(Object.keys(pickFields(source, ['id']))).toEqual(['id']);
  });

  it('login and me responses expose only whitelisted fields', async () => {
    const { api, login } = await createFixture();
    const cookie = await login(A1);
    const me = await api.get('/api/auth/me').set('Cookie', cookie);
    expect(Object.keys(me.body).sort()).toEqual(['email', 'id', 'name', 'role']);
  });
});

describe('AC-16 headers, CORS and size limits (NFR-12)', () => {
  it('sets security headers and hides the framework', async () => {
    const { api } = await createFixture();
    for (const path of ['/api/health', '/api/auth/me', '/api/nope']) {
      const res = await api.get(path);
      expect(res.get('Content-Security-Policy')).toBeTruthy();
      expect(res.get('X-Content-Type-Options')).toBe('nosniff');
      expect(res.get('Referrer-Policy')).toBeTruthy();
      expect(res.get('X-Frame-Options') ?? res.get('Content-Security-Policy')).toMatch(/SAMEORIGIN|DENY|frame-ancestors/i);
      expect(res.get('X-Powered-By')).toBeUndefined();
    }
  });

  it('grants no cross-origin access, even for a foreign Origin or preflight', async () => {
    const { api } = await createFixture({ mountRoutes });
    const get = await api.get('/api/health').set('Origin', 'https://evil.example');
    expect(get.get('Access-Control-Allow-Origin')).toBeUndefined();
    const preflight = await api
      .options('/api/probe/echo')
      .set('Origin', 'https://evil.example')
      .set('Access-Control-Request-Method', 'POST');
    expect(preflight.get('Access-Control-Allow-Origin')).toBeUndefined();
  });

  it('caps the body at 10 KB and rejects malformed JSON safely', async () => {
    const { api, login } = await createFixture({ mountRoutes });
    const cookie = await login(A1);
    const big = await api.post('/api/probe/echo').set('Origin', ORIGIN).set('Cookie', cookie).send({ title: 'a'.repeat(11 * 1024) });
    expect(big.status).toBe(413);
    expect(big.body).toEqual(envelope('PAYLOAD_TOO_LARGE'));
    const broken = await api.post('/api/probe/echo').set('Origin', ORIGIN).set('Cookie', cookie).type('json').send('{"title":');
    expect(broken.status).toBe(400);
    expect(broken.body).toEqual(envelope('VALIDATION_ERROR'));
    const nested = await api.post('/api/probe/echo').set('Origin', ORIGIN).set('Cookie', cookie).type('json').send('['.repeat(5000) + ']'.repeat(5000));
    expect(nested.status).toBe(400);
  });

  it('answers unsupported methods without success', async () => {
    const { api } = await createFixture();
    const res = await api.trace('/api/health');
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});

describe('route matrix (SEC-06): every route is accounted for', () => {
  it('has no unlisted route and every protected route returns 401 anonymously', async () => {
    const { listRoutes } = await import('./helpers/routes.js');
    const { app, api } = await createFixture();
    const routes = listRoutes(app, ['/api/auth']);
    const matrix: Record<string, 'public' | 'protected'> = {
      'GET /api/health': 'public',
      'GET /api/ready': 'public',
      'POST /api/auth/login': 'public',
      'GET /api/auth/me': 'protected',
      'POST /api/auth/logout': 'protected',
    };
    expect(routes).toEqual(Object.keys(matrix).sort());
    for (const [key, access] of Object.entries(matrix)) {
      if (access !== 'protected') continue;
      const [method, path] = key.split(' ') as ['GET' | 'POST', string];
      const req = method === 'GET' ? api.get(path) : api.post(path).set('Origin', ORIGIN);
      const res = await req;
      expect(res.status, key).toBe(401);
      expect(res.body, key).toEqual(envelope('UNAUTHENTICATED'));
    }
  });
});
