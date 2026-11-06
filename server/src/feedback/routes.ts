import type { PrismaClient } from '@prisma/client';
import type { Express } from 'express';
import type { SecurityKit } from '../security/kit.js';
import { principalOf } from '../security/principal.js';
import { parse, uuidSchema } from '../security/validate.js';
import { feedbackSchema } from './policy.js';
import { recordFeedback } from './service.js';

export function mountFeedbackWrites(app: Express, security: SecurityKit, prisma: PrismaClient): void {
  app.post(
    '/api/submissions/:submissionId/feedback',
    security.requireAuth,
    security.requireRole('SUPERVISOR'),
    ...security.jsonBody,
    async (req, res) => {
      const submissionId = parse(uuidSchema, req.params.submissionId);
      const input = parse(feedbackSchema, req.body);
      res.status(201).json(await recordFeedback(prisma, principalOf(req), submissionId, input));
    },
  );
}
