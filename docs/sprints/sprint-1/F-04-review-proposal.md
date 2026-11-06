# F-04 Review proposal

**Owner:** Jinnakan 1010 · **Reviewer:** Drarun 1016 · **Requirements:** FR-04, BR-02, BR-03, BR-04, BR-06, NFR-03 · **Depends on:** F-01, F-02, F-03

## Behavior and workflow

The assigned Supervisor opens a `SUBMITTED` proposal and sends `APPROVED` or `REJECTED`. Inside one transaction the server locks the proposal and supervisor rows, verifies role, assignment and state, validates the comment, checks capacity for approvals, then writes status, comment and `reviewedAt`.

Rules:
- BR-03: rejection needs at least 10 characters after trimming. Approval comment is optional and, if given, is stored.
- BR-04: only the assigned Supervisor, only from `SUBMITTED`, exactly once.
- BR-02: if the supervisor's `APPROVED` count is at or above `capacity`, approval fails.
- BR-06: Students cannot review.

Failure cases: invalid reject comment (400); unauthenticated (401); Student or wrong role (403); non-assigned Supervisor (403 or privacy-safe 404); already decided or at capacity (409). Nothing changes on failure.

## UI

Review panel in proposal detail: approve and reject buttons, comment box with inline minimum-length feedback on reject, visible backend errors, refresh of queue and workload after success.

## API

`POST /api/proposals/:id/review` (assigned Supervisor)

Request: `{ "decision": "APPROVED" | "REJECTED", "comment"?: string }`

200 response: the updated proposal object (same shape as F-03) with new `status`, `reviewComment`, `reviewedAt`.

Errors: 400 `VALIDATION_ERROR` (including short reject comment), 401, 403, 404, 409 `ALREADY_DECIDED`, 409 `CAPACITY_REACHED`.

## Data

Updates `Proposal.status`, `reviewComment`, `reviewedAt`. No new migration beyond F-03. Row locking prevents concurrent over-approval.

## Acceptance criteria

- **AC-15:** The assigned Supervisor approves a `SUBMITTED` proposal with no comment; status and `reviewedAt` update.
- **AC-16:** The assigned Supervisor rejects with at least 10 non-whitespace characters; status, comment and `reviewedAt` update.
- **AC-17:** Reject with a missing, empty, whitespace-only or under-10-character comment returns 400 with no state change.
- **AC-18:** Approve with an optional comment persists the comment.
- **AC-19:** Approving when the supervisor is at capacity returns 409 with an explicit capacity message and leaves the proposal unchanged.
- **AC-20:** A non-assigned Supervisor cannot review; response is 403 or 404 with no private data.
- **AC-21:** Reviewing an already decided proposal returns 409 and leaves the original decision.
- **AC-22:** A Student review attempt returns 403.

Tests: TEST-15 to TEST-22, plus TEST-24 (E2E) in the [STS](sts.md). TDD evidence required for BR-02, BR-03 and BR-04.
