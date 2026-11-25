import { Prisma, type PrismaClient } from '@prisma/client';
import { lockMilestone } from '../domain/closed.js';
import { AppError } from '../platform/errors.js';
import type { Principal } from '../security/principal.js';
import { scopeFor, teamWhere } from '../security/team-access.js';
import { feedbackExists, type FeedbackInput } from './policy.js';

// Order of checks: not yours or missing (404), superseded revision (409), feedback already recorded (409).
// BR-05 is enforced by the unique index on submissionId, so two simultaneous requests
// cannot both succeed. Feedback is never updated or deleted in Sprint 1.
export async function recordFeedback(
  prisma: PrismaClient, principal: Principal, submissionId: string, input: FeedbackInput,
) {
  try {
    return await prisma.$transaction(async (tx) => {
      const submission = await tx.submission.findFirst({
        where: { id: submissionId, milestone: { team: teamWhere(scopeFor(principal)) } },
        select: { milestoneId: true, revisionNo: true, feedback: { select: { id: true } } },
      });
      if (!submission) throw AppError.notFound();
      // BR-05 (F-08): only the current revision takes feedback. The milestone lock is shared with submit and
      // revise, so a revision that lands at the same moment cannot leave feedback on a superseded row.
      await lockMilestone(tx, submission.milestoneId);
      const newest = await tx.submission.findFirstOrThrow({
        where: { milestoneId: submission.milestoneId }, orderBy: { revisionNo: 'desc' }, select: { revisionNo: true },
      });
      if (newest.revisionNo > submission.revisionNo) {
        throw AppError.conflict('REVISION_SUPERSEDED', 'This version has been replaced by a newer one. Give feedback on the latest version.');
      }
      if (submission.feedback) throw feedbackExists();
      return tx.feedback.create({
        data: { submissionId, supervisorId: principal.userId, comment: input.comment },
        select: {
          id: true, submissionId: true, comment: true, createdAt: true,
          supervisor: { select: { id: true, name: true } },
        },
      });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw feedbackExists();
    throw error;
  }
}
