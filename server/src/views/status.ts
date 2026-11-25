import { isPastDue } from '../domain/deadline.js';

// closedAt is required so a caller that forgets it fails to compile instead of reporting OVERDUE for a closed milestone.
// `submission` is the current (newest) revision. Precedence: REVIEWED, SUBMITTED, CLOSED, OVERDUE, NOT_SUBMITTED.
export function milestoneStatus(
  milestone: { dueAt: Date; closedAt: Date | null; submission: { feedback: object | null } | null },
  now: Date,
) {
  if (milestone.submission?.feedback) return 'REVIEWED';
  if (milestone.submission) return 'SUBMITTED';
  if (milestone.closedAt) return 'CLOSED';
  return isPastDue(milestone.dueAt, now) ? 'OVERDUE' : 'NOT_SUBMITTED';
}
