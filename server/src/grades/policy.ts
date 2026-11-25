import { z } from 'zod';
import { AppError } from '../platform/errors.js';

// BR-10: a whole number from 0 to 100. z.number().int() rejects 85.5, NaN and Infinity; the string "90" and null
// are rejected because no coercion is used. Strict: unknown fields (supervisorId, submissionId, ...) are rejected.
export const gradeSchema = z.strictObject({
  score: z.number().int().min(0).max(100),
});

export type GradeInput = z.output<typeof gradeSchema>;

export const feedbackRequired = () =>
  AppError.conflict('FEEDBACK_REQUIRED', 'Record feedback before grading.');
export const gradeExists = () =>
  AppError.conflict('GRADE_EXISTS', 'This submission already has a grade.');
export const revisionSuperseded = () =>
  AppError.conflict('REVISION_SUPERSEDED', 'This revision has been replaced by a newer one.');
