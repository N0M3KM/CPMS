# F-03 Submit proposal

**Owner:** Drarun 1016 · **Reviewer:** Jinnakan 1010 · **Requirements:** FR-03, BR-01, BR-06, NFR-03 · **Depends on:** F-01, F-02, F-05 (supervisor picker)

## Behavior and workflow

A logged-in Student chooses a supervisor, enters title and description, and submits. The server takes the student ID from the session, validates the fields, checks that the supervisor exists and has role Supervisor, then creates a `SUBMITTED` proposal. The dashboard reloads and shows it.

Rules:
- Title 5 to 100 characters, description 20 to 2000, both inclusive.
- BR-01: a Student with a `SUBMITTED` or `APPROVED` proposal cannot submit another. Rejected-only history allows a new one. Enforced by a transaction plus a partial unique index, safe under concurrent submits.
- BR-06: Supervisors cannot submit.

Failure cases: invalid length, missing field, malformed UUID, unknown or non-supervisor assignee (400); active proposal (409); wrong role (403); no session (401). Nothing is created on failure.

## UI

Student dashboard form: title, description, supervisor picker showing remaining capacity, inline validation, submit pending state, visible API error. Submission is allowed even when the chosen supervisor is at approval capacity (SRS D-10).

## API

`POST /api/proposals` (Student)

Request: `{ "title": string, "description": string, "supervisorId": uuid }`

201 response: `{ "id", "title", "description", "studentId", "supervisorId", "status": "SUBMITTED", "reviewComment": null, "submittedAt", "reviewedAt": null }`

Errors: 400 `VALIDATION_ERROR`, 401, 403, 409 `ACTIVE_PROPOSAL_EXISTS`.

## Data

Creates a `Proposal` row. Migration adds the `Proposal` table, enums and the partial unique index `(studentId) WHERE status IN ('SUBMITTED','APPROVED')`.

## Acceptance criteria

- **AC-09:** A Student submits a valid title (5 and 100 inclusive), description (20 and 2000 inclusive) and existing supervisor; the record is `SUBMITTED` with the session student ID and timestamps.
- **AC-10:** Out-of-range title or description, missing fields, malformed IDs, or a nonexistent or non-supervisor assignee return 400 with no creation.
- **AC-11:** A Student with a `SUBMITTED` proposal gets 409 on another submission.
- **AC-12:** A Student with an `APPROVED` proposal gets 409 on another submission.
- **AC-13:** A Student with only `REJECTED` history can submit a new proposal.
- **AC-14:** A Supervisor attempting submission gets 403.

Tests: TEST-09 to TEST-14, plus TEST-23 (E2E) in the [STS](sts.md).
