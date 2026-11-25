import { expect, it } from 'vitest';
import { milestoneStatus } from '../src/views/status.js';

const dueAt = new Date('2026-11-08T12:00:00Z');
const later = new Date(dueAt.getTime() + 1000);

it('TEST-37 gives feedback and submission precedence over the deadline', () => {
  expect(milestoneStatus({ dueAt, closedAt: null, submission: { feedback: {} } }, later)).toBe('REVIEWED');
  expect(milestoneStatus({ dueAt, closedAt: null, submission: { feedback: null } }, later)).toBe('SUBMITTED');
});

it('TEST-37 only marks unsubmitted work overdue after the deadline', () => {
  expect(milestoneStatus({ dueAt, closedAt: null, submission: null }, new Date(dueAt.getTime() - 1000))).toBe('NOT_SUBMITTED');
  expect(milestoneStatus({ dueAt, closedAt: null, submission: null }, dueAt)).toBe('NOT_SUBMITTED');
  expect(milestoneStatus({ dueAt, closedAt: null, submission: null }, later)).toBe('OVERDUE');
});

it('TEST-62 reports CLOSED for a closed milestone with no submission, and keeps SUBMITTED and REVIEWED when work exists', () => {
  const closedAt = new Date(dueAt.getTime() - 5000);
  expect(milestoneStatus({ dueAt, closedAt, submission: null }, later)).toBe('CLOSED');          // even past dueAt
  expect(milestoneStatus({ dueAt, closedAt, submission: null }, new Date(dueAt.getTime() - 1000))).toBe('CLOSED');
  expect(milestoneStatus({ dueAt, closedAt, submission: { feedback: null } }, later)).toBe('SUBMITTED');
  expect(milestoneStatus({ dueAt, closedAt, submission: { feedback: {} } }, later)).toBe('REVIEWED');
});
