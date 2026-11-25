import type { Prisma } from '@prisma/client';
import { AppError } from '../platform/errors.js';

// One place for the closed-milestone rule (BR-09). Submit and revise call it after taking the row lock; edit and
// close use a conditional write on closedAt instead, which enforces the same rule in one statement.
export const milestoneClosed = () => AppError.conflict('MILESTONE_CLOSED', 'This milestone is closed.');

export function assertMilestoneOpen(milestone: { closedAt: Date | null }): void {
  if (milestone.closedAt) throw milestoneClosed();
}

// Takes a row lock on the milestone inside a transaction. Submit, revise, feedback and grade all take it,
// so a close, a revision or a first submission that arrives at the same moment is serialized.
export async function lockMilestone(tx: Prisma.TransactionClient, milestoneId: string): Promise<void> {
  await tx.$queryRaw`SELECT 1 FROM "Milestone" WHERE id = ${milestoneId}::uuid FOR UPDATE`;
}
