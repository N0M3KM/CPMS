# F-07 Scoped views and progress

**Owner:** Jinnakan 1010 · **Reviewer:** Drarun 1016 · **Requirements:** FR-07, BR-06, NFR-04, NFR-05 · **Depends on:** F-01, F-02

## Behavior and workflow

Students see their one team: members, supervisor, milestones with status, and each milestone's submission and feedback. Supervisors see their assigned teams with a per-milestone progress summary and can open any milestone of those teams. All queries include the team scope, so another team's rows are never loaded.

Computed milestone status: `REVIEWED` if feedback exists; else `SUBMITTED` if a submission exists; else `OVERDUE` if `dueAt` has passed; else `NOT_SUBMITTED`.

Boundary cases: a Student with no team, or a Supervisor with no teams, sees an empty state; a milestone at exactly `dueAt` is not yet overdue.

Next due means the earliest milestone with status `NOT_SUBMITTED`. It is `null` when the team has no upcoming unsubmitted work.

## UI

- Student home: team name, members, supervisor name, milestone list with status badges and due dates.
- Supervisor home: assigned teams, each with counts per status and next due milestone.
- Team detail: milestones list; supervisors see the create form (F-03).
- Milestone detail: description, due date, submission (F-04), feedback (F-05).
- Loading, empty, error and success states on every data view.

## API

| Call | Access | Response |
|---|---|---|
| `GET /api/teams` | Authenticated | `{teams:[{id,name,supervisor:{id,name},members:[{id,name}],progress:{notSubmitted,submitted,reviewed,overdue},nextDue}]}` scoped to the user. `nextDue` is `{id,title,dueAt}` or `null`. |
| `GET /api/teams/:teamId` | Team member or team supervisor | Team with `milestones:[{id,title,dueAt,status}]` |
| `GET /api/milestones/:milestoneId` | Team member or team supervisor | Milestone with `submission` and its `feedback`, or `null` |

Out-of-scope or nonexistent IDs return the uniform 404. Responses use whitelisted DTOs.

## Data

No new entities. Read queries only.

## Acceptance criteria

- **AC-35:** A Student's `GET /api/teams` returns only their own team; team, milestone and detail reads return only that team's data (BR-06).
- **AC-36:** A Supervisor's `GET /api/teams` returns only supervised teams with correct progress counts and can open their milestones; another supervisor's team is a uniform 404.
- **AC-37:** Milestone status is computed correctly for all four states, including exactly at `dueAt` (not overdue) and one second later (overdue).
- **AC-38:** Empty states render for a user with no data; loading, error and success states exist on every data view.
- **AC-39:** Palette token contrasts are documented and body and button text meet 4.5:1 (NFR-04).
- **AC-40:** Local seeded response timing is recorded and typical responses are under 500 ms (NFR-05).
- **AC-41:** Role-inappropriate actions are hidden in the UI and direct API calls remain denied.

Tests: TEST-35 to TEST-41, TEST-42, TEST-43 in the [STS](sts.md).

## Version history

| Date | Change |
|---|---|
| 2026-11-06 | Documented the additive `nextDue` field and the status filter used by the supervisor dashboard. |
