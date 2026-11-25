import { Prisma, type PrismaClient } from '@prisma/client';
import { assertMilestoneOpen, lockMilestone } from '../domain/closed.js';
import type { Clock } from '../platform/clock.js';
import { AppError } from '../platform/errors.js';
import type { Principal } from '../security/principal.js';
import { scopeFor, teamWhere } from '../security/team-access.js';
import { assertBeforeDeadline, duplicateSubmission, type SubmissionInput } from './policy.js';

const personFields = { id: true, name: true } as const;

// Order of checks: not yours or missing (404), closed (409), already submitted (409), deadline passed (409).
// BR-01 (revised): the first submission is revisionNo 1, and the unique index on (milestoneId, revisionNo)
// means two members racing with a first submission cannot both win.
export async function submitWork(
  prisma: PrismaClient, principal: Principal, milestoneId: string, input: SubmissionInput, clock: Clock,
) {
  const now = clock.now();
  try {
    const row = await prisma.$transaction(async (tx) => {
      const visible = await tx.milestone.findFirst({
        where: { id: milestoneId, team: teamWhere(scopeFor(principal)) },
        select: { id: true },
      });
      if (!visible) throw AppError.notFound();
      // BR-09: take the row lock, then re-read closedAt, dueAt and the submissions. A close, an edit or another
      // member's submission that committed while this request waited is seen here, so the checks use fresh data.
      await lockMilestone(tx, milestoneId);
      const milestone = await tx.milestone.findUniqueOrThrow({
        where: { id: milestoneId },
        select: { closedAt: true, dueAt: true, submissions: { select: { id: true }, take: 1 } },
      });
      assertMilestoneOpen(milestone);
      if (milestone.submissions.length > 0) throw duplicateSubmission();
      assertBeforeDeadline(milestone.dueAt, now);
      return tx.submission.create({
        data: {
          milestoneId,
          title: input.title,
          description: input.description,
          link: input.link,
          submittedById: principal.userId,
          submittedAt: now,
        },
        select: {
          id: true, milestoneId: true, title: true, description: true, link: true,
          submittedAt: true, submittedBy: { select: personFields },
        },
      });
    });
    return { ...row, feedback: null };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw duplicateSubmission();
    throw error;
  }
}
