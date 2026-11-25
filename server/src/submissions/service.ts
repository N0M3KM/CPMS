import { Prisma, type PrismaClient } from '@prisma/client';
import type { Clock } from '../platform/clock.js';
import { AppError } from '../platform/errors.js';
import type { Principal } from '../security/principal.js';
import { scopeFor, teamWhere } from '../security/team-access.js';
import { assertBeforeDeadline, duplicateSubmission, type SubmissionInput } from './policy.js';

const personFields = { id: true, name: true } as const;

// Order of checks: not yours or missing (404), already submitted (409), deadline passed (409).
// BR-01 (revised): the first submission is revisionNo 1, and the unique index on (milestoneId, revisionNo)
// means two members racing with a first submission cannot both win.
export async function submitWork(
  prisma: PrismaClient, principal: Principal, milestoneId: string, input: SubmissionInput, clock: Clock,
) {
  const now = clock.now();
  try {
    const row = await prisma.$transaction(async (tx) => {
      const milestone = await tx.milestone.findFirst({
        where: { id: milestoneId, team: teamWhere(scopeFor(principal)) },
        select: { dueAt: true, submissions: { select: { id: true }, take: 1 } },
      });
      if (!milestone) throw AppError.notFound();
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
