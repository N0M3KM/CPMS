import bcrypt from 'bcrypt';
import type { PrismaClient } from '@prisma/client';
import { BCRYPT_ROUNDS } from '../auth/service.js';
import type { Clock } from '../platform/clock.js';

const MIN_PASSWORD_LENGTH = 8;
const DAY_MS = 86_400_000;

export interface SeedLogger {
  log(message: string): void;
}

export interface SeedOptions {
  studentPassword: string;
  supervisorPassword: string;
  clock: Clock;
  logger: SeedLogger;
}

export interface SeedSummary {
  supervisors: number;
  students: number;
  teams: number;
  milestones: number;
  submissions: number;
  feedback: number;
}

// Fixed identifiers make every run touch the same rows (idempotent).
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const SUPERVISORS = [
  { id: id(1), email: 'supervisor1@example.test', name: 'Supervisor One' },
  { id: id(2), email: 'supervisor2@example.test', name: 'Supervisor Two' },
];

const TEAMS = [
  { id: id(101), name: 'Team A', supervisorId: id(1), students: [{ id: id(11), email: 'student.a1@example.test', name: 'Student A1' }, { id: id(12), email: 'student.a2@example.test', name: 'Student A2' }] },
  { id: id(102), name: 'Team B', supervisorId: id(1), students: [{ id: id(13), email: 'student.b1@example.test', name: 'Student B1' }, { id: id(14), email: 'student.b2@example.test', name: 'Student B2' }] },
  { id: id(103), name: 'Team C', supervisorId: id(2), students: [{ id: id(15), email: 'student.c1@example.test', name: 'Student C1' }, { id: id(16), email: 'student.c2@example.test', name: 'Student C2' }] },
];

// Offsets are relative to the clock so statuses stay meaningful when the seed is first run.
interface MilestoneSeed {
  id: string;
  teamId: string;
  supervisorId: string;
  title: string;
  description: string;
  dueInDays: number;
  submission?: { id: string; byStudentId: string; daysBeforeDue: number; title: string; description: string; link: string };
  feedback?: { id: string; comment: string };
}

const MILESTONES: MilestoneSeed[] = [
  {
    id: id(201), teamId: id(101), supervisorId: id(1), title: 'Project proposal draft', description: 'Submit the first draft of your project proposal.', dueInDays: -14,
    submission: { id: id(301), byStudentId: id(11), daysBeforeDue: 2, title: 'Proposal draft v1', description: 'Our draft proposal covering scope, users and the first sprint plan.', link: 'https://example.test/team-a/proposal' },
    feedback: { id: id(401), comment: 'Clear scope. Please add measurable goals for the next milestone.' },
  },
  { id: id(202), teamId: id(101), supervisorId: id(1), title: 'Prototype demo', description: 'Share a link to a working prototype.', dueInDays: 14 },
  { id: id(203), teamId: id(102), supervisorId: id(1), title: 'Project proposal draft', description: 'Submit the first draft of your project proposal.', dueInDays: -7 },
  {
    id: id(204), teamId: id(102), supervisorId: id(1), title: 'Requirements review', description: 'Submit your requirements list for review.', dueInDays: 7,
    submission: { id: id(302), byStudentId: id(13), daysBeforeDue: 3, title: 'Requirements list', description: 'Numbered functional and non-functional requirements for our product.', link: 'https://example.test/team-b/requirements' },
  },
  { id: id(205), teamId: id(103), supervisorId: id(2), title: 'Project proposal draft', description: 'Submit the first draft of your project proposal.', dueInDays: 10 },
];

function requirePassword(value: string, name: string): void {
  if (value.trim().length < MIN_PASSWORD_LENGTH) {
    throw new Error(`${name} must be set to at least ${MIN_PASSWORD_LENGTH} characters`);
  }
}

// Creates synthetic data with upserts keyed on fixed IDs. Existing rows are left untouched,
// so a second run changes nothing and passwords are never re-hashed or printed.
export async function seedDatabase(prisma: PrismaClient, options: SeedOptions): Promise<SeedSummary> {
  const { studentPassword, supervisorPassword, clock, logger } = options;
  requirePassword(studentPassword, 'SEED_STUDENT_PASSWORD');
  requirePassword(supervisorPassword, 'SEED_SUPERVISOR_PASSWORD');

  const now = clock.now().getTime();
  const [studentHash, supervisorHash] = await Promise.all([
    bcrypt.hash(studentPassword, BCRYPT_ROUNDS),
    bcrypt.hash(supervisorPassword, BCRYPT_ROUNDS),
  ]);

  for (const s of SUPERVISORS) {
    await prisma.user.upsert({
      where: { id: s.id },
      update: {},
      create: { ...s, passwordHash: supervisorHash, role: 'SUPERVISOR' },
    });
  }

  for (const team of TEAMS) {
    for (const stu of team.students) {
      await prisma.user.upsert({
        where: { id: stu.id },
        update: {},
        create: { ...stu, passwordHash: studentHash, role: 'STUDENT' },
      });
    }
    await prisma.team.upsert({
      where: { id: team.id },
      update: {},
      create: { id: team.id, name: team.name, supervisorId: team.supervisorId },
    });
    for (const stu of team.students) {
      await prisma.teamMember.upsert({
        where: { teamId_studentId: { teamId: team.id, studentId: stu.id } },
        update: {},
        create: { teamId: team.id, studentId: stu.id },
      });
    }
  }

  for (const m of MILESTONES) {
    const dueAt = new Date(now + m.dueInDays * DAY_MS);
    await prisma.milestone.upsert({
      where: { id: m.id },
      update: {},
      create: { id: m.id, teamId: m.teamId, title: m.title, description: m.description, dueAt, createdById: m.supervisorId },
    });
    if (m.submission) {
      const s = m.submission;
      await prisma.submission.upsert({
        where: { id: s.id },
        update: {},
        create: {
          id: s.id, milestoneId: m.id, title: s.title, description: s.description, link: s.link,
          submittedById: s.byStudentId, submittedAt: new Date(dueAt.getTime() - s.daysBeforeDue * DAY_MS),
        },
      });
      if (m.feedback) {
        await prisma.feedback.upsert({
          where: { id: m.feedback.id },
          update: {},
          create: { id: m.feedback.id, submissionId: s.id, supervisorId: m.supervisorId, comment: m.feedback.comment },
        });
      }
    }
  }

  const summary: SeedSummary = {
    supervisors: await prisma.user.count({ where: { role: 'SUPERVISOR' } }),
    students: await prisma.user.count({ where: { role: 'STUDENT' } }),
    teams: await prisma.team.count(),
    milestones: await prisma.milestone.count(),
    submissions: await prisma.submission.count(),
    feedback: await prisma.feedback.count(),
  };
  logger.log(
    `Seed complete: ${summary.supervisors} supervisors, ${summary.students} students, ${summary.teams} teams, ` +
      `${summary.milestones} milestones, ${summary.submissions} submissions, ${summary.feedback} feedback.`,
  );
  return summary;
}
