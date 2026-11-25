import { Prisma, type PrismaClient } from '@prisma/client';
import { assertMilestoneOpen, lockMilestone } from '../domain/closed.js';
import type { Clock } from '../platform/clock.js';
import { AppError } from '../platform/errors.js';
import type { Principal } from '../security/principal.js';
import { scopeFor, teamWhere } from '../security/team-access.js';
import { assertBeforeDeadline, type SubmissionInput } from './policy.js';

const personFields = { id: true, name: true } as const;

export const MAX_REVISIONS = 5; // total versions, the first submission included

export function assertRevisionAllowed(latestRevisionNo: number): void {
  if (latestRevisionNo >= MAX_REVISIONS) {
    throw AppError.conflict('REVISION_LIMIT', `A milestone allows at most ${MAX_REVISIONS} versions (revision limit).`);
  }
}

// BR-08. Order of checks: not yours or missing (404), no first submission (409), closed (409),
// deadline passed (409), revision limit (409). The milestone row lock serializes two members revising
// at the same time, so both succeed as N+1 and N+2; the unique index on (milestoneId, revisionNo) and the
// CHECK on revisionNo stay as backstops and P2002 is mapped to REVISION_CONFLICT.
export async function reviseWork(
  prisma: PrismaClient, principal: Principal, milestoneId: string, input: SubmissionInput, clock: Clock,
) {
  const now = clock.now();
  try {
    return await prisma.$transaction(async (tx) => {
      const visible = await tx.milestone.findFirst({
        where: { id: milestoneId, team: teamWhere(scopeFor(principal)) },
        select: { id: true },
      });
      if (!visible) throw AppError.notFound();
      await lockMilestone(tx, milestoneId);
      // Re-read after the lock: a close, a first submission or another revision may have just committed.
      const milestone = await tx.milestone.findUniqueOrThrow({
        where: { id: milestoneId },
        select: {
          dueAt: true,
          closedAt: true,
          submissions: { orderBy: { revisionNo: 'desc' }, take: 1, select: { revisionNo: true } },
        },
      });
      const latest = milestone.submissions[0];
      if (!latest) throw AppError.conflict('NO_SUBMISSION', 'Submit the first version before revising.');
      assertMilestoneOpen(milestone);
      assertBeforeDeadline(milestone.dueAt, now);
      assertRevisionAllowed(latest.revisionNo);
      const row = await tx.submission.create({
        data: {
          milestoneId,
          title: input.title,
          description: input.description,
          link: input.link,
          submittedById: principal.userId,
          submittedAt: now,
          revisionNo: latest.revisionNo + 1,
        },
        select: {
          id: true, milestoneId: true, revisionNo: true, title: true, description: true, link: true,
          submittedAt: true, submittedBy: { select: personFields },
        },
      });
      return { ...row, feedback: null, grade: null };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw AppError.conflict('REVISION_CONFLICT', 'Another revision was saved at the same time. Reload and try again.');
    }
    throw error;
  }
}
