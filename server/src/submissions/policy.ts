// RED STUB: permissive placeholders so the new tests run and fail on their assertions.
import { z } from 'zod';

export const submissionSchema = z.strictObject({ title: z.string(), description: z.string(), link: z.string() });
export const isAllowedLink = (_value: string): boolean => true;
export function assertBeforeDeadline(_dueAt: Date, _now: Date): void {}
