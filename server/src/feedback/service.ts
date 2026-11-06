import { Prisma, type PrismaClient } from '@prisma/client';
import { AppError } from '../platform/errors.js';
import type { Principal } from '../security/principal.js';
import { scopeFor, teamWhere } from '../security/team-access.js';
import { feedbackExists, type FeedbackInput } from './policy.js';

// Order of checks: not yours or missing (404), feedback already recorded (409).
// BR-05 is enforced by the unique index on submissionId, so two simultaneous requests
// cannot both succeed. Feedback is never updated or deleted in Sprint 1.
export async function recordFeedback(
  prisma: PrismaClient, principal: Principal, submissionId: string, input: FeedbackInput,
) {
  try {
    return await prisma.$transaction(async (tx) => {
      const submission = await tx.submission.findFirst({
        where: { id: submissionId, milestone: { team: teamWhere(scopeFor(principal)) } },
        select: { feedback: { select: { id: true } } },
      });
      if (!submission) throw AppError.notFound();
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
