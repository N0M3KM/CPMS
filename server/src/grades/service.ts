import { Prisma, type PrismaClient } from '@prisma/client';
import { lockMilestone } from '../domain/closed.js';
import { AppError } from '../platform/errors.js';
import type { Principal } from '../security/principal.js';
import { scopeFor, teamWhere } from '../security/team-access.js';
import { feedbackRequired, gradeExists, revisionSuperseded, type GradeInput } from './policy.js';

// Order of checks: not yours or missing (404), then 409 REVISION_SUPERSEDED, FEEDBACK_REQUIRED, GRADE_EXISTS.
// BR-10: the unique index on submissionId means two simultaneous grades cannot both succeed, and the first
// value is kept. The milestone row lock is the same one submit, revise and feedback take, so a revision that
// lands at the same moment cannot leave a grade on a superseded row. A closed milestone still accepts grades.
export async function recordGrade(
  prisma: PrismaClient, principal: Principal, submissionId: string, input: GradeInput,
) {
  try {
    return await prisma.$transaction(async (tx) => {
      const submission = await tx.submission.findFirst({
        where: { id: submissionId, milestone: { team: teamWhere(scopeFor(principal)) } },
        select: { revisionNo: true, milestoneId: true },
      });
      if (!submission) throw AppError.notFound();

      await lockMilestone(tx, submission.milestoneId);

      // Read after the lock, so a revision or a grade committed while this request waited is seen.
      const newest = await tx.submission.findFirstOrThrow({
        where: { milestoneId: submission.milestoneId },
        orderBy: { revisionNo: 'desc' },
        select: { revisionNo: true },
      });
      if (newest.revisionNo > submission.revisionNo) throw revisionSuperseded();

      const row = await tx.submission.findUniqueOrThrow({
        where: { id: submissionId },
        select: { feedback: { select: { id: true } }, grade: { select: { id: true } } },
      });
      if (!row.feedback) throw feedbackRequired();
      if (row.grade) throw gradeExists();

      return tx.grade.create({
        data: { submissionId, supervisorId: principal.userId, score: input.score },
        select: { score: true, createdAt: true, supervisor: { select: { id: true, name: true } } },
      });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw gradeExists();
    throw error;
  }
}
