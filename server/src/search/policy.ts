import { z } from 'zod';
import { uuidSchema } from '../security/validate.js';

const decimal = z.string().regex(/^\d+$/).transform(Number);

export const searchQuerySchema = z.strictObject({
  q: z.string().trim().max(100).refine(value => !value.includes('\0')).optional(),
  status: z.enum(['NOT_SUBMITTED', 'SUBMITTED', 'REVIEWED', 'OVERDUE', 'CLOSED']).optional(),
  teamId: uuidSchema.optional(),
  page: decimal.pipe(z.int().min(1)).default(1),
  limit: decimal.pipe(z.int().min(1).max(50)).default(20),
});
