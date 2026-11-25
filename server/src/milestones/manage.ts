import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { milestoneClosed } from '../domain/closed.js';
import type { Clock } from '../platform/clock.js';
import { AppError } from '../platform/errors.js';
import type { Principal } from '../security/principal.js';

// BR-03 field limits, all optional, at least one required. Unknown fields are rejected (strict).
export const patchBody = z.strictObject({
  title: z.string().trim().min(5).max(100).optional(),
  description: z.string().max(1000).optional(),
  dueAt: z.iso.datetime({ offset: true }).transform(value => new Date(value)).optional(),
}).refine(value => Object.keys(value).length > 0, { message: 'Nothing to change.' });

// Close takes no fields: {} and an empty body are both fine, any field is a 400.
export const closeBody = z.strictObject({});

export type PatchInput = z.output<typeof patchBody>;

const select = { id: true, teamId: true, title: true, description: true, dueAt: true, closedAt: true } as const;

// The supervisor filter comes from the session, so an unknown id and another team's milestone look the same.
const mine = (milestoneId: string, principal: Principal) => ({ id: milestoneId, team: { supervisorId: principal.userId } });

// After a conditional write matched nothing: not in scope is 404, in scope but closed is the caller's 409.
async function failedWrite(prisma: PrismaClient, principal: Principal, milestoneId: string, closed: () => AppError): Promise<never> {
  const found = await prisma.milestone.findFirst({ where: mine(milestoneId, principal), select: { id: true } });
  throw found ? closed() : AppError.notFound();
}

// Order of checks: dueAt in the future (400), not in scope or missing (404), already closed (409 MILESTONE_CLOSED).
export async function updateMilestone(
  prisma: PrismaClient, principal: Principal, milestoneId: string, input: PatchInput, clock: Clock,
) {
  if (input.dueAt && !(input.dueAt > clock.now())) throw AppError.validation('Choose a future due date.');
  // One conditional write: only an open milestone of this supervisor's team changes.
  const changed = await prisma.milestone.updateMany({ where: { ...mine(milestoneId, principal), closedAt: null }, data: input });
  if (changed.count === 0) return failedWrite(prisma, principal, milestoneId, milestoneClosed);
  return prisma.milestone.findUniqueOrThrow({ where: { id: milestoneId }, select });
}

// Order of checks: not in scope or missing (404), already closed (409 ALREADY_CLOSED).
export async function closeMilestone(prisma: PrismaClient, principal: Principal, milestoneId: string, clock: Clock) {
  const closedAt = clock.now();   // one clock read: the stored and the returned value are the same
  const changed = await prisma.milestone.updateMany({ where: { ...mine(milestoneId, principal), closedAt: null }, data: { closedAt } });
  if (changed.count === 1) return { id: milestoneId, closedAt };
  return failedWrite(prisma, principal, milestoneId, () => AppError.conflict('ALREADY_CLOSED', 'This milestone is already closed.'));
}
