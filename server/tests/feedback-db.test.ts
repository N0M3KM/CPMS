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
// Seed: submission 301 (Team A, already has feedback), 302 (Team B, no feedback). Team C gets 303 below.
const REVIEWED_A = id(301);
const OPEN_B = id(302);
const OPEN_C = id(303);
const MILESTONE_B = id(204);
const valid = { comment: 'Clear structure. Please add measurable goals.' };

function buildApi() {
  return request(createApp({
    checkDb: dbChecker(prisma),
    auth: { store: prismaAuthStore(prisma), clock, ttlHours: 1, secure: false, allowedOrigin: origin },
    teamAccess: prismaTeamAccess(prisma),
    mountRoutes: (app, security) => mountFeatureRoutes(app, security, prisma, clock),
  }));
}
let api = buildApi();

async function login(email: string): Promise<string> {
  const res = await api.post('/api/auth/login').set('Origin', origin).send({ email, password }).expect(200);
  return (res.headers['set-cookie']?.[0] ?? '').split(';')[0] ?? '';
}

const give = (submissionId: string, cookie: string) =>
  api.post(`/api/submissions/${submissionId}/feedback`).set('Origin', origin).set('Cookie', cookie);
const count = () => prisma.feedback.count();

let s1: string; let s2: string; let a1: string; let b1: string; let b2: string;

beforeEach(async () => {
  api = buildApi();
  clock.advance(SEED_NOW.getTime() - clock.now().getTime());
  await resetDb(prisma);
  await seedDatabase(prisma, { studentPassword: password, supervisorPassword: password, clock, logger: { log() {} } });
  await prisma.submission.create({
    data: {
      id: OPEN_C, milestoneId: id(205), title: 'Team C work', description: 'Work from team C for the milestone.',
      link: 'https://example.test/c', submittedById: id(15), submittedAt: SEED_NOW,
    },
  });
  // Sequential on purpose: the login throttle counts simultaneous attempts per IP (limit 5).
  s1 = await login('supervisor1@example.test');
  s2 = await login('supervisor2@example.test');
  a1 = await login('student.a1@example.test');
  b1 = await login('student.b1@example.test');
  b2 = await login('student.b2@example.test');
});
afterAll(() => prisma.$disconnect());

describe('F-05 supervisor feedback', () => {
  it('TEST-27 saves feedback linked to the submission and marks the milestone reviewed', async () => {
    const res = await give(OPEN_B, s1).send({ comment: 'c'.repeat(10) }).expect(201);
    expect(res.body).toEqual({
      id: expect.any(String), submissionId: OPEN_B, comment: 'c'.repeat(10), createdAt: expect.any(String),
      supervisor: { id: id(1), name: 'Supervisor One' },
    });
    expect(await prisma.feedback.findUnique({ where: { submissionId: OPEN_B } })).toMatchObject({ supervisorId: id(1), comment: 'c'.repeat(10) });
    const detail = await api.get(`/api/milestones/${MILESTONE_B}`).set('Cookie', b1).expect(200);
    expect(detail.body.status).toBe('REVIEWED');
    expect(detail.body.submission.feedback).toMatchObject({ comment: 'c'.repeat(10) });
  });

  it('TEST-27 accepts 2000 characters, trims the comment and stores hostile text as data', async () => {
    const long = await give(OPEN_C, s2).send({ comment: '  ' + 'c'.repeat(2000) + '  ' }).expect(201);
    expect(long.body.comment).toBe('c'.repeat(2000));
    const hostile = '<script>alert(1)</script> \'; DROP TABLE "User";-- text';
    const res = await give(OPEN_B, s1).send({ comment: hostile }).expect(201);
    expect(res.body.comment).toBe(hostile);
    expect(await prisma.user.count()).toBe(8);
  });

  it('TEST-28 rejects invalid comments, spoofed fields and malformed IDs without storing anything', async () => {
    const before = await count();
    const bad: unknown[] = [
      {}, { comment: '' }, { comment: '      ' }, { comment: 'c'.repeat(9) }, { comment: '  ' + 'c'.repeat(9) + '  ' },
      { comment: 'c'.repeat(2001) }, { comment: 'Good work\u0000 overall' }, { comment: 12345678901 },
      { comment: { $ne: null } }, { ...valid, supervisorId: id(2) }, { ...valid, submissionId: OPEN_C },
      { ...valid, createdAt: '2020-01-01T00:00:00Z' }, { ...valid, id: id(999) },
    ];
    for (const body of bad) {
      const res = await give(OPEN_B, s1).send(body as object).expect(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    }
    await give('not-a-uuid', s1).send(valid).expect(400);
    expect(await count()).toBe(before);
  });

  it('TEST-29 keeps the first feedback when a second one arrives', async () => {
    await give(OPEN_B, s1).send(valid).expect(201);
    const again = await give(OPEN_B, s1).send({ comment: 'A different comment entirely.' }).expect(409);
    expect(again.body.error.code).toBe('FEEDBACK_EXISTS');
    expect((await prisma.feedback.findUniqueOrThrow({ where: { submissionId: OPEN_B } })).comment).toBe(valid.comment);
    const seeded = await give(REVIEWED_A, s1).send(valid).expect(409);
    expect(seeded.body.error.code).toBe('FEEDBACK_EXISTS');
    expect((await prisma.feedback.findUniqueOrThrow({ where: { submissionId: REVIEWED_A } })).comment).toMatch(/^Clear scope/);
  });

  it('TEST-29 creates exactly one record for two simultaneous requests', async () => {
    const results = await Promise.all([give(OPEN_B, s1).send(valid), give(OPEN_B, s1).send({ comment: 'Second simultaneous one.' })]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await prisma.feedback.count({ where: { submissionId: OPEN_B } })).toBe(1);
  });

  it('TEST-30 gives an unassigned supervisor the same 404 as a missing submission', async () => {
    const before = await count();
    const foreign = await give(OPEN_B, s2).send(valid).expect(404);
    const other = await give(OPEN_C, s1).send(valid).expect(404);
    const missing = await give(id(999), s1).send(valid).expect(404);
    expect(foreign.body).toEqual(missing.body);
    expect(other.body).toEqual(missing.body);
    expect(await count()).toBe(before);
  });

  it('TEST-31 refuses students and anonymous callers and stores nothing', async () => {
    const before = await count();
    const student = await give(OPEN_B, b1).send(valid).expect(403);
    expect(student.body.error.code).toBe('FORBIDDEN');
    await give(OPEN_B, '').send(valid).expect(401);
    expect(await count()).toBe(before);
  });

  it('TEST-32 shows feedback to the team and its supervisor only', async () => {
    await give(OPEN_B, s1).send(valid).expect(201);
    for (const cookie of [b1, b2, s1]) {
      const res = await api.get(`/api/milestones/${MILESTONE_B}`).set('Cookie', cookie).expect(200);
      expect(res.body.submission.feedback.comment).toBe(valid.comment);
    }
    const missing = await api.get(`/api/milestones/${id(999)}`).set('Cookie', a1).expect(404);
    const otherTeam = await api.get(`/api/milestones/${MILESTONE_B}`).set('Cookie', a1).expect(404);
    expect(otherTeam.body).toEqual(missing.body);
    await api.get(`/api/milestones/${MILESTONE_B}`).set('Cookie', s2).expect(404);
  });

  it('keeps auth, role and origin checks ahead of body errors on this route', async () => {
    const broken = (cookie: string) => give(OPEN_B, cookie).type('json').send('{"comment":');
    expect((await broken('')).status).toBe(401);
    expect((await broken(b1)).status).toBe(403);
    expect((await broken(s1)).status).toBe(400);
    expect((await give(OPEN_B, b1).type('form').send({ a: 'b' })).status).toBe(403);
    expect((await give(OPEN_B, s1).type('form').send({ a: 'b' })).status).toBe(415);
    expect((await give(OPEN_B, s1).send({ comment: 'a'.repeat(11 * 1024) })).status).toBe(413);
    expect((await api.post(`/api/submissions/${OPEN_B}/feedback`).set('Cookie', s1).send(valid)).status).toBe(403);
    expect((await api.post(`/api/submissions/${OPEN_B}/feedback`).set('Origin', 'https://evil.example').set('Cookie', s1).send(valid)).status).toBe(403);
    expect(await count()).toBe(1);
  });

  it('offers no way to change or remove feedback', async () => {
    const path = `/api/submissions/${REVIEWED_A}/feedback`;
    for (const method of ['put', 'patch', 'delete'] as const) {
      await api[method](path).set('Origin', origin).set('Cookie', s1).send(valid).expect(404);
    }
    expect((await prisma.feedback.findUniqueOrThrow({ where: { submissionId: REVIEWED_A } })).comment).toMatch(/^Clear scope/);
  });

  it('rejects an expired session', async () => {
    clock.advance(2 * 3_600_000);
    await give(OPEN_B, s1).send(valid).expect(401);
  });
});
