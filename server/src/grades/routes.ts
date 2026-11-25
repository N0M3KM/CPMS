import type { PrismaClient } from '@prisma/client';
import type { Express } from 'express';
import type { SecurityKit } from '../security/kit.js';
import { principalOf } from '../security/principal.js';
import { parse, uuidSchema } from '../security/validate.js';
import { gradeSchema } from './policy.js';
import { recordGrade } from './service.js';

export function mountGradeWrites(app: Express, security: SecurityKit, prisma: PrismaClient): void {
  app.post(
    '/api/submissions/:submissionId/grade',
    security.requireAuth,
    security.requireRole('SUPERVISOR'),
    ...security.jsonBody,
    async (req, res) => {
      const submissionId = parse(uuidSchema, req.params.submissionId);
      const input = parse(gradeSchema, req.body);
      res.status(201).json(await recordGrade(prisma, principalOf(req), submissionId, input));
    },
  );
}
