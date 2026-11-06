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
