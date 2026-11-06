import { z } from 'zod';
import { AppError } from '../platform/errors.js';

// Control characters are rejected; tab, newline and carriage return are allowed in a comment.
const CONTROL_EXCEPT_WHITESPACE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

// Strict: unknown fields (supervisorId, submissionId, createdAt, id, ...) are rejected.
export const feedbackSchema = z.strictObject({
  comment: z.string().trim().min(10).max(2000).refine((v) => !CONTROL_EXCEPT_WHITESPACE.test(v)),
});

export type FeedbackInput = z.output<typeof feedbackSchema>;

export const feedbackExists = () =>
  AppError.conflict('FEEDBACK_EXISTS', 'This submission already has feedback.');
