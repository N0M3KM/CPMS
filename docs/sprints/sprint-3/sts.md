# CPMS Sprint 3 Software Test Specification and Definition of Done

**Version:** 1.2 (Deliverable 2)


**Approval status:** F-12 local implementation and verification authorized on 2026-11-26. Peer review and release acceptance are pending. F-11 remains scoped for later implementation.
**Related:** [Sprint 3 plan](plan.md) · [F-11 contract](F-11-progress-board.md) · [F-12 contract](F-12-search-filter.md) · [Sprint 1 STS](../sprint-1/sts.md) · [Traceability](../../traceability.md) · [Security test plan](../../security-test-plan.md)

## Version history

| Version | Date | Change |
|---|---|---|
| 1.2 | 2026-11-26 | Recorded local green results for F-12 on 1679d54. Staging and deployment remain open. |
| 1.1 | 2026-11-26 | Added TEST-96 for the bounded search window and TEST-97 for the browser workflow. Resolved provisional F-11 test inputs. |
| 1.0 | 2026-11-25 | Initial Sprint 3 STS for Deliverable 2. TEST-79 to TEST-86 verify AC-79 to AC-86 (F-12). TEST-73 to TEST-78 are listed for AC-73 to AC-78 (F-11) as planned only. |

## Software Test Specification

Test IDs are stable identifiers. `TEST-nn` verifies `AC-nn`. Levels: unit, API (Vitest and Supertest on a separate test DB), DB integration, E2E (Playwright), manual. F-12 verification files are `server/tests/search-policy.test.ts`, `server/tests/search-db.test.ts` and `e2e/f12-search.spec.ts`. Update execution status only from versioned evidence.

The Status column is the only place that says whether a row has been run. Allowed values: `planned, not implemented` (no test code and no feature code exist), `planned` (written here, not yet run), `red` (run, fails for the intended reason, output saved), `green` (run and passing, output saved). Version 1.0 records the planned tests. Version 1.2 records local results. Local results and the tested commit are in [F-12 green evidence](evidence/F-12-green.txt). The [red evidence](evidence/F-12-red.txt) records the test-first failures.

### Seed data used

Seed users, as in the [Sprint 1 STS](../sprint-1/sts.md): Student A1, A2 (Team A), B1, B2 (Team B), C1, C2 (Team C); Supervisor S1 (Teams A and B), S2 (Team C). No other user is used. Fixed identifiers come from `server/src/seed/seed.ts`: `id(n)` is `00000000-0000-4000-8000-` followed by `n` as 12 digits. S1 is `id(1)`, S2 `id(2)`, A1 `id(11)`, B1 `id(13)`, C1 `id(15)`, Team A `id(101)`, Team B `id(102)`, Team C `id(103)`.

Seed milestones, with the clock fixed at the seed time T0. The seed sets `dueAt` relative to T0.

| Milestone | Team | Title | dueAt | Computed status |
|---|---|---|---|---|
| `id(201)` | A | Project proposal draft | T0 minus 14 days | `REVIEWED` |
| `id(203)` | B | Project proposal draft | T0 minus 7 days | `OVERDUE` |
| `id(204)` | B | Requirements review | T0 plus 7 days | `SUBMITTED` |
| `id(205)` | C | Project proposal draft | T0 plus 10 days | `NOT_SUBMITTED` |
| `id(202)` | A | Prototype demo | T0 plus 14 days | `NOT_SUBMITTED` |

Rows are listed in `dueAt` order. So A1 sees `201, 202`; B1 sees `203, 204`; C1 sees `205`; S1 sees `201, 203, 204, 202`; S2 sees `205`. This table is read from the seed code on 2026-11-25. If Sprint 2 changes the seed, update this table and the rows below before the tests are written.

Error bodies, from `server/src/platform/errors.ts`: 401 `{"error":{"code":"UNAUTHENTICATED","message":"Sign in to continue."}}`, 404 `{"error":{"code":"NOT_FOUND","message":"Not found."}}`, 400 `{"error":{"code":"VALIDATION_ERROR","message":"The request is not valid."}}`. Each item in a search result has exactly the keys `id`, `teamId`, `title`, `dueAt`, `status`.

### F-12 Search and filter (implemented in Sprint 3)

Dependencies: F-07 (scope and status), F-08 (newest revision), F-09 (`closedAt`, `CLOSED`). Rows that need a closed milestone close one through the F-09 route or set `closedAt` directly in the test DB.

| Test | AC | Level | Precondition / input | Action | Expected result | Status |
|---|---|---|---|---|---|---|
| TEST-79 | AC-79 | API + DB | A1 and B1 sessions; seed above | A1 `GET /api/search?q=PROPOSAL`; A1 `?q=prototype`; A1 with no `q`; B1 `?q=proposal`; B1 `?q=prototype` | A1 `q=PROPOSAL`: 200, `items` has only `id(201)` with `teamId` `id(101)` and `status` `REVIEWED`, `total` 1, `page` 1, `limit` 20. A1 `q=prototype`: only `id(202)`. A1 no `q`: `201, 202`, `total` 2. B1 `q=proposal`: only `id(203)`, status `OVERDUE`. B1 `q=prototype`: `items: []`, `total` 0. No item has a `teamId` other than the caller's team. Every response has `Cache-Control: no-store`. | green (local) |
| TEST-80 | AC-80 | API + DB | S1 and S2 sessions; seed above | S1 `?q=proposal`; S1 no `q`; S1 `?q=proposal&teamId=id(102)`; S2 `?q=proposal`; S2 no `q` | S1 `q=proposal`: `201, 203`, `total` 2. S1 no `q`: `201, 203, 204, 202`, `total` 4. S1 with `teamId=id(102)`: only `203`. S2 `q=proposal`: only `205`, `total` 1. S2 no `q`: only `205`. No S2 response contains a Team A or Team B milestone, and no S1 response contains a Team C milestone. | green (local) |
| TEST-81 | AC-81 | API + DB | A1 and S2 sessions; seed above; one extra milestone titled `Prototype extra` created in Team B (`id(102)`) by the test | Before the insert and after it: A1 `?q=prototype`; A1 no `q`; S2 `?q=prototype` | A1 `q=prototype`: `items` is `[id(202)]` and `total` is 1 both times. A1 no `q`: `total` 2 both times. S2 `q=prototype`: `items: []`, `total` 0 both times. All A1 items have `teamId` `id(101)`. The Team B milestone is absent from every A1 and S2 response. | green (local) |
| TEST-82 | AC-82 | API + DB | S1 session; seed above; test closes `id(202)` (`closedAt` set); two extra Team A milestones with the same `dueAt` and ascending ids created for the ordering check | S1 `?status=OVERDUE`; `?status=REVIEWED`; `?status=SUBMITTED&q=requirements`; `?status=OVERDUE&q=proposal`; `?status=CLOSED`; `?status=NOT_SUBMITTED`; no filter; `?limit=2&page=2`; `?limit=20&page=99` | `OVERDUE`: only `203`. `REVIEWED`: only `201`. `SUBMITTED` with `q=requirements`: only `204`. `OVERDUE` with `q=proposal`: only `203`. `CLOSED`: only `202`. `NOT_SUBMITTED`: does not contain `202`. In every case `total` equals the number of matching rows, not the page size. No filter: `201, 203, 204, 202` in `dueAt` order, and the two equal-`dueAt` milestones in ascending `id` order. `limit=2&page=2` returns the third and fourth ordered rows with the same `total` as page 1. `page=99`: 200, `items: []`, real `total`. | green (local) |
| TEST-83 | AC-83 | API | A1, S1 and S2 sessions; seed above | A1 `?teamId=id(102)`; A1 `?teamId=id(999)` (no such team); S2 `?teamId=id(101)`; S1 `?teamId=id(103)`; A1 `GET /api/teams/id(102)`; A1 `?teamId=id(101)` | The four out-of-scope or nonexistent cases return 404 with the `NOT_FOUND` body, byte-identical to A1's `GET /api/teams/id(102)` response. No item or count is returned. A1 `?teamId=id(101)` returns 200 with `201, 202`. | green (local) |
| TEST-84 | AC-84 | Unit + API | Unit: `searchQuerySchema`. API: A1 session | Unit: parse `limit` 0, 1, 50, 51, `abc`; `page` 0, `abc`; `q` of 100 and 101 characters; `q` of `  proposal  `; `status` `DONE` and `overdue`; `teamId` `not-a-uuid`; extra key `sort`. API: each of the same values, plus `role=SUPERVISOR`, and `q=a&q=b` | `limit` 0 or 51 or `abc`, `page` 0 or `abc`, `q` of 101 characters, `status` `DONE` or `overdue`, `teamId` `not-a-uuid`, any unknown key (`sort`, `role`) and a repeated `q`: 400 `VALIDATION_ERROR`, no query run. `limit` 1 and 50 and a `q` of exactly 100 characters: accepted. `q` of `  proposal  ` parses to `proposal`. Defaults parse to `page` 1 and `limit` 20. Error bodies do not echo the rejected value. | green (local) |
| TEST-85 | AC-85 | API | A1 session; Team A extra milestones created by the test with titles `100% done check`, `Plan_B draft`, `Plan B draft` and `Owner's "final" review` | A1 `?q=zzzz`; `?q=%25`; `?q=_`; `?q=%27`; `?q=%22`; `?q=%27%3B%20DROP%20TABLE%20%22Milestone%22%3B--` | `q=zzzz`: 200, `items: []`, `total` 0, `page` 1, `limit` 20. `q=%` returns only `100% done check`. `q=_` returns only `Plan_B draft`, not `Plan B draft`. `q=%27` and `q=%22` return only `Owner's "final" review`. The injection string returns 200 with `items: []`, and a later search still returns the seed milestones. | green (local) |
| TEST-86 | AC-86 | API | No cookie; then a revoked session (A1 logs out); A1 session for error bodies | `GET /api/search` with no cookie; with the revoked cookie; with no cookie and `?limit=999`; A1 requests that produce 400 and 404 (TEST-83 and TEST-84 inputs); route-matrix test | 401 `UNAUTHENTICATED` body with no items in each unauthenticated case, including the one with invalid params (401 is checked before 400). The 400 and 404 bodies contain only `error.code` and `error.message` and match no stack frame, file path, `SELECT`, `prisma` or SQL text (NFR-03). `tests/security.test.ts` has the line `'GET /api/search': 'protected'` and fails if it is missing. | green (local) |

| TEST-96 | AC-96 | API + DB | 1,001 same-title Team A milestones ordered by due date and ID, plus an earlier foreign row | Request page 20 and 21 with limit 50, then filter for a status found only beyond the bound | Page 20 ends on scoped row 1,000, page 21 is empty with total 1,000, and the status filter returns zero. The foreign row never consumes capacity. | green (local) |
| TEST-97 | AC-97 | E2E | A1 and S1 signed in with seed data | Search, filter, page results and open a milestone. Exercise zero matches, a recoverable read error and a 401 | Appropriate role sees scoped matches and can open a result. Empty, retry and sign-in states are visible. | green (local) |

### F-11 Progress board and reports (contract only in Deliverable 2)

F-11 test design uses GET /api/progress with the exact response defined in the F-11 contract. Use the seed above at T0 and close `id(202)` for the closed counter. API tests assert status 200 and allowlisted fields. Test identities come from signed-in sessions.

| Test | AC | Level | Precondition / input | Action | Expected result | Status |
|---|---|---|---|---|---|---|
| TEST-73 | AC-73 | API + DB | S1 and S2 sessions; seed above; `id(202)` closed | Open the progress board as S1, then as S2 | 200. S1 lists Teams A and B only. Team A counts: `reviewed` 1, `closed` 1, others 0. Team B counts: `overdue` 1, `submitted` 1, others 0. S2 lists Team C only, `notSubmitted` 1. | planned, not implemented |
| TEST-74 | AC-74 | API | A1 and B1 sessions | Open the board as A1, then as B1 | 200. A1 sees Team A only; B1 sees Team B only. No other team id, name or count appears. | planned, not implemented |
| TEST-75 | AC-75 | Unit + API + DB | S1 session; seed above | Read the report totals for S1 | Each team's total equals the sum of its per-status counts and the number of its milestones (Team A 2, Team B 2). The report total for S1 is 4. | planned, not implemented |
| TEST-76 | AC-76 | Unit + API | S1 session; `id(203)` (overdue, no submission) closed; `id(201)` (reviewed) closed | Read the board | `id(203)` counts as `closed`, not `overdue`. `id(201)` still counts as `reviewed`. Add a version without feedback to it and verify the reviewed count falls and submitted increases. Add a milestone due exactly at T0 and verify it is not overdue. Precedence follows `REVIEWED`, `SUBMITTED`, `CLOSED`, `OVERDUE`, `NOT_SUBMITTED`. | planned, not implemented |
| TEST-77 | AC-77 | API | A student without a team, a supervisor without assigned teams, and a supervised team with zero milestones | Open the board in each of the three cases | 200 with zero counts and an empty list or zero totals as the contract defines. Not 404. | planned, not implemented |
| TEST-78 | AC-78 | API + DB | A1 and S2 sessions; seed above | Create, submit, review and close a Team B milestone. Reread as A1 and S2 after each transition | A1 and S2 counts are unchanged. No Team B count appears for A1. No Team A or Team B count appears for S2. | planned, not implemented |

AC-79 to AC-86 and AC-96 to AC-97 each map to one named test group above. AC-73 to AC-78 each map to one planned test and are not verified.

### Known gaps in this specification

- AC-96 and TEST-96 cover the 1,000-row bound. A future scalability change can move filtering into the database while preserving shared status semantics.
- NFR-05 (response time) for the search route is not covered by TEST-79 to TEST-86. A timing record on seeded data is planned after the release candidate (see Remaining work).
- Sprint 2 tests are in the Sprint 2 STS, not here.

## TDD expectations

For the scope rule (BR-06 and BR-11: TEST-79, TEST-80, TEST-81, TEST-83), the filter and ordering rule (TEST-82), the input rules (TEST-84, TEST-85) and the access rule (TEST-86), write the test first and run it before any search code exists. The expected red failure is a missing route (404 from the router, not a wrong body from a built route). Save the output as `F-12-red.txt`, then implement, then save the passing output as `F-12-green.txt`. Record both commits. Never weaken or skip a test to get a pass, and never edit a test to match code that leaks. If a test fails for a reason other than the intended one, fix the test setup and rerun the red step.

## Sprint 3 Definition of Done as of Deliverable 2

Each criterion is closed only when the evidence in the second column exists and its path is recorded. The Status column shows the state at version 1.0.

| # | Criterion | Evidence required | Status |
|---|---|---|---|
| 1 | Contracts, acceptance criteria and STS exist for every Sprint 3 feature: F-11 (AC-73 to AC-78) and F-12 (AC-79 to AC-86), with every AC mapped to a test row. | This STS, the F-12 contract and the F-11 contract; peer review recorded on each Issue (one specific check per contract). | drafted 2026-11-25, review pending |
| 2 | F-12 is implemented to its contract on `feature/12-search`, and AC-79 to AC-86 and AC-96 to AC-97 are each verified by their mapped test. | Passing output with counts, the command, and the tested commit. | open |
| 3 | F-12 was built test first with red and green evidence. | `F-12-red.txt` showing the intended failure, `F-12-green.txt` showing the pass, both commits recorded. | open |
| 4 | F-12 is peer reviewed by Jinnakan and merged into `sprint-3-staging` by a pull request opened as a draft. | PR number, a specific reviewer check, merge commit. | open |
| 5 | F-11 is not presented as done. Its rows read `planned, not implemented` in this STS, in the traceability matrix and in the PDF. | Matching wording in all three places; no F-11 code in the tagged commit. | open |
| 6 | Sprint 1 and Sprint 2 behavior still passes with F-12 present. | Full server test run and E2E run on `sprint-3-staging` with counts of passed, failed and skipped; any failure or skip disclosed. | open |
| 7 | Security checks cover the new route. | The route-matrix line for `GET /api/search` in `tests/security.test.ts`; `npm audit` result with no unresolved high or critical finding. | open |
| 8 | A deployed release candidate contains F-12. | Release PR `sprint-3-staging` to `main`, tag `deliverable-2-rc1`, CI run, deployed `/api/version` matching the tag and commit, smoke and acceptance script output. | open |
| 9 | Remaining work is listed with owners and dates. | The table below, and the full list in `docs/sprints/sprint-3/remaining-work.md`. | drafted 2026-11-25 |
| 10 | Failed, skipped and incomplete work is disclosed. No real secrets appear in Git, logs, screenshots or the PDF. | Evidence files and the PDF. | open |

Completion is shown by evidence, not by an AI agent's statement.

### Remaining work after Deliverable 2

Starting rows from the Deliverable 2 plan. Adjust them to what actually happened before the PDF is assembled. Statuses use the words planned, in progress, implemented, tested, accepted.

| Item | Status | Remaining action | Owner | Target |
|---|---|---|---|---|
| F-11 AC-73 to AC-78 | planned, not implemented | Tests first, board endpoint, board UI, report totals | Drarun | 2026-12-05 |
| F-12 accessibility and production timing follow-up | planned (implemented and API tested once criterion 2 is met) | Keyboard and contrast audit. Local timing recorded in evidence. Measure deployed candidate after release. | Jinnakan | 2026-12-06 |
| F-12 scan cap (1000) | AC-96 and TEST-96 specified | Revisit scale only if course data approaches the bound | Drarun | 2026-12-06 |
| Open defects from the register | per register | Fix with a new test, re-test live | owner per row | 2026-12-08 |
| UAT re-tests (Lab 6 findings, partner re-test of CF-01) | pending partner | Run cases, record in the register | Both | 2026-12-09 |
| Regression, security suite and dependency audit on the final commit | to be run on the final tag | Re-run on the final tag, record counts | Both | 2026-12-10 |
| Final video, README, clean-clone check, final release tag | not started | Record video, clean-clone run, tag | Both | 2026-12-12 |
