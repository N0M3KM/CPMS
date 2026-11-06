// One deadline rule shared by milestone status (F-07) and submission (F-04):
// work is on time up to and including dueAt, and late one instant after.
export function isPastDue(dueAt: Date, now: Date): boolean {
  return dueAt.getTime() < now.getTime();
}
