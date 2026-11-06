import { expect, it } from 'vitest';
import { milestoneStatus } from '../src/views/status.js';

const dueAt = new Date('2026-11-08T12:00:00Z');
const later = new Date(dueAt.getTime() + 1000);

it('TEST-37 gives feedback and submission precedence over the deadline', () => {
  expect(milestoneStatus({ dueAt, submission: { feedback: {} } }, later)).toBe('REVIEWED');
  expect(milestoneStatus({ dueAt, submission: { feedback: null } }, later)).toBe('SUBMITTED');
});

it('TEST-37 only marks unsubmitted work overdue after the deadline', () => {
  expect(milestoneStatus({ dueAt, submission: null }, new Date(dueAt.getTime() - 1000))).toBe('NOT_SUBMITTED');
  expect(milestoneStatus({ dueAt, submission: null }, dueAt)).toBe('NOT_SUBMITTED');
  expect(milestoneStatus({ dueAt, submission: null }, later)).toBe('OVERDUE');
});
