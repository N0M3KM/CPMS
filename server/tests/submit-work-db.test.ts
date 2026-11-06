import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prismaAuthStore } from '../src/auth/store.js';
import { createApp } from '../src/platform/app.js';
import { fixedClock } from '../src/platform/clock.js';
import { dbChecker } from '../src/platform/db.js';
import { mountFeatureRoutes } from '../src/routes.js';
import { seedDatabase } from '../src/seed/seed.js';
import { prismaTeamAccess } from '../src/security/team-access.js';
import { createTestPrisma, resetDb } from './helpers/db.js';

const prisma = createTestPrisma();
const SEED_NOW = new Date('2026-11-08T12:00:00Z');
const clock = fixedClock(SEED_NOW);
const password = 'synthetic-test-password';
const origin = 'http://localhost:5173';
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
// Seed: 202 Team A open (due 2026-11-22T12:00Z), 203 Team B overdue, 204 Team B submitted, 205 Team C open.
const OPEN_A = id(202);
const OVERDUE_B = id(203);
const SUBMITTED_B = id(204);
const OPEN_C = id(205);
const DUE_A = new Date('2026-11-22T12:00:00Z');
const valid = { title: 'Design report', description: 'A report describing our design in detail.', link: 'https://example.test/report' };

const api = request(createApp({
  checkDb: dbChecker(prisma),
  auth: { store: prismaAuthStore(prisma), clock, ttlHours: 1, secure: false, allowedOrigin: origin },
  teamAccess: prismaTeamAccess(prisma),
  mountRoutes: (app, security) => mountFeatureRoutes(app, security, prisma, clock),
}));

function setNow(date: Date) {
  clock.advance(date.getTime() - clock.now().getTime());
}

async function login(email: string): Promise<string> {
  const res = await api.post('/api/auth/login').set('Origin', origin).send({ email, password }).expect(200);
  return (res.headers['set-cookie']?.[0] ?? '').split(';')[0] ?? '';
}

const submit = (milestoneId: string, cookie: string) =>
  api.post(`/api/milestones/${milestoneId}/submission`).set('Origin', origin).set('Cookie', cookie);
const count = () => prisma.submission.count();

let a1: string; let a2: string; let b1: string; let c1: string; let c2: string; let s1: string;

beforeEach(async () => {
  setNow(SEED_NOW);
  await resetDb(prisma);
  await seedDatabase(prisma, { studentPassword: password, supervisorPassword: password, clock, logger: { log() {} } });
  [a1, a2, b1, c1, c2, s1] = (await Promise.all(
    ['student.a1', 'student.a2', 'student.b1', 'student.c1', 'student.c2', 'supervisor1'].map((n) => login(`${n}@example.test`)),
  )) as [string, string, string, string, string, string];
});
afterAll(() => prisma.$disconnect());

describe('F-04 submit milestone work', () => {
  it('TEST-21 saves boundary-length submissions with the session student and reads them back', async () => {
    const min = { title: 'T'.repeat(5), description: 'd'.repeat(20), link: 'http://example.test' };
    const max = { title: 'T'.repeat(100), description: 'd'.repeat(2000), link: 'https://example.test/' + 'a'.repeat(400) };
    const first = await submit(OPEN_A, a1).send(min).expect(201);
    expect(first.body).toEqual({
      id: expect.any(String), milestoneId: OPEN_A, title: min.title, description: min.description, link: min.link,
      submittedBy: { id: id(11), name: 'Student A1' }, submittedAt: SEED_NOW.toISOString(), feedback: null,
    });
    await submit(OPEN_C, c1).send(max).expect(201);
    expect(await prisma.submission.findUnique({ where: { milestoneId: OPEN_A } })).toMatchObject({ submittedById: id(11), title: min.title });
    const detail = await api.get(`/api/milestones/${OPEN_A}`).set('Cookie', a2).expect(200);
    expect(detail.body.status).toBe('SUBMITTED');
    expect(detail.body.submission).toMatchObject({ title: min.title, link: min.link });
  });

  it('TEST-21 stores hostile text as inert data and trims the title', async () => {
    const res = await submit(OPEN_A, a1).send({ ...valid, title: '  <script>alert(1)</script>  ', description: "'; DROP TABLE \"User\";-- and more text here" }).expect(201);
    expect(res.body.title).toBe('<script>alert(1)</script>');
    expect(await prisma.user.count()).toBe(8);
  });

  it('TEST-22 rejects invalid data, spoofed fields and malformed IDs without storing anything', async () => {
    const before = await count();
    const bad: unknown[] = [
      { ...valid, title: 'abcd' }, { ...valid, title: 'T'.repeat(101) }, { ...valid, description: 'd'.repeat(19) },
      { ...valid, description: 'd'.repeat(2001) }, { title: valid.title, description: valid.description },
      { ...valid, link: 'javascript:alert(1)' }, { ...valid, link: 'data:text/html,x' }, { ...valid, link: 'file:///etc/passwd' },
      { ...valid, link: 'ftp://example.test/x' }, { ...valid, link: '/relative' }, { ...valid, link: 'https://example.test/' + 'a'.repeat(500) },
      { ...valid, title: 'Design\u0000report' }, { ...valid, submittedById: id(12) }, { ...valid, milestoneId: OPEN_C },
      { ...valid, submittedAt: '2020-01-01T00:00:00Z' },
    ];
    for (const body of bad) {
      const res = await submit(OPEN_A, a1).send(body as object).expect(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    }
    await submit('not-a-uuid', a1).send(valid).expect(400);
    expect(await count()).toBe(before);
  });

  it('TEST-23 rejects a second submission and keeps the first', async () => {
    await submit(OPEN_A, a1).send(valid).expect(201);
    const dup = await submit(OPEN_A, a2).send({ ...valid, title: 'Second try title' }).expect(409);
    expect(dup.body.error.code).toBe('DUPLICATE_SUBMISSION');
    expect((await prisma.submission.findUniqueOrThrow({ where: { milestoneId: OPEN_A } })).title).toBe(valid.title);
    const existing = await submit(SUBMITTED_B, b1).send(valid).expect(409);
    expect(existing.body.error.code).toBe('DUPLICATE_SUBMISSION');
  });

  it('TEST-23 creates exactly one record when two members submit at the same time', async () => {
    const results = await Promise.all([submit(OPEN_C, c1).send(valid), submit(OPEN_C, c2).send({ ...valid, title: 'Other member' })]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await prisma.submission.count({ where: { milestoneId: OPEN_C } })).toBe(1);
  });

  it.each([
    ['one second before the deadline', -1000, 201],
    ['exactly at the deadline', 0, 201],
    ['one second after the deadline', 1000, 409],
  ])('TEST-24 %s', async (_name, offsetMs, status) => {
    setNow(new Date(DUE_A.getTime() + offsetMs));
    const cookie = await login('student.a1@example.test');
    const res = await submit(OPEN_A, cookie).send(valid);
    expect(res.status).toBe(status);
    if (status === 409) {
      expect(res.body.error.code).toBe('DEADLINE_PASSED');
      expect(await prisma.submission.count({ where: { milestoneId: OPEN_A } })).toBe(0);
    }
  });

  it('TEST-24 refuses an already overdue milestone and reports a duplicate before a late one', async () => {
    const late = await submit(OVERDUE_B, b1).send(valid).expect(409);
    expect(late.body.error.code).toBe('DEADLINE_PASSED');
    setNow(new Date('2026-12-31T00:00:00Z'));
    const cookie = await login('student.b1@example.test');
    const existing = await submit(SUBMITTED_B, cookie).send(valid).expect(409);
    expect(existing.body.error.code).toBe('DUPLICATE_SUBMISSION');
  });

  it('TEST-25 gives a non-member the same 404 as a missing milestone and stores nothing', async () => {
    const before = await count();
    const foreign = await submit(OPEN_A, b1).send(valid).expect(404);
    const missing = await submit(id(999), b1).send(valid).expect(404);
    expect(foreign.body).toEqual(missing.body);
    expect(await count()).toBe(before);
  });

  it('TEST-26 refuses supervisors and anonymous callers and stores nothing', async () => {
    const before = await count();
    const sup = await submit(OPEN_A, s1).send(valid).expect(403);
    expect(sup.body.error.code).toBe('FORBIDDEN');
    await submit(OPEN_A, '').send(valid).expect(401);
    expect(await count()).toBe(before);
  });

  it('keeps auth, role and origin checks ahead of body errors on this route', async () => {
    const broken = (cookie: string) => submit(OPEN_A, cookie).type('json').send('{"title":');
    expect((await broken('')).status).toBe(401);
    expect((await broken(s1)).status).toBe(403);
    expect((await broken(a1)).status).toBe(400);
    expect((await submit(OPEN_A, s1).type('form').send({ a: 'b' })).status).toBe(403);
    expect((await submit(OPEN_A, a1).type('form').send({ a: 'b' })).status).toBe(415);
    expect((await submit(OPEN_A, a1).send({ title: 'a'.repeat(11 * 1024) })).status).toBe(413);
    expect((await api.post(`/api/milestones/${OPEN_A}/submission`).set('Cookie', a1).send(valid)).status).toBe(403);
    expect((await api.post(`/api/milestones/${OPEN_A}/submission`).set('Origin', 'https://evil.example').set('Cookie', a1).send(valid)).status).toBe(403);
    expect(await count()).toBe(2);
  });

  it('rejects an expired session', async () => {
    clock.advance(2 * 3_600_000);
    await submit(OPEN_C, c1).send(valid).expect(401);
  });
});
