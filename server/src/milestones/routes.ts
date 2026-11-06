import { randomUUID } from 'node:crypto';
import { Prisma, type PrismaClient } from '@prisma/client';
import type { Express } from 'express';
import { z } from 'zod';
import type { Clock } from '../platform/clock.js';
import { AppError } from '../platform/errors.js';
import type { SecurityKit } from '../security/kit.js';
import type { Principal } from '../security/principal.js';
import { parse, uuidSchema } from '../security/validate.js';

const milestoneBody = z.strictObject({
  title: z.string().trim().min(5).max(100),
  description: z.string().max(1000).optional(),
  dueAt: z.iso.datetime({ offset: true }).transform(value => new Date(value)),
});

async function createMilestone(
  prisma: PrismaClient, principal: Principal, teamId: string,
  input: z.output<typeof milestoneBody>, clock: Clock,
) {
  if (!(input.dueAt > clock.now())) throw AppError.validation('Choose a future due date.');

  const id = randomUUID();
  // The scoped parent lookup and milestone insert form one nested write.
  const team = await prisma.team.update({
    where: { id: teamId, supervisorId: principal.userId },
    data: {
      milestones: {
        create: { ...input, id, createdBy: { connect: { id: principal.userId } } },
      },
    },
    select: {
      milestones: {
        where: { id },
        select: { id: true, teamId: true, title: true, description: true, dueAt: true, createdAt: true },
      },
    },
  }).catch((error: unknown) => {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      throw AppError.notFound();
    }
    throw error;
  });
  const [milestone] = team.milestones;
  if (!milestone) throw new Error('Created milestone missing from write result');
  return { ...milestone, status: 'NOT_SUBMITTED' as const };
}

export function mountMilestoneWrites(
  app: Express, security: SecurityKit, prisma: PrismaClient, clock: Clock,
): void {
  app.post(
    '/api/teams/:teamId/milestones',
    security.requireAuth,
    security.requireRole('SUPERVISOR'),
    ...security.jsonBody,
    async (req, res) => {
      const teamId = parse(uuidSchema, req.params.teamId);
      const input = parse(milestoneBody, req.body);
      const milestone = await createMilestone(prisma, req.principal!, teamId, input, clock);
      res.status(201).json(milestone);
    },
  );
}
