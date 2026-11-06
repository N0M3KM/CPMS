import { z } from 'zod';
import { AppError } from '../platform/errors.js';

export const uuidSchema = z.uuid();

// Validates input and throws a generic 400. The message never echoes the rejected value.
export function parse<T extends z.ZodType>(schema: T, data: unknown): z.output<T> {
  const result = schema.safeParse(data);
  if (!result.success) throw AppError.validation();
  return result.data;
}
