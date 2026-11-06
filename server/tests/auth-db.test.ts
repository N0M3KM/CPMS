import bcrypt from 'bcrypt';
import request from 'supertest';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { prismaAuthStore } from '../src/auth/store.js';
import { createApp } from '../src/platform/app.js';
import { fixedClock } from '../src/platform/clock.js';
import { dbChecker } from '../src/platform/db.js';
import { seedDatabase } from '../src/seed/seed.js';
import { createTestPrisma, resetDb } from './helpers/db.js';

const prisma = createTestPrisma();
const clock = fixedClock(new Date('2026-11-06T08:00:00Z'));
const studentPassword = 'synthetic-student-password';
const supervisorPassword = 'synthetic-supervisor-password';
const api = request(createApp({
  checkDb: dbChecker(prisma),
  auth: {
    store: prismaAuthStore(prisma),
    clock,
    ttlHours: 1,
    secure: false,
    allowedOrigin: 'http://localhost:5173',
  },
}));

beforeAll(async () => {
  await resetDb(prisma);
  await seedDatabase(prisma, { studentPassword, supervisorPassword, clock, logger: { log() {} } });
});

afterAll(async () => {
  await prisma.$disconnect();
});

function cookie(response: request.Response): string {
  return (response.headers['set-cookie']?.[0] ?? '').split(';')[0] ?? '';
}

function id(sessionCookie: string): string {
  return sessionCookie.slice('cpms_session='.length);
}

it('TEST-01 to TEST-06 exercise seeded authentication and session persistence in PostgreSQL', async () => {
  const studentEmail = 'student.a1@example.test';
  const credentials = await prisma.user.findUniqueOrThrow({ where: { email: studentEmail } });
  expect(credentials.passwordHash).toMatch(/^\$2[aby]\$/);
  expect(credentials.passwordHash).not.toBe(studentPassword);
  expect(await bcrypt.compare(studentPassword, credentials.passwordHash)).toBe(true);

  const login = (email: string, password: string, prior = '') =>
    api.post('/api/auth/login').set('Origin', 'http://localhost:5173').set('Cookie', prior).send({ email, password });

  expect((await login(studentEmail, 'incorrect')).status).toBe(401);
  expect(await prisma.session.count()).toBe(0);

  const student = await login(studentEmail, studentPassword);
  expect(student.status).toBe(200);
  expect(student.body.user.role).toBe('STUDENT');
  const first = cookie(student);
  const stored = await prisma.session.findUniqueOrThrow({ where: { id: id(first) } });
  expect(stored.userId).toBe(credentials.id);
  expect(stored.expiresAt.getTime()).toBe(clock.now().getTime() + 3_600_000);

  const supervisor = await login('supervisor1@example.test', supervisorPassword, first);
  expect(supervisor.status).toBe(200);
  expect(supervisor.body.user.role).toBe('SUPERVISOR');
  const rotated = cookie(supervisor);
  expect(await prisma.session.findUnique({ where: { id: id(first) } })).toBeNull();
  expect((await api.get('/api/auth/me').set('Cookie', first)).status).toBe(401);
  expect((await api.get('/api/auth/me').set('Cookie', rotated)).body).toEqual(supervisor.body.user);
  expect((await api.post('/api/auth/logout').set('Origin', 'http://localhost:5173').set('Cookie', rotated)).status).toBe(200);
  expect(await prisma.session.count()).toBe(0);

  const expiring = cookie(await login(studentEmail, studentPassword));
  clock.advance(3_600_000);
  expect((await api.get('/api/auth/me').set('Cookie', expiring)).status).toBe(401);
});
