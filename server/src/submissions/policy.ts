import { z } from 'zod';
import { isPastDue } from '../domain/deadline.js';
import { AppError } from '../platform/errors.js';

const MAX_LINK_LENGTH = 500;
// Control characters are never valid in a title or link. A description may use tab, newline and carriage return.
const CONTROL = /[\u0000-\u001F\u007F]/;
const CONTROL_EXCEPT_WHITESPACE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

// A link must be an absolute http or https URL with a host, no spaces or control characters,
// no embedded credentials, and at most 500 characters. It is stored as text and never fetched.
export function isAllowedLink(value: string): boolean {
  if (value.length === 0 || value.length > MAX_LINK_LENGTH) return false;
  if (/\s/.test(value) || CONTROL.test(value)) return false;
  if (!/^https?:\/\/[^/]/i.test(value)) return false;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname !== '' && !url.username && !url.password;
}

// Strict: unknown fields (submittedById, milestoneId, submittedAt, ...) are rejected.
export const submissionSchema = z.strictObject({
  title: z.string().trim().min(5).max(100).refine((v) => !CONTROL.test(v)),
  description: z.string().trim().min(20).max(2000).refine((v) => !CONTROL_EXCEPT_WHITESPACE.test(v)),
  link: z.string().refine(isAllowedLink),
});

export type SubmissionInput = z.output<typeof submissionSchema>;

export function assertBeforeDeadline(dueAt: Date, now: Date): void {
  if (isPastDue(dueAt, now)) {
    throw AppError.conflict('DEADLINE_PASSED', 'The deadline for this milestone has passed.');
  }
}

export const duplicateSubmission = () =>
  AppError.conflict('DUPLICATE_SUBMISSION', 'This milestone already has a submission.');
