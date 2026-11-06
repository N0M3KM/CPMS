# F-04 Submit milestone work

**Owner:** Jinnakan 1010 · **Reviewer:** Drarun 1016 · **Requirements:** FR-04, BR-01, BR-02, BR-04, BR-07 · **Depends on:** F-01, F-02, F-03

## Behavior and workflow

A Student who is a member of the milestone's team opens the milestone and submits a title, description and link. In one transaction the server reads the milestone, checks membership, the deadline and that no submission exists, validates the data, then inserts the submission with the student from the session. The milestone detail reloads and shows the saved submission and status `SUBMITTED`.

Rules:
- BR-04: only a member of the milestone's team; title 5 to 100; description 20 to 2000; link must parse as an absolute URL with scheme `http` or `https`, at most 500 characters. `javascript:`, `data:`, `file:`, `ftp:` and relative links return 400. The link is stored as text and never fetched by the server.
- BR-02: accepted when `now <= dueAt`; later requests return 409 `DEADLINE_PASSED`. `now` comes from an injectable clock.
- BR-01: one submission per milestone. The unique index on `milestoneId` makes concurrent submits by two members safe; the loser gets 409 `DUPLICATE_SUBMISSION`.
- BR-07: Supervisors cannot submit.

Failure cases: invalid fields or link (400); no session (401); Supervisor (403); non-member or nonexistent milestone (uniform 404); duplicate or late (409). Nothing is stored on failure.

## UI

Milestone detail: due date with an overdue badge, submission form (title, description, link) when none exists and the deadline has not passed, otherwise the saved submission read-only. The link renders as an anchor with `rel="noopener noreferrer"` only for http and https. Inline validation and visible API errors.

## API

`POST /api/milestones/:milestoneId/submission` (team student)

Request: `{ "title": string, "description": string, "link": string }`

201 response: `{ "id", "milestoneId", "title", "description", "link", "submittedBy": {"id","name"}, "submittedAt", "feedback": null }`

Errors: 400 `VALIDATION_ERROR`, 401, 403, 404, 409 `DEADLINE_PASSED` or `DUPLICATE_SUBMISSION`, 429.

## Data

Creates a `Submission` row. The migration adds the table, unique index on `milestoneId`, FK to `User` for `submittedById`.

## Acceptance criteria

- **AC-21:** A team member submits valid title (5 and 100 inclusive), description (20 and 2000 inclusive) and an `https` link before the deadline; it is persisted with the session student as `submittedById` and a timestamp, and is readable after reload.
- **AC-22:** Title or description out of range, missing fields, a link with a non-http(s) scheme or over 500 characters, or a malformed milestone ID returns 400 with no creation.
- **AC-23:** A second submission for the same milestone returns 409 and keeps the first; two concurrent submissions create exactly one record (BR-01).
- **AC-24:** A submission after `dueAt` returns 409 `DEADLINE_PASSED` and stores nothing; one exactly at `dueAt` is accepted (BR-02).
- **AC-25:** A Student who is not a member of the milestone's team gets the uniform 404 and nothing is stored (BR-04).
- **AC-26:** A Supervisor attempting to submit gets 403 and nothing is stored (BR-07).

Tests: TEST-21 to TEST-26 and TEST-42 (E2E) in the [STS](sts.md). TDD evidence is required for BR-01, BR-02 and the link rule.
