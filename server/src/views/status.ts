export function milestoneStatus(
  milestone: { dueAt: Date; submission: { feedback: object | null } | null },
  now: Date,
) {
  if (milestone.submission?.feedback) return 'REVIEWED';
  if (milestone.submission) return 'SUBMITTED';
  return milestone.dueAt < now ? 'OVERDUE' : 'NOT_SUBMITTED';
}
