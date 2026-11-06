import bcrypt from 'bcrypt';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { fixedClock } from '../src/platform/clock.js';
import { seedDatabase } from '../src/seed/seed.js';
import { createTestPrisma, resetDb } from './helpers/db.js';

const prisma = createTestPrisma();
const STUDENT_PW = 'student-pw-for-test-1';
const SUPERVISOR_PW = 'supervisor-pw-for-test-1';
const clock = fixedClock(new Date('2026-11-08T12:00:00Z'));

function collectingLogger() {
  const lines: string[] = [];
  return { lines, log: (m: string) => void lines.push(m) };
}

async function seed(logger = collectingLogger()) {
  const summary = await seedDatabase(prisma, { studentPassword: STUDENT_PW, supervisorPassword: SUPERVISOR_PW, clock, logger });
  return { summary, logger };
}

async function counts() {
  const [users, teams, members, milestones, submissions, feedback] = await Promise.all([
    prisma.user.count(), prisma.team.count(), prisma.teamMember.count(),
    prisma.milestone.count(), prisma.submission.count(), prisma.feedback.count(),
  ]);
  return { users, teams, members, milestones, submissions, feedback };
}

describe('seed (AC-33, AC-34)', () => {
  beforeEach(() => resetDb(prisma));
  afterAll(() => prisma.$disconnect());

  it('AC-33: creates 2 supervisors, 6 students, 3 teams with 2 members each', async () => {
    await seed();
    expect(await prisma.user.count({ where: { role: 'SUPERVISOR' } })).toBe(2);
    expect(await prisma.user.count({ where: { role: 'STUDENT' } })).toBe(6);
    const teams = await prisma.team.findMany({ include: { members: true, supervisor: true }, orderBy: { name: 'asc' } });
    expect(teams.map((t) => t.name)).toEqual(['Team A', 'Team B', 'Team C']);
    expect(teams.every((t) => t.members.length === 2)).toBe(true);
    const bySupervisor = teams.map((t) => t.supervisor.email);
    expect(bySupervisor[0]).toBe(bySupervisor[1]);
    expect(bySupervisor[2]).not.toBe(bySupervisor[0]);
  });

  it('AC-33: milestones cover NOT_SUBMITTED, OVERDUE, SUBMITTED and REVIEWED', async () => {
    await seed();
    const now = clock.now();
    const milestones = await prisma.milestone.findMany({ include: { submission: { include: { feedback: true } } } });
    const status = (m: (typeof milestones)[number]) =>
      m.submission?.feedback ? 'REVIEWED' : m.submission ? 'SUBMITTED' : m.dueAt < now ? 'OVERDUE' : 'NOT_SUBMITTED';
    const seen = new Set(milestones.map(status));
    expect([...seen].sort()).toEqual(['NOT_SUBMITTED', 'OVERDUE', 'REVIEWED', 'SUBMITTED']);
  });

  it('AC-33: seeded submissions come from a member of the milestone team and feedback from its supervisor', async () => {
    await seed();
    const submissions = await prisma.submission.findMany({ include: { milestone: { include: { team: { include: { members: true } } } }, feedback: true } });
    expect(submissions.length).toBeGreaterThan(0);
    for (const s of submissions) {
      expect(s.milestone.team.members.map((m) => m.studentId)).toContain(s.submittedById);
      if (s.feedback) expect(s.feedback.supervisorId).toBe(s.milestone.team.supervisorId);
    }
  });

  it('AC-33: credentials come from the supplied passwords and are stored only as bcrypt hashes', async () => {
    await seed();
    const student = await prisma.user.findFirstOrThrow({ where: { role: 'STUDENT' } });
    const supervisor = await prisma.user.findFirstOrThrow({ where: { role: 'SUPERVISOR' } });
    expect(await bcrypt.compare(STUDENT_PW, student.passwordHash)).toBe(true);
    expect(await bcrypt.compare(SUPERVISOR_PW, supervisor.passwordHash)).toBe(true);
    expect(student.passwordHash).toMatch(/^\$2[aby]\$/);
    const all = await prisma.user.findMany();
    expect(all.some((u) => u.passwordHash.includes(STUDENT_PW) || u.passwordHash.includes(SUPERVISOR_PW))).toBe(false);
  });

  it('AC-33: refuses to seed without usable passwords', async () => {
    const logger = collectingLogger();
    await expect(seedDatabase(prisma, { studentPassword: '', supervisorPassword: SUPERVISOR_PW, clock, logger })).rejects.toThrow(/SEED_STUDENT_PASSWORD/);
    await expect(seedDatabase(prisma, { studentPassword: STUDENT_PW, supervisorPassword: 'short', clock, logger })).rejects.toThrow(/SEED_SUPERVISOR_PASSWORD/);
    expect((await counts()).users).toBe(0);
  });

  it('AC-34: running the seed twice duplicates nothing', async () => {
    await seed();
    const first = await counts();
    const ids = (await prisma.user.findMany({ orderBy: { email: 'asc' } })).map((u) => u.id);
    await seed();
    expect(await counts()).toEqual(first);
    expect((await prisma.user.findMany({ orderBy: { email: 'asc' } })).map((u) => u.id)).toEqual(ids);
  });

  it('AC-34: a second run does not rewrite existing password hashes', async () => {
    await seed();
    const before = (await prisma.user.findMany({ orderBy: { email: 'asc' } })).map((u) => u.passwordHash);
    await seed();
    const after = (await prisma.user.findMany({ orderBy: { email: 'asc' } })).map((u) => u.passwordHash);
    expect(after).toEqual(before);
  });

  it('AC-34: logs never contain the password values', async () => {
    const logger = collectingLogger();
    await seed(logger);
    await seed(logger);
    const output = logger.lines.join('\n');
    expect(output.length).toBeGreaterThan(0);
    expect(output).not.toContain(STUDENT_PW);
    expect(output).not.toContain(SUPERVISOR_PW);
  });
});
