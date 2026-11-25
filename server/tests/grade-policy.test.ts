import { describe, expect, it } from 'vitest';
import { gradeSchema } from '../src/grades/policy.js';

describe('gradeSchema (BR-10, TEST-68)', () => {
  it.each([
    ['101', 101],
    ['-1', -1],
    ['85.5', 85.5],
    ['the string "90"', '90'],
    ['null', null],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['an array', [90]],
    ['a boolean', true],
  ])('rejects score %s', (_label, score) => {
    expect(gradeSchema.safeParse({ score }).success).toBe(false);
  });

  it('rejects a missing score and a non-object body', () => {
    expect(gradeSchema.safeParse({}).success).toBe(false);
    expect(gradeSchema.safeParse(undefined).success).toBe(false);
    expect(gradeSchema.safeParse(90).success).toBe(false);
  });

  it.each([0, 1, 50, 99, 100])('accepts the whole number %i', (score) => {
    expect(gradeSchema.safeParse({ score }).success).toBe(true);
  });

  it.each(['supervisorId', 'submissionId', 'createdAt', 'id'])('rejects the unknown field %s', (field) => {
    expect(gradeSchema.safeParse({ score: 90, [field]: 'x' }).success).toBe(false);
  });
});
