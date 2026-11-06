# F-03 Create milestone

**Owner:** Drarun 1016 · **Reviewer:** Jinnakan 1010 · **Requirements:** FR-03, BR-03, BR-07 · **Depends on:** F-01, F-02, F-07 (team views)

## Behavior and workflow

A logged-in Supervisor opens a team they supervise and creates a milestone with a title, optional description and due date. The server checks the supervisor's scope, validates the fields, and inserts the milestone. The team page reloads and shows it with status `NOT_SUBMITTED`.

Rules (BR-03):
- Only the team's supervisor may create it.
- Title 5 to 100 characters; description 0 to 1000; `dueAt` an ISO date-time strictly in the future at creation.
- The creator is recorded from the session.

Failure cases: bad length, missing title, invalid or past `dueAt`, malformed team ID (400); Student (403); team not supervised by this user or nonexistent (uniform 404); no session (401). Nothing is created on failure.

## UI

Team detail page, supervisor view: "New milestone" form with title, description, due date and time, inline validation, pending state, visible API errors. Students never see the form.

## API

`POST /api/teams/:teamId/milestones` (team supervisor)

Request: `{ "title": string, "description"?: string, "dueAt": ISO datetime }`

201 response: `{ "id", "teamId", "title", "description", "dueAt", "createdAt", "status": "NOT_SUBMITTED" }`

Errors: 400 `VALIDATION_ERROR`, 401, 403, 404, 429.

## Data

Creates a `Milestone` row. The migration adds the table, FK to `Team` and an index on `(teamId, dueAt)`.

## Acceptance criteria

- **AC-17:** A team's supervisor creates a milestone with title at 5 and 100 characters, description up to 1000, and a future `dueAt`; it is persisted with the session user as creator and appears in the team's list.
- **AC-18:** Title outside 5 to 100, description over 1000, missing title, invalid date, or malformed team ID returns 400 with no creation.
- **AC-19:** A `dueAt` that is in the past or equal to now returns 400 with no creation.
- **AC-20:** A Student calling the endpoint gets 403 with no creation (BR-07).

A Supervisor of another team gets the uniform 404 (AC-11).

Tests: TEST-17 to TEST-20 and TEST-42 (E2E) in the [STS](sts.md).
