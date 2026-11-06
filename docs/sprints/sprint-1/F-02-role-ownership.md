# F-02 Role and ownership enforcement

**Owner:** Jinnakan 1010 · **Reviewer:** Drarun 1016 · **Requirements:** FR-02, BR-05, BR-06, NFR-01, NFR-03, NFR-07, NFR-08, NFR-10, NFR-11, NFR-12 · **Depends on:** F-01

## Behavior and workflow

Auth middleware authenticates every protected request from the session. Role guards and ownership or assignment checks run before any private data is read. Identity and role come only from the session; request bodies, params and headers are never authority.

Rules: BR-05 (private ownership), BR-06 (role separation). Order of checks: 401, then 403 role, then ownership or assignment (uniform 404), then validation (400), then conflicts (409).

Failure and boundary cases: expired session; Student calling a Supervisor route; Supervisor calling a Student route; a valid ID that belongs to someone else; a nonexistent ID. Errors use the shared envelope and expose no stack, SQL or private fields.

## UI

Hide controls the role cannot use. This is usability only; the API stays authoritative.

## API and data

No new endpoints and no new entities. Provides reusable middleware (`requireAuth`, `requireRole`) and ownership helpers used by F-03 to F-05. Migration: none, documented in the feature PR.

Error shape: `{ "error": { "code": "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND", "message": "..." } }`.

## Decision (SRS D-05)

Another user's proposal and a nonexistent proposal both return the same 404 body. 403 stays for wrong role. Tests assert identical status and body for both cases.

## Acceptance criteria

- **AC-05:** Anonymous calls to every protected endpoint return 401 with no private data.
- **AC-06:** A Student calling review or workload, and a Supervisor calling submit or supervisor list, get 403.
- **AC-07:** Student list and detail expose only own proposals; Supervisor list and detail expose only assigned proposals.
- **AC-08:** Cross-user proposal access or review returns the same 404 as a nonexistent ID with no private data; a non-assigned Supervisor cannot review.
- **AC-31:** All protected endpoints meet NFR-01 on auth failure.
- **AC-33:** Error responses contain no stack traces or SQL.
- **AC-36 to AC-41:** Injection, CSRF Origin, throttling, strict schemas and response whitelist, and headers, CORS and size cap behave as in the [STS](sts.md) security section. F-02 owns the shared middleware (Origin check, rate limiter, strict schema helper, headers, DTO whitelist).

Tests: TEST-05 to TEST-08, TEST-31, TEST-33, TEST-36 to TEST-41 in the [STS](sts.md).
