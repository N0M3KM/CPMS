import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createTestPrisma, resetDb } from './helpers/db.js';

const prisma = createTestPrisma();

async function user(role: 'STUDENT' | 'SUPERVISOR', email: string) {
  return prisma.user.create({ data: { email, name: email, passwordHash: 'x', role } });
}

describe('schema constraints', () => {
  beforeEach(() => resetDb(prisma));
  afterAll(() => prisma.$disconnect());

  it('rejects a duplicate email', async () => {
    await user('STUDENT', 'a@example.test');
    await expect(user('STUDENT', 'a@example.test')).rejects.toThrow();
  });

  it('rejects a student who belongs to two teams (SRS D-05)', async () => {
    const sup = await user('SUPERVISOR', 's@example.test');
    const stu = await user('STUDENT', 'a@example.test');
    const t1 = await prisma.team.create({ data: { name: 'T1', supervisorId: sup.id } });
    const t2 = await prisma.team.create({ data: { name: 'T2', supervisorId: sup.id } });
    await prisma.teamMember.create({ data: { teamId: t1.id, studentId: stu.id } });
    await expect(prisma.teamMember.create({ data: { teamId: t2.id, studentId: stu.id } })).rejects.toThrow();
  });

  it('rejects a second submission for one milestone (BR-01)', async () => {
    const { milestone, student } = await milestoneFixture();
    const data = { milestoneId: milestone.id, title: 'First work', description: 'd'.repeat(20), link: 'https://example.test/a', submittedById: student.id, submittedAt: new Date() };
    await prisma.submission.create({ data });
    await expect(prisma.submission.create({ data })).rejects.toThrow();
  });

  it('rejects a second feedback for one submission (BR-05)', async () => {
    const { milestone, student, supervisor } = await milestoneFixture();
    const sub = await prisma.submission.create({
      data: { milestoneId: milestone.id, title: 'First work', description: 'd'.repeat(20), link: 'https://example.test/a', submittedById: student.id, submittedAt: new Date() },
    });
    const fb = { submissionId: sub.id, supervisorId: supervisor.id, comment: 'Looks good overall.' };
    await prisma.feedback.create({ data: fb });
    await expect(prisma.feedback.create({ data: fb })).rejects.toThrow();
  });

  it('rejects a submission that points to a missing milestone', async () => {
    const student = await user('STUDENT', 'a@example.test');
    await expect(
      prisma.submission.create({ data: { milestoneId: randomUUID(), title: 'First work', description: 'd'.repeat(20), link: 'https://example.test/a', submittedById: student.id, submittedAt: new Date() } }),
    ).rejects.toThrow();
  });

  // Sprint 2 foundation (F-08, F-09, F-10): versioned submissions, closedAt, grades.
  it('allows revision 2, rejects a duplicate revision number and revisionNo 6 (BR-01 revised, BR-08)', async () => {
    const { milestone, student } = await milestoneFixture();
    const base = { milestoneId: milestone.id, title: 'Second revision', description: 'd'.repeat(20), link: 'https://example.test/r2', submittedById: student.id, submittedAt: new Date() };
    await prisma.submission.create({ data: { ...base, revisionNo: 1 } });
    await prisma.submission.create({ data: { ...base, revisionNo: 2 } });
    await expect(prisma.submission.create({ data: { ...base, revisionNo: 2 } })).rejects.toMatchObject({ code: 'P2002' });
    await expect(prisma.submission.create({ data: { ...base, revisionNo: 6 } })).rejects.toThrow();
  });

  it('keeps closedAt null until a milestone is closed (BR-09)', async () => {
    const { milestone } = await milestoneFixture();
    expect((await prisma.milestone.findUniqueOrThrow({ where: { id: milestone.id } })).closedAt).toBeNull();
    const closedAt = new Date();
    await prisma.milestone.update({ where: { id: milestone.id }, data: { closedAt } });
    expect((await prisma.milestone.findUniqueOrThrow({ where: { id: milestone.id } })).closedAt).toEqual(closedAt);
  });

  it('allows one grade per submission and rejects a score outside 0 to 100 (BR-10)', async () => {
    const { milestone, student, supervisor } = await milestoneFixture();
    const sub = await prisma.submission.create({
      data: { milestoneId: milestone.id, title: 'Graded work', description: 'd'.repeat(20), link: 'https://example.test/g', submittedById: student.id, submittedAt: new Date() },
    });
    await prisma.grade.create({ data: { submissionId: sub.id, supervisorId: supervisor.id, score: 90 } });
    await expect(prisma.grade.create({ data: { submissionId: sub.id, supervisorId: supervisor.id, score: 80 } })).rejects.toMatchObject({ code: 'P2002' });
    const other = await prisma.submission.create({
      data: { milestoneId: milestone.id, revisionNo: 2, title: 'Graded work 2', description: 'd'.repeat(20), link: 'https://example.test/g2', submittedById: student.id, submittedAt: new Date() },
    });
    await expect(prisma.grade.create({ data: { submissionId: other.id, supervisorId: supervisor.id, score: 101 } })).rejects.toThrow();
    await expect(prisma.grade.create({ data: { submissionId: other.id, supervisorId: supervisor.id, score: -1 } })).rejects.toThrow();
  });
});

async function milestoneFixture() {
  const supervisor = await user('SUPERVISOR', 's@example.test');
  const student = await user('STUDENT', 'a@example.test');
  const team = await prisma.team.create({ data: { name: 'T1', supervisorId: supervisor.id } });
  await prisma.teamMember.create({ data: { teamId: team.id, studentId: student.id } });
  const milestone = await prisma.milestone.create({
    data: { teamId: team.id, title: 'Milestone one', description: '', dueAt: new Date(Date.now() + 86_400_000), createdById: supervisor.id },
  });
  return { supervisor, student, team, milestone };
}
