# F-12 Search and filter

**Owner:** Drarun 1016 · **Reviewer:** Jinnakan 1010 · **Requirements:** FR-12, BR-06, BR-11 (new), NFR-01, NFR-03, NFR-11 · **Depends on:** F-07, F-08 and F-09 (Sprint 2)

## Behavior and workflow

A signed-in user searches the milestones they are entitled to see. A Student searches the milestones of their one team. A Supervisor searches the milestones of every team they supervise. The search can be narrowed by title text (`q`), by computed status (`status`) and by one team (`teamId`), and the result is paged.

The team scope is part of every query, including the query that produces `total`. Scope is applied first, then `q` and `teamId`, then the status filter, then paging. Another team's milestone never enters the result set, so it can neither appear in `items` nor change `total`. BR-11 states this rule for search: a search or filter may only return, count or page over records inside the caller's team scope (BR-06), and scope is applied before any filter, count or pagination.

How a request is handled:

1. Authenticate. No valid session returns 401.
2. Validate the query with a strict schema. Unknown parameters and out-of-range values return 400.
3. If `teamId` is given, check it against the caller's scope. A team outside the scope, or one that does not exist, returns the uniform 404, the same body as `GET /api/teams/:teamId` for a foreign team.
4. Load at most 1000 in-scope milestones, filtered by `q` and `teamId`, ordered by `dueAt` then `id`.
5. Compute each milestone's status with the shared status function (precedence `REVIEWED`, `SUBMITTED`, `CLOSED`, `OVERDUE`, `NOT_SUBMITTED`; status is computed on the newest revision) and drop the rows that do not match `status`.
6. `total` is the number of rows left after step 5. `items` is the requested page of those rows.

Rules that follow from this flow:

- `q` is trimmed. A `q` that is empty after trimming is treated as no `q`.
- `q` matches the milestone title only, as a case-insensitive substring. Team names, descriptions, submissions and feedback are not searched.
- `%` and `_` in `q` match themselves, not as wildcards. Quotes and other punctuation are plain text.
- Validation (400) runs before the `teamId` scope check (404), as it does for `GET /api/teams/:teamId`. A request with an unknown parameter and a foreign `teamId` returns 400.
- A page past the last one returns 200 with `items: []` and the real `total`.
- A search that matches nothing returns 200 with `items: []` and `total: 0`. It is not an error.
- Responses carry `Cache-Control: no-store`.

### Stated limit: status is filtered in memory

Milestone status is not a stored column. It is computed from the newest submission, its feedback, `closedAt` and the clock. The status filter therefore runs in application code after the rows are loaded, and at most 1000 in-scope milestones (after `q` and `teamId`) are loaded per request (`MAX_SCANNED`).

This is acceptable at course scale: the seed has 5 milestones and a real course is a handful of teams with tens of milestones each, far under the cap. The cap keeps the work bounded for any caller.

What the limit means in practice: if more than 1000 milestones match scope, `q` and `teamId`, only the first 1000 by `dueAt` then `id` are considered. `total` then counts within those 1000 and can understate, and later milestones are not reachable through paging. The response has no field that says the cap was hit. The same limit is listed in the readiness review and in the remaining-work plan. Moving the status filter into SQL is possible later but would duplicate the status rules, so it is not done now.

## UI

- Search view for both roles: a text box for `q`, a status select (any, `NOT_SUBMITTED`, `SUBMITTED`, `REVIEWED`, `OVERDUE`, `CLOSED`), a results list showing title, due date and status badge, and paging controls.
- `teamId` is available through the API. The first UI has no team selector.
- Empty state when nothing matches. Loading, error and success states as on every data view.
- A 401 response ends the session in the UI the same way as on the other views.
- Cut line: the UI may be cut first. The API and its tests are the implemented rule.

## API

| Call | Access | Response |
|---|---|---|
| `GET /api/search` | Authenticated (Student or Supervisor) | `{items:[{id,teamId,title,dueAt,status}], total, page, limit}` scoped to the caller. |

Query parameters. The schema is strict: any other parameter is a 400.

| Parameter | Rule | Default |
|---|---|---|
| `q` | Optional string, trimmed, at most 100 characters | none |
| `status` | Optional, one of `NOT_SUBMITTED`, `SUBMITTED`, `REVIEWED`, `OVERDUE`, `CLOSED` (case-sensitive) | none |
| `teamId` | Optional UUID of a team in the caller's scope | none |
| `page` | Integer, at least 1 | 1 |
| `limit` | Integer, 1 to 50 | 20 |

Ordering is `dueAt` ascending, then `id` ascending. Items are whitelisted DTOs: no description, submission, feedback or grade is returned.

Errors use the shared envelope `{error:{code,message}}` with fixed text and no stack or SQL (NFR-03).

| Status | Code | When |
|---|---|---|
| 401 | `UNAUTHENTICATED` | No valid session. Checked before validation. |
| 400 | `VALIDATION_ERROR` | Bad `q`, `status`, `teamId`, `page` or `limit`, or an unknown parameter. |
| 404 | `NOT_FOUND` | `teamId` is outside the caller's scope or does not exist. |

Both roles may call the route, so there is no 403 case. The route is read only, so the Origin and content-type checks for state-changing requests do not apply to it.

## Data

No new entities, columns, migrations or indexes. Read queries only. The plan proposes no index: the query is bounded by scope and the 1000-row cap, and the course dataset is small.

## Acceptance criteria

- **AC-79:** `GET /api/search?q=` as a student returns only own-team milestones whose title contains q (case-insensitive).
- **AC-80:** As a supervisor: only supervised teams' milestones.
- **AC-81:** total and items are computed after scope: adding a matching milestone in another team changes nothing.
- **AC-82:** status filter (including OVERDUE, CLOSED) and combinations with q, ordered by dueAt then id.
- **AC-83:** teamId outside scope: the uniform 404.
- **AC-84:** limit outside 1 to 50, q over 100 chars, bad status or unknown params: 400.
- **AC-85:** No match: 200, items: [], total: 0. %, _ and quotes in q match literally.
- **AC-86:** Unauthenticated 401. No stack or SQL in errors (NFR-03).

### No change needed

- No change to the Sprint 1 and Sprint 2 DTOs, routes or status rules. `GET /api/teams`, `GET /api/teams/:teamId` and `GET /api/milestones/:milestoneId` behave as before, and TEST-35 is unaffected by F-12.
- No schema change, migration, seed change or new environment variable.
- No change to authentication, sessions, the error envelope, the uniform 404 or the role matrix beyond one new route line, `GET /api/search`, marked `protected` in the route matrix test.
- No new permission: a Student and a Supervisor see exactly the milestones they could already open one by one.

Tests: TEST-79 to TEST-86 in the [STS](sts.md). Red and green evidence for the scope and validation tests is saved as `F-12-red.txt` and `F-12-green.txt`.

## Version history

| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-11-25 | Initial contract for Deliverable 2. AC-79 to AC-86. States the in-memory status filter and the 1000-milestone scan cap as limits. |
