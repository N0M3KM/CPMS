import request from 'supertest';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { prismaAuthStore } from '../src/auth/store.js';
import { mountMilestoneWrites } from '../src/milestones/routes.js';
import { createApp } from '../src/platform/app.js';
import { fixedClock } from '../src/platform/clock.js';
import { dbChecker } from '../src/platform/db.js';
import { seedDatabase } from '../src/seed/seed.js';
import { prismaTeamAccess } from '../src/security/team-access.js';
import { mountScopedViews } from '../src/views/routes.js';
import { createTestPrisma, resetDb } from './helpers/db.js';

const prisma = createTestPrisma();
const clock = fixedClock(new Date('2026-11-08T12:00:00Z'));
const password = 'synthetic-test-password';
const origin = 'http://localhost:5173';
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const teamId = id(101);
const valid = { title: 'Design review', dueAt: '2026-11-09T12:00:00.000Z' };
const api = request(createApp({
  checkDb: dbChecker(prisma),
  auth: { store: prismaAuthStore(prisma), clock, ttlHours: 1, secure: false, allowedOrigin: origin },
  teamAccess: prismaTeamAccess(prisma),
  mountRoutes(app, security) {
    mountScopedViews(app, security, prisma, clock);
    mountMilestoneWrites(app, security, prisma, clock);
  },
}));
let supervisor: string;
let student: string;

async function login(email: string): Promise<string> {
  const response = await api.post('/api/auth/login').set('Origin', origin).send({ email, password }).expect(200);
  return (response.headers['set-cookie']?.[0] ?? '').split(';')[0] ?? '';
}

beforeAll(async () => {
  await resetDb(prisma);
  await seedDatabase(prisma, {
    studentPassword: password, supervisorPassword: password, clock, logger: { log() {} },
  });
  supervisor = await login('supervisor1@example.test');
  student = await login('student.a1@example.test');
});

afterAll(() => prisma.$disconnect());

function create(cookie: string, team = teamId) {
  return api.post(`/api/teams/${team}/milestones`).set('Origin', origin).set('Cookie', cookie);
}

it('TEST-17 persists boundary-length milestones and lists them for the team', async () => {
  const created = [];
  for (const input of [
    { title: '12345', dueAt: valid.dueAt },
    { title: 'T'.repeat(100), description: 'D'.repeat(1000), dueAt: '2026-11-09T19:00:00+07:00' },
  ]) {
    const { body } = await create(supervisor).send(input).expect(201);
    expect(body).toEqual({
      id: expect.any(String), teamId, title: input.title, description: input.description ?? '',
      dueAt: valid.dueAt, createdAt: expect.any(String), status: 'NOT_SUBMITTED',
    });
    expect(await prisma.milestone.findUnique({ where: { id: body.id } })).toMatchObject({
      teamId, createdById: id(1), title: input.title, description: input.description ?? '',
      dueAt: new Date(valid.dueAt),
    });
    created.push({ id: body.id, title: input.title, dueAt: valid.dueAt, status: 'NOT_SUBMITTED' });
  }
  const { body } = await api.get(`/api/teams/${teamId}`).set('Cookie', student).expect(200);
  expect(body.milestones).toEqual(expect.arrayContaining(created));
});

it('TEST-18 rejects invalid fields, spoofed creator and malformed team IDs without creating rows', async () => {
  const count = await prisma.milestone.count();
  for (const body of [
    { ...valid, title: '1234' },
    { ...valid, title: 'T'.repeat(101) },
    { ...valid, description: 'D'.repeat(1001) },
    { dueAt: valid.dueAt },
    { ...valid, dueAt: 'tomorrow' },
    { ...valid, dueAt: '2026-02-30T12:00:00Z' },
    { ...valid, createdById: id(2) },
  ]) {
    const result = await create(supervisor).send(body).expect(400);
    expect(result.body.error.code).toBe('VALIDATION_ERROR');
  }
  await create(supervisor, 'bad-id').send(valid).expect(400);
  expect(await prisma.milestone.count()).toBe(count);
});

it('TEST-19 rejects a past deadline and one equal to the current instant', async () => {
  const count = await prisma.milestone.count();
  for (const dueAt of [clock.now().toISOString(), new Date(clock.now().getTime() - 1).toISOString()]) {
    await create(supervisor).send({ ...valid, dueAt }).expect(400);
  }
  expect(await prisma.milestone.count()).toBe(count);
});

it('TEST-20 and AC-11 deny students, anonymous callers and foreign supervisors', async () => {
  const count = await prisma.milestone.count();
  await create(student).send(valid).expect(403);
  await create('').send(valid).expect(401);
  const foreign = await create(supervisor, id(103)).send(valid).expect(404);
  const missing = await create(supervisor, id(999)).send(valid).expect(404);
  expect(foreign.body).toEqual(missing.body);
  expect(await prisma.milestone.count()).toBe(count);
});
