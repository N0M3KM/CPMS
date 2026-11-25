# F-09 Milestone management

**Owner:** Drarun 1016 · **Reviewer:** Jinnakan 1010 · **Requirements:** FR-09, BR-09 (new), BR-03, BR-06, BR-07 · **Depends on:** F-03, F-07, Sprint 2 foundation task (schema and shared guards) · **Status:** specified, not yet implemented


**Approval status:** approved 2026-11-25. Drarun approved the documented close and deadline policies D-18 and D-19 and this implementation in his approving review on PR #60 (merged); D-23 was approved with F-08 (PR #59). Instructor or TA confirmation of D-18 and D-19 was not received; Drarun approved without it. The grade part of TEST-88 was deferred to F-10. Record: [Sprint 2 plan](plan.md#approval-record-for-f-09-decisions-d-18-d-19-d-23).

## Behavior and workflow

A Supervisor opens a milestone of a team they supervise and either edits it or closes it. Editing changes the title, description or due date while the milestone is open. Closing records the time and stops further submission activity on that milestone. Each action is one write to the `Milestone` row, and the same statement filters on the team's supervisor taken from the session. The milestone detail reloads and shows the new values, the new status and, after a close, the closing time.

Rules:
- BR-09 (new, decisions D-18 and D-19): only the team's supervisor may edit an open milestone and may close it at any time. Closing is not reversible in Sprint 2. A closed milestone rejects edits, first submissions and revisions. Reads, feedback and grades stay allowed.
- BR-03 (field limits, reused): title trimmed, 5 to 100 characters; description 0 to 1000; `dueAt` an ISO date-time with offset, strictly in the future at the time of the edit. A `dueAt` equal to now is rejected. The new `dueAt` may be earlier or later than the old one. A PATCH needs at least one field, and unknown fields return 400.
- Status is computed on every read and never stored. Precedence: `REVIEWED` (the current revision has feedback), `SUBMITTED` (a submission exists), `CLOSED` (`closedAt` is set), `OVERDUE` (`dueAt` has passed), `NOT_SUBMITTED`. A closed milestone with a submission keeps `SUBMITTED` or `REVIEWED`. A closed milestone with no submission is `CLOSED` even when its `dueAt` has passed.
- Deadline change: extending the `dueAt` of an overdue milestone with no submission makes it `NOT_SUBMITTED` again, so BR-02 accepts a submission until the new `dueAt`. For a milestone that already has a submission the status does not change; revisions (F-08) read the new `dueAt` on their next request.
- Close: allowed at any time while open, including when the milestone is overdue or already has a submission or feedback. `closedAt` comes from one read of the injectable server clock, and that same value is stored and returned. It is set once and never cleared. No route reopens a milestone.
- Closed effects: edit returns 409 `MILESTONE_CLOSED`; a first submission (F-04) and a revision (F-08, AC-47) return 409 `MILESTONE_CLOSED`. Feedback (F-05) and grades (F-10) carry no closed check and stay accepted. Milestone, team, submission, revision, feedback and grade reads stay allowed.
- BR-06 and BR-07: Students cannot edit or close (403). A Supervisor of another team and an unknown ID get the uniform 404, so the two cases cannot be told apart.
- Concurrency: edit and close are conditional writes (`UPDATE ... WHERE closedAt IS NULL` plus the supervisor filter). Submit and revise lock the milestone row inside their transaction and re-read `closedAt` and `dueAt` after the lock. A close racing a submission therefore has one winner, decided by who takes the row lock first. If the close commits first, a submission waiting on the lock re-reads `closedAt` and gets 409 `MILESTONE_CLOSED`, and nothing is stored. If the submission takes the lock first, it is stored and the close then succeeds. Timestamps from the server clock are not used to order the two: each request reads the clock before it waits, so a stored `submittedAt` can be later than `closedAt` only when the submission committed first.

Order of checks for edit and close: auth (401), role (403), body syntax and size (400, 413, 415), field validation including a malformed milestone ID and a `dueAt` that is not in the future (400), milestone not in this supervisor's scope or missing (404), already closed (409 `MILESTONE_CLOSED` for edit, 409 `ALREADY_CLOSED` for close). Validation comes before the scope check, as in F-03 and F-04, so a past `dueAt` on a closed milestone reports 400.

Order of checks for a submission (changes the F-04 order): milestone not yours or missing (404), closed (409 `MILESTONE_CLOSED`), already submitted (409 `DUPLICATE_SUBMISSION`), deadline passed (409 `DEADLINE_PASSED`). A milestone that is closed and also submitted reports `MILESTONE_CLOSED`.

Failure cases: bad length, empty change, unknown field, invalid or non-future `dueAt`, malformed ID (400); no session (401); Student (403); other team's supervisor or unknown ID (uniform 404); edit of a closed milestone, or a second close (409). Nothing is changed on failure.

## UI

Milestone detail, supervisor view, while `closedAt` is null:
- "Edit milestone" form with title, description and due date and time, prefilled, with the BR-03 limits shown inline, a pending state and visible API errors.
- "Close milestone" button with a confirm step that says closing cannot be undone. 409 `MILESTONE_CLOSED` and `ALREADY_CLOSED` show a plain sentence and reload the milestone.

After a close the form and button are replaced by a "Closed" badge and the closing date and time. Students never see the edit form or the Close button. A student on a closed milestone sees the "Closed" status, no submit or revise form, and the existing submission and feedback read-only. Team lists and the supervisor progress summary show the `CLOSED` label and a "Closed" count.

## API

`PATCH /api/milestones/:milestoneId` (team supervisor)

Request: `{ "title"?: string, "description"?: string, "dueAt"?: ISO datetime }`, at least one field.

200 response: `{ "id", "teamId", "title", "description", "dueAt", "closedAt": null }`. The status is not in this response; it is recomputed on the next read of the milestone or team.

Errors: 400 `VALIDATION_ERROR`, 401, 403, 404, 409 `MILESTONE_CLOSED`, 429.

`POST /api/milestones/:milestoneId/close` (team supervisor)

Request: no fields. An empty body or `{}` is accepted; any field returns 400 (strict schema, NFR-11).

200 response: `{ "id", "closedAt" }`. `closedAt` is the stored value.

Errors: 400 `VALIDATION_ERROR` (malformed ID), 401, 403, 404, 409 `ALREADY_CLOSED`, 429.

### Changed from Sprint 1 (proposed baseline change, D-23)

| Call | Change |
|---|---|
| `GET /api/milestones/:milestoneId` | Adds `closedAt` (ISO date-time or `null`). `status` can be `CLOSED`. The `submission` key set is unchanged. |
| `GET /api/teams/:teamId` | Milestone items keep `{id,title,dueAt,status}`; `status` can be `CLOSED`. |
| `GET /api/teams` | `progress` gains `closed`: `{notSubmitted, submitted, reviewed, overdue, closed}`. The Sprint 1 scoped-views test matches `progress` partially, so it keeps passing; `closed: 0` is added to its expectations. `nextDue` is still the earliest `NOT_SUBMITTED` milestone, so closed milestones are never next due. |
| `POST /api/milestones/:milestoneId/submission` | New 409 `MILESTONE_CLOSED`; check order is now 404, closed, duplicate, deadline. |

## Data

Adds the nullable column `Milestone.closedAt` through the Sprint 2 foundation migration. The migration is additive, and existing rows get `null`, so every Sprint 1 milestone stays open. F-09 adds no table or index of its own. It writes only `title`, `description`, `dueAt` and `closedAt`. `createdById` and `createdAt` are never changed by an edit. `CLOSED` is a computed status, not a stored value.

## Acceptance criteria

- **AC-56:** A team's supervisor sends `PATCH /api/milestones/:id` and updates the title (5 to 100 characters) and description (0 to 1000); the new values are persisted and shown after reload (BR-03).
- **AC-57:** `dueAt` must be in the future, earlier or later than the current one; a `dueAt` in the past or equal to now returns 400 and changes nothing. The status is recomputed from the new `dueAt`.
- **AC-58:** A Student gets 403; another team's supervisor gets the uniform 404; an unauthenticated call gets 401; unknown fields return 400. The same role and scope checks apply to close (BR-06, BR-07).
- **AC-59:** `POST /api/milestones/:id/close` sets `closedAt` from one server-clock read, and the same value is stored and returned. A second close returns 409 `ALREADY_CLOSED` and `closedAt` is unchanged.
- **AC-60:** A closed milestone rejects an edit and a first submission with 409 `MILESTONE_CLOSED`, and nothing changes. The order of checks for a submission is 404, closed, duplicate, deadline.
- **AC-61:** Submissions, feedback, grades and revisions stay readable after the milestone is closed.
- **AC-62:** The status is `CLOSED` when the milestone is closed and has no submission. A closed milestone with a submission keeps `SUBMITTED` or `REVIEWED`.
- **AC-63:** Extending the `dueAt` of an overdue milestone with no submission makes its status `NOT_SUBMITTED`, and a submission is then accepted.
- **AC-88:** Feedback and grades are still accepted on a closed milestone (D-18).
- **AC-89:** A first submission that is waiting on the milestone row lock while a close commits gets 409 `MILESTONE_CLOSED` and stores no row. The test holds the lock in a separate transaction that sets `closedAt`, starts the submission, then commits the close. A second test starts a close and a submission together 10 times and checks that each run ends as submission 201 then close 200, or close 200 then submission 409 with no row.

E2E row, **TEST-64** (`e2e/f09-manage.spec.ts`): the supervisor extends the deadline, a student submits, the supervisor closes the milestone, and the student sees `Closed` and cannot submit.

### No change needed

- F-03 create route, its field rules and its 201 response.
- F-05 feedback route and F-10 grade route: no closed check is added to either (AC-88).
- Scope and role middleware, session handling, the uniform 404 and the error envelope.
- The `submission` key set in the milestone detail (D-23); `revisions[]` belongs to F-08.
- Team, member, feedback and grade tables; `Milestone.createdById` and `createdAt`.
- The status boundary: a milestone at exactly `dueAt` is not yet overdue.

Tests: TEST-56 to TEST-63, TEST-88, TEST-89 and TEST-64 (E2E) in the Sprint 2 [STS](sts.md), plus the cross-feature rows TEST-92 to TEST-94. TDD evidence (red, then green) is required for the closed-milestone rule, the check order and the close race.

## Version history

| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-11-25 | Initial contract for F-09 with BR-09 and the baseline changes from D-23. |
