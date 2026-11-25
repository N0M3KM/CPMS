import { describe, expect, it } from 'vitest';
import { assertBeforeDeadline } from '../src/submissions/policy.js';
import { assertRevisionAllowed, MAX_REVISIONS } from '../src/submissions/revision.js';

describe('F-08 revision policy', () => {
  it('TEST-48 allows a revision after version 4 and rejects one after version 5', () => {
    expect(MAX_REVISIONS).toBe(5);
    expect(() => assertRevisionAllowed(1)).not.toThrow();
    expect(() => assertRevisionAllowed(MAX_REVISIONS - 1)).not.toThrow();
    expect(() => assertRevisionAllowed(MAX_REVISIONS)).toThrowError(/revision limit/i);
    expect(() => assertRevisionAllowed(MAX_REVISIONS)).toThrowError(expect.objectContaining({ status: 409, code: 'REVISION_LIMIT' }));
  });

  it('TEST-46 accepts a revision before and at dueAt and rejects one after it', () => {
    const dueAt = new Date('2026-11-22T12:00:00Z');
    expect(() => assertBeforeDeadline(dueAt, new Date(dueAt.getTime() - 1))).not.toThrow();
    expect(() => assertBeforeDeadline(dueAt, dueAt)).not.toThrow();
    expect(() => assertBeforeDeadline(dueAt, new Date(dueAt.getTime() + 1))).toThrowError(
      expect.objectContaining({ status: 409, code: 'DEADLINE_PASSED' }),
    );
  });
});
