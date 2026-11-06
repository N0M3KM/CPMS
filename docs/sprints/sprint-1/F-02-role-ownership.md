# F-02 Role and team ownership enforcement

**Owner:** Jinnakan 1010 · **Reviewer:** Drarun 1016 · **Requirements:** FR-02, BR-06, BR-07, NFR-01, NFR-03, NFR-07, NFR-08, NFR-10, NFR-11, NFR-12 · **Depends on:** F-01

## Behavior and workflow

Auth middleware authenticates every protected request from the session. Role guards and team-scope checks run before any private data is read. Identity and role come only from the session; bodies, params, headers and cookies other than the session ID are never authority.

Check order: 401 (no or bad session), 403 (wrong role), uniform 404 (team not yours or does not exist), 400 (validation), 409 (rule conflict).

Team scope: a Student's scope is the one team they belong to; a Supervisor's scope is the teams where they are the supervisor. Every query includes the scope, so out-of-scope rows are never loaded.

Team ID guard: `requireTeam` returns 400 for a malformed ID and the uniform 404 for a well-formed foreign or missing ID.

Failure and boundary cases: expired session; Student calling a Supervisor-only route; Supervisor calling a Student-only route; an ID belonging to another team; a nonexistent ID; malformed UUID (400).

## Shared security middleware owned here

| Control | Behavior |
|---|---|
| Origin check | State-changing methods require `Origin` equal to `ALLOWED_ORIGIN`; otherwise 403 (NFR-08). |
| Body handling | `security.jsonBody` (JSON only, otherwise 415; size cap 10 KB, otherwise 413; malformed JSON 400) is part of each route chain, placed after `requireAuth` and `requireRole`. Only the Origin check is app-wide. A missing session (401) or wrong role (403) is never masked by a body error. |
| Strict schemas | Zod `.strict()` on every body, params and query; unknown fields return 400 (NFR-11). |
| Response whitelist | Output DTOs list fields explicitly; no password hash, session ID or out-of-scope data (NFR-11). |
| Rate limiter | General limit per IP (placeholder 100 per minute) returns 429; login limit is in F-01 (NFR-10). |
| Headers and CORS | Security headers, no `X-Powered-By`, same-origin CORS only (NFR-12). |
| Error handler | Maps typed errors to the JSON envelope; unexpected errors give a generic 500 with no stack or SQL (NFR-03). |

## UI

Hide controls the role cannot use. Usability only; the API stays authoritative.

## API and data

No new endpoints or entities. Provides `requireAuth`, `requireRole`, team-scope helpers, and the middleware above for F-03 to F-07. Migration: none.

Error shape: `{ "error": { "code": "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND" | "VALIDATION_ERROR" | "CONFLICT" | "RATE_LIMITED", "message": "..." } }`.

## Acceptance criteria

- **AC-08:** Anonymous calls to every protected endpoint return 401 with no private data (NFR-01).
- **AC-09:** A Student calling milestone creation or feedback, and a Supervisor calling submission, get 403 (BR-07).
- **AC-10:** A Student reading or submitting to another team's data gets the same 404 body as a nonexistent ID, with no private fields (BR-06).
- **AC-11:** A Supervisor reading, creating milestones for, or giving feedback on a team they do not supervise gets the same uniform 404 (BR-06).
- **AC-12:** Error responses contain no stack traces or SQL (NFR-03).
- **AC-13:** Hostile input (script, SQL, command, path traversal, URL payloads) has no effect and returns no system data (NFR-07).
- **AC-14:** State-changing requests from a foreign Origin or with a non-JSON body are rejected (NFR-08).
- **AC-15:** Unknown request fields are rejected, responses expose only whitelisted fields, and the BOLA matrix over every endpoint is denied outside scope (NFR-11).
- **AC-16:** Security headers, strict CORS, body size cap, clean dependency audit, and no secrets in repo or bundle (NFR-12).

Tests: TEST-08 to TEST-16 in the [STS](sts.md).
