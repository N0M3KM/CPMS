import type { PrismaClient } from '@prisma/client';
import type { Express } from 'express';
import type { Clock } from '../platform/clock.js';
import type { SecurityKit } from '../security/kit.js';
import { principalOf } from '../security/principal.js';
import { parse, uuidSchema } from '../security/validate.js';
import { submissionSchema } from './policy.js';
import { submitWork } from './service.js';

export function mountSubmissionWrites(app: Express, security: SecurityKit, prisma: PrismaClient, clock: Clock): void {
  app.post(
    '/api/milestones/:milestoneId/submission',
    security.requireAuth,
    security.requireRole('STUDENT'),
    ...security.jsonBody,
    async (req, res) => {
      const milestoneId = parse(uuidSchema, req.params.milestoneId);
      const input = parse(submissionSchema, req.body);
      res.status(201).json(await submitWork(prisma, principalOf(req), milestoneId, input, clock));
    },
  );
}
