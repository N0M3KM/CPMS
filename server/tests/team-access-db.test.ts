import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { fixedClock } from '../src/platform/clock.js';
import { AppError } from '../src/platform/errors.js';
import { seedDatabase } from '../src/seed/seed.js';
import { AuthorizedTeamAccess, prismaTeamAccess } from '../src/security/team-access.js';
import { createTestPrisma, resetDb } from './helpers/db.js';

const prisma = createTestPrisma();
const access = new AuthorizedTeamAccess(prismaTeamAccess(prisma));
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const TEAM_A = id(101);
const TEAM_B = id(102);
const TEAM_C = id(103);
const student = (n: number) => ({ userId: id(n), role: 'STUDENT' as const });
const supervisor = (n: number) => ({ userId: id(n), role: 'SUPERVISOR' as const });

describe('team scope against PostgreSQL (BR-06)', () => {
  beforeAll(async () => {
    await resetDb(prisma);
    await seedDatabase(prisma, {
      studentPassword: 'student-pw-for-test-1',
      supervisorPassword: 'supervisor-pw-for-test-1',
      clock: fixedClock(new Date('2026-11-08T12:00:00Z')),
      logger: { log: () => undefined },
    });
  });
  afterAll(() => prisma.$disconnect());

  it('resolves a student own team only', async () => {
    expect((await access.requireTeam(student(11), TEAM_A)).id).toBe(TEAM_A);
    await expect(access.requireTeam(student(11), TEAM_B)).rejects.toMatchObject({ status: 404 });
    await expect(access.requireTeam(student(13), TEAM_A)).rejects.toMatchObject({ status: 404 });
  });

  it('resolves supervised teams only', async () => {
    expect((await access.requireTeam(supervisor(1), TEAM_A)).id).toBe(TEAM_A);
    expect((await access.requireTeam(supervisor(1), TEAM_B)).id).toBe(TEAM_B);
    await expect(access.requireTeam(supervisor(1), TEAM_C)).rejects.toMatchObject({ status: 404 });
    expect((await access.requireTeam(supervisor(2), TEAM_C)).id).toBe(TEAM_C);
    await expect(access.requireTeam(supervisor(2), TEAM_A)).rejects.toMatchObject({ status: 404 });
  });

  it('gives a foreign team and a missing team the identical error', async () => {
    const foreign = await access.requireTeam(student(11), TEAM_B).catch((e: unknown) => e);
    const missing = await access.requireTeam(student(11), id(999)).catch((e: unknown) => e);
    expect(foreign).toBeInstanceOf(AppError);
    expect(missing).toBeInstanceOf(AppError);
    expect({ status: (foreign as AppError).status, code: (foreign as AppError).code, message: (foreign as AppError).message }).toEqual({
      status: (missing as AppError).status,
      code: (missing as AppError).code,
      message: (missing as AppError).message,
    });
  });

  it('treats SQL-looking ids as data, never as a query', async () => {
    await expect(access.requireTeam(student(11), "' OR 1=1--")).rejects.toMatchObject({ status: 400, code: 'VALIDATION_ERROR' });
    expect(await prisma.team.count()).toBe(3);
  });
});
