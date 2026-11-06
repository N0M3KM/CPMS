import request from 'supertest';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { prismaAuthStore } from '../src/auth/store.js';
import { createApp } from '../src/platform/app.js';
import { fixedClock } from '../src/platform/clock.js';
import { dbChecker } from '../src/platform/db.js';
import { seedDatabase } from '../src/seed/seed.js';
import { mountScopedViews } from '../src/views/routes.js';
import { createTestPrisma, resetDb } from './helpers/db.js';

const prisma = createTestPrisma();
const clock = fixedClock(new Date('2026-11-08T12:00:00Z'));
const password = 'synthetic-test-password';
const origin = 'http://localhost:5173';
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const api = request(createApp({
  checkDb: dbChecker(prisma),
  auth: { store: prismaAuthStore(prisma), clock, ttlHours: 1, secure: false, allowedOrigin: origin },
  mountRoutes: (app, security) => mountScopedViews(app, security, prisma, clock),
}));

beforeAll(async () => {
  await resetDb(prisma);
  await seedDatabase(prisma, {
    studentPassword: password, supervisorPassword: password, clock, logger: { log() {} },
  });
});

afterAll(() => prisma.$disconnect());

async function login(email: string): Promise<string> {
  const response = await api.post('/api/auth/login').set('Origin', origin).send({ email, password }).expect(200);
  return (response.headers['set-cookie']?.[0] ?? '').split(';')[0] ?? '';
}

const teamPath = (n: number) => `/api/teams/${id(n)}`;
const milestonePath = (n: number) => `/api/milestones/${id(n)}`;
const read = (path: string, cookie: string) => api.get(path).set('Cookie', cookie);

it('TEST-35 scopes student reads and returns only the public fields', async () => {
  const cookie = await login('student.a1@example.test');
  const list = await read('/api/teams', cookie).expect(200);
  expect(list.headers['cache-control']).toBe('no-store');
  expect(list.body.teams.map((team: { id: string }) => team.id)).toEqual([id(101)]);
  const team = await read(teamPath(101), cookie).expect(200);
  expect(team.body.supervisor).toEqual({ id: id(1), name: 'Supervisor One' });
  expect(team.body.members).toEqual([
    { id: id(11), name: 'Student A1' }, { id: id(12), name: 'Student A2' },
  ]);
  expect(team.body.milestones).toEqual([
    { id: id(201), title: 'Project proposal draft', dueAt: '2026-10-25T12:00:00.000Z', status: 'REVIEWED' },
    { id: id(202), title: 'Prototype demo', dueAt: '2026-11-22T12:00:00.000Z', status: 'NOT_SUBMITTED' },
  ]);
  const reviewed = await read(milestonePath(201), cookie).expect(200);
  expect(reviewed.body).toMatchObject({
    id: id(201), teamId: id(101), status: 'REVIEWED',
    submission: {
      title: 'Proposal draft v1', link: 'https://example.test/team-a/proposal',
      feedback: { comment: 'Clear scope. Please add measurable goals for the next milestone.' },
    },
  });
  expect(Object.keys(reviewed.body.submission).sort()).toEqual([
    'description', 'feedback', 'id', 'link', 'submittedAt', 'title',
  ]);
  expect(Object.keys(reviewed.body.submission.feedback).sort()).toEqual(['comment', 'createdAt', 'id']);
  expect((await read(milestonePath(202), cookie).expect(200)).body.submission).toBeNull();
  const missing = await read(teamPath(999), cookie).expect(404);
  for (const path of [teamPath(102), milestonePath(203), milestonePath(999)]) {
    expect((await read(path, cookie).expect(404)).body).toEqual(missing.body);
  }
});

it('TEST-36 limits supervisor reads and summarizes their teams', async () => {
  const first = await login('supervisor1@example.test');
  const second = await login('supervisor2@example.test');
  const list = await read('/api/teams', first).expect(200);
  expect(list.body.teams).toMatchObject([
    { id: id(101), progress: { notSubmitted: 1, submitted: 0, reviewed: 1, overdue: 0 },
      nextDue: { id: id(202), title: 'Prototype demo', dueAt: '2026-11-22T12:00:00.000Z' } },
    { id: id(102), progress: { notSubmitted: 0, submitted: 1, reviewed: 0, overdue: 1 }, nextDue: null },
  ]);
  expect((await read('/api/teams', second).expect(200)).body.teams).toMatchObject([{ id: id(103) }]);
  const submitted = await read(milestonePath(204), first).expect(200);
  expect(submitted.body.status).toBe('SUBMITTED');
  expect(submitted.body.submission.feedback).toBeNull();
  await read(milestonePath(205), second).expect(200);
  const missing = await read(teamPath(999), first).expect(404);
  expect((await read(teamPath(103), first).expect(404)).body).toEqual(missing.body);
  expect((await read(milestonePath(201), second).expect(404)).body).toEqual(missing.body);
});

it('TEST-41 requires a session and validates malformed IDs after authentication', async () => {
  for (const path of ['/api/teams', teamPath(101), milestonePath(201)]) {
    await api.get(path).set('X-Role', 'SUPERVISOR').expect(401);
  }
  const cookie = await login('student.a1@example.test');
  await read('/api/teams/bad-id', cookie).expect(400);
  await read('/api/milestones/bad-id', cookie).expect(400);
});

it('TEST-38 returns an empty collection for authenticated users without assigned teams', async () => {
  const { passwordHash } = await prisma.user.findUniqueOrThrow({
    where: { email: 'student.a1@example.test' }, select: { passwordHash: true },
  });
  for (const role of ['STUDENT', 'SUPERVISOR'] as const) {
    const email = `unassigned-${role.toLowerCase()}@example.test`;
    await prisma.user.create({ data: { email, role, name: 'Unassigned', passwordHash } });
    const cookie = await login(email);
    expect((await read('/api/teams', cookie).expect(200)).body).toEqual({ teams: [] });
  }
});

it('TEST-37 uses a strict overdue boundary even on detail reads', async () => {
  clock.advance(14 * 86_400_000);
  const cookie = await login('student.a1@example.test');
  expect((await read(milestonePath(202), cookie).expect(200)).body.status).toBe('NOT_SUBMITTED');
  clock.advance(1000);
  expect((await read(milestonePath(202), cookie).expect(200)).body.status).toBe('OVERDUE');
  expect((await read(milestonePath(201), cookie).expect(200)).body.status).toBe('REVIEWED');
});
