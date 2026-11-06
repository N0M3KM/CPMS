# F-02 Role and ownership enforcement

**Owner:** Jinnakan 1010 · **Reviewer:** Drarun 1016 · **Requirements:** FR-02, BR-05, BR-06, NFR-01, NFR-03 · **Depends on:** F-01

## Behavior and workflow

Auth middleware authenticates every protected request from the session. Role guards and ownership or assignment checks run before any private data is read. Identity and role come only from the session; request bodies, params and headers are never authority.

Rules: BR-05 (private ownership), BR-06 (role separation). Order of checks: 401, then 403 role, then ownership or assignment (403 or privacy-safe 404), then validation (400), then conflicts (409).

Failure and boundary cases: expired session; Student calling a Supervisor route; Supervisor calling a Student route; a valid ID that belongs to someone else; a nonexistent ID. Errors use the shared envelope and expose no stack, SQL or private fields.

## UI

Hide controls the role cannot use. This is usability only; the API stays authoritative.

## API and data

No new endpoints and no new entities. Provides reusable middleware (`requireAuth`, `requireRole`) and ownership helpers used by F-03 to F-05. Migration: none, documented in the feature PR.

Error shape: `{ "error": { "code": "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND", "message": "..." } }`.

## Decision needed

SRS D-05: choose 403 or privacy-safe 404 for another user's proposal. Record the choice in the F-02 PR. Tests accept either with no private data.

## Acceptance criteria

- **AC-05:** Anonymous calls to every protected endpoint return 401 with no private data.
- **AC-06:** A Student calling review or workload, and a Supervisor calling submit or supervisor list, get 403.
- **AC-07:** Student list and detail expose only own proposals; Supervisor list and detail expose only assigned proposals.
- **AC-08:** Cross-user proposal access or review returns no private data (403 or 404); a non-assigned Supervisor cannot review.
- **AC-31:** All protected endpoints meet NFR-01 on auth failure.
- **AC-33:** Error responses contain no stack traces or SQL.

Tests: TEST-05 to TEST-08, TEST-31, TEST-33 in the [STS](sts.md).
