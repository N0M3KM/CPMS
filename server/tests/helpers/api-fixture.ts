import type { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { prismaAuthStore } from '../../src/auth/store.js';
import { createApp } from '../../src/platform/app.js';
import { fixedClock } from '../../src/platform/clock.js';
import { dbChecker } from '../../src/platform/db.js';
import { mountFeatureRoutes } from '../../src/routes.js';
import { seedDatabase } from '../../src/seed/seed.js';
import { prismaTeamAccess } from '../../src/security/team-access.js';
import { resetDb } from './db.js';

// One shared API fixture for the Sprint 2 and Sprint 3 database tests (F-08 to F-12), so every test file
// builds the app, resets and seeds the _test database and signs in the same way.
export const ORIGIN = 'http://localhost:5173';
export const PASSWORD = 'synthetic-test-password';
export const SEED_NOW = new Date('2026-11-08T12:00:00Z');
export const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

// Seed ids: milestone 201 (Team A, reviewed, submission 301), 202 "Prototype demo" (Team A, open, no submission),
// 204 (Team B), 205 (Team C); submission 302 (Team B, no feedback). Supervisor S1 supervises Teams A and B,
// S2 supervises Team C. Teams: A = id(101), B = id(102), C = id(103). Students: A1 = id(11), A2 = id(12), B1 = id(13).
export const validSubmission = {
  title: 'Prototype demo v1',
  description: 'A working prototype with a short description.',
  link: 'https://example.test/team-a/prototype',
};

export function createApiFixture(prisma: PrismaClient) {
  const clock = fixedClock(SEED_NOW);
  const api = request(createApp({
    checkDb: dbChecker(prisma),
    auth: { store: prismaAuthStore(prisma), clock, ttlHours: 1, secure: false, allowedOrigin: ORIGIN },
    teamAccess: prismaTeamAccess(prisma),
    mountRoutes: (app, security) => mountFeatureRoutes(app, security, prisma, clock),
  }));

  async function reset(): Promise<void> {
    clock.advance(SEED_NOW.getTime() - clock.now().getTime());
    await resetDb(prisma);
    await seedDatabase(prisma, { studentPassword: PASSWORD, supervisorPassword: PASSWORD, clock, logger: { log() {} } });
  }

  // Call sequentially: the login throttle counts simultaneous attempts per IP (limit 5), so tests that
  // send concurrent writes sign in first and send the concurrent requests afterwards.
  async function login(email: string): Promise<string> {
    const res = await api.post('/api/auth/login').set('Origin', ORIGIN).send({ email, password: PASSWORD }).expect(200);
    return (res.headers['set-cookie']?.[0] ?? '').split(';')[0] ?? '';
  }

  const as = (cookie: string) => ({
    get: (url: string) => api.get(url).set('Cookie', cookie),
    post: (url: string) => api.post(url).set('Origin', ORIGIN).set('Cookie', cookie),
    patch: (url: string) => api.patch(url).set('Origin', ORIGIN).set('Cookie', cookie),
  });

  return { api, clock, reset, login, as };
}
