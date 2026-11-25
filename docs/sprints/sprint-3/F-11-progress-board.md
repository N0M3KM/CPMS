# F-11 Progress board and reports

**Owner:** Drarun 1016 · **Reviewer:** Jinnakan 1010 · **Requirements:** FR-11, BR-06 · **Depends on:** F-07, F-08, F-09 · **Status:** planned. Contract only in Deliverable 2; nothing in this document is implemented and no code exists.

## Behavior and workflow

A signed-in user opens the progress board. A Supervisor sees one row for each team they supervise. A Student sees one row for the team they belong to. Each row counts that team's milestones by computed status. A summary block adds the counts of the rows shown. The board is read-only.

Rules:
- BR-06: the team scope is part of the database query, before any counting. Counts are never computed over all teams and filtered afterward. No other team's ID, name or count appears in any response.
- Status uses the same computation as F-07 and F-09. Precedence: `REVIEWED`, `SUBMITTED`, `CLOSED`, `OVERDUE`, `NOT_SUBMITTED`. `now` comes from the injectable clock, and a milestone at exactly `dueAt` is not overdue.
- Revisions (F-08): the status is read from the current revision, the one with the highest `revisionNo`. A milestone that was reviewed and then revised counts as `submitted` until the new revision has feedback.
- Deadlines and closing (F-09): the status uses the current `dueAt` and `closedAt`. A closed milestone with no submission counts as `closed`, even when its `dueAt` has passed. A closed milestone with a submission counts as `submitted` or `reviewed`. A past-due milestone with a submission is never `overdue`.
- Each milestone is counted once, in exactly one status. For a team, `total` is the sum of its five counts and equals the number of its milestones. For the response, `totals` is the sum of the rows shown.
- The summary report in this contract is the `totals` block of the same response. No separate report route and no export file are defined here.

Empty states are not errors. A Student with no team, a Supervisor with no teams, and a team with no milestones all return 200 with zero counts.

Failure cases: no session (401); rate limit (429). The call takes no ID or parameter, so it has no 400, 403 or 404 case. Both roles may call it.

## UI

Planned. A "Progress" page reachable from the home page for both roles.
- Supervisor: a table with one row per supervised team (team name linking to the F-07 team detail), one column per status (Not submitted, Submitted, Reviewed, Overdue, Closed), a total column, and a summary row.
- Student: the same layout with the one team and no other rows.
- Loading, empty, error and success states. The empty state reads as zeros and does not look like an error.
- Status labels match F-07 and F-09, including "Closed".

## API

`GET /api/progress` (any authenticated user, scoped to the user's teams). No query parameters.

200 response:

```
{
  "teams": [
    { "id", "name", "supervisor": {"id","name"},
      "progress": {"notSubmitted","submitted","reviewed","overdue","closed"},
      "total" }
  ],
  "totals": {"notSubmitted","submitted","reviewed","overdue","closed","total"}
}
```

Teams are ordered by name, then ID. All counts are integers of 0 or more. The response is a whitelisted DTO and is sent with `Cache-Control: no-store`, as the F-07 views are. With no teams in scope the response is `{ "teams": [], "totals": { all zeros } }`.

Errors: 401, 429.

## Data

No new entities, columns or migrations. Read queries only, over `Team`, `Milestone`, `Submission` (current revision), `Feedback` and `Milestone.closedAt`.

### No change needed

- `GET /api/teams`, `GET /api/teams/:teamId` and `GET /api/milestones/:milestoneId` and their `progress` and `nextDue` fields (F-07, with `closed` from F-09).
- The milestone status function and its precedence.
- Roles, sessions, the uniform 404 and the error envelope.
- The write routes of F-03 to F-10. F-11 adds no write route.
- F-12 search and filter, which is a separate route.

## Acceptance criteria

All planned, none implemented.

- **AC-73:** A Supervisor's `GET /api/progress` lists exactly the teams they supervise (for seed data, S1 gets Teams A and B and not Team C). Each team shows counts for `notSubmitted`, `submitted`, `reviewed`, `overdue` and `closed`.
- **AC-74:** A Student's `GET /api/progress` returns only their own team (for seed data, A1 gets Team A only), and no other team's ID, name or count appears.
- **AC-75:** For every team, the five counts add up to `total` and to the number of that team's milestones. `totals` equals the sum of the rows in `teams`, for each status and for `total`.
- **AC-76:** The counts follow the status precedence. A past-due milestone with no submission counts as `overdue`, and a milestone at exactly `dueAt` does not. A closed milestone with no submission counts as `closed` and not `overdue`. A closed or past-due milestone with a submission counts as `submitted` or `reviewed`. A reviewed milestone with a newer revision counts as `submitted`.
- **AC-77:** A Student with no team, a Supervisor with no teams, and a team with no milestones each return 200 with zero counts and an empty or zero-valued row, not 404 or an error.
- **AC-78:** Creating, submitting to, reviewing or closing a milestone in a team outside the caller's scope (for seed data, Team C for A1 and S1) changes no value in the caller's response, and the response never contains that team's ID or name.

Tests: TEST-73 to TEST-78 (API and database integration), planned and not yet written, in the Sprint 3 [STS](sts.md). No E2E journey is planned for F-11 in Deliverable 2. Tests come first when F-11 is built.

## Version history

| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-11-25 | Initial contract for F-11, status planned. No implementation in Deliverable 2. |
