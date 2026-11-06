# F-05 Supervisor feedback

**Owner:** Drarun 1016 · **Reviewer:** Jinnakan 1010 · **Requirements:** FR-05, BR-05, BR-07 · **Depends on:** F-01, F-02, F-04

## Behavior and workflow

A Supervisor opens a submission of a team they supervise and records feedback. In one transaction the server reads the submission with its team, checks the supervisor's scope, checks that no feedback exists, validates the comment, and inserts the feedback linked to the submission. The milestone status becomes `REVIEWED`. Team members and the supervisor see the feedback beside the submission.

Rules (BR-05):
- Only the supervisor of the submission's team.
- The comment, trimmed, has 10 to 2000 characters.
- One feedback per submission, enforced by a unique index on `submissionId`. Feedback is immutable in Sprint 1 and always linked to its submission by foreign key, so the submission and feedback association is preserved.
- Visibility (SRS D-10): the team's members and the team's supervisor only.

Failure cases: invalid comment (400); no session (401); Student (403); submission outside the supervisor's scope or nonexistent (uniform 404); feedback exists (409). Nothing is stored on failure.

## UI

Submission detail, supervisor view: feedback form with a comment box and inline minimum-length feedback; after success the form is replaced by the saved feedback. Student view shows the feedback read-only, or "No feedback yet".

## API

`POST /api/submissions/:submissionId/feedback` (team supervisor)

Request: `{ "comment": string }`

201 response: `{ "id", "submissionId", "comment", "createdAt", "supervisor": {"id","name"} }`

Errors: 400 `VALIDATION_ERROR`, 401, 403, 404, 409 `FEEDBACK_EXISTS`, 429.

Feedback is read through `GET /api/milestones/:milestoneId` (F-07).

## Data

Creates a `Feedback` row. The migration adds the table, unique index on `submissionId`, FK to `Submission` and to `User`.

## Acceptance criteria

- **AC-27:** The team's supervisor records feedback with a trimmed comment of 10 and 2000 characters; it is stored linked to the submission with the supervisor from the session and the milestone status becomes `REVIEWED`.
- **AC-28:** A missing, empty, whitespace-only, under-10 or over-2000 character comment returns 400 with no creation.
- **AC-29:** A second feedback for the same submission returns 409 and keeps the original (BR-05).
- **AC-30:** A Supervisor who does not supervise the team gets the uniform 404 and nothing is stored.
- **AC-31:** A Student attempting feedback gets 403 and nothing is stored (BR-07).
- **AC-32:** Members of the submission's team can read its feedback; a student of another team cannot (uniform 404) (BR-06).

Tests: TEST-27 to TEST-32 and TEST-43 (E2E) in the [STS](sts.md).
