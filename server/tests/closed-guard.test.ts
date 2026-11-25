import { describe, expect, it } from 'vitest';
import { assertMilestoneOpen, milestoneClosed } from '../src/domain/closed.js';
import { currentOf } from '../src/views/current-revision.js';

describe('shared milestone guards', () => {
  it('assertMilestoneOpen lets an open milestone through and rejects a closed one with MILESTONE_CLOSED', () => {
    expect(() => assertMilestoneOpen({ closedAt: null })).not.toThrow();
    expect(() => assertMilestoneOpen({ closedAt: new Date() })).toThrowError(milestoneClosed());
    expect(milestoneClosed()).toMatchObject({ status: 409, code: 'MILESTONE_CLOSED' });
  });

  it('currentOf returns the last revision of an ascending list, or null for an empty list', () => {
    expect(currentOf([{ revisionNo: 1 }, { revisionNo: 2 }])).toEqual({ revisionNo: 2 });
    expect(currentOf([])).toBeNull();
  });
});
