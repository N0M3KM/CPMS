# CPMS Sprint 3 Software Test Specification and Definition of Done

**Version:** 1.0 (Deliverable 2)


**Approval status:** proposed on 2026-11-25, not yet approved. Needs Drarun's approval on PR #50 and confirmation from the instructor or TA. No implementation starts before that is recorded here.
**Related:** [Sprint 3 plan](plan.md) · [F-12 contract](F-12-search-filter.md) · [Sprint 1 STS](../sprint-1/sts.md) · [Traceability](../../traceability.md) · [Security test plan](../../security-test-plan.md)

## Version history

| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-11-25 | Initial Sprint 3 STS for Deliverable 2. TEST-79 to TEST-86 verify AC-79 to AC-86 (F-12). TEST-73 to TEST-78 are listed for AC-73 to AC-78 (F-11) as planned only. |

## Software Test Specification

Test IDs are stable identifiers. `TEST-nn` verifies `AC-nn`. Levels: unit, API (Vitest and Supertest on a separate test DB), DB integration, E2E (Playwright), manual. Planned F-12 test files are `server/tests/search-policy.test.ts` (unit) and `server/tests/search-db.test.ts` (API and DB).

The Status column is the only place that says whether a row has been run. Allowed values: `planned, not implemented` (no test code and no feature code exist), `planned` (written here, not yet run), `red` (run, fails for the intended reason, output saved), `green` (run and passing, output saved). At version 1.0 no row is `red` or `green`. A row changes status only when the saved output and the tested commit are recorded in `evidence/`.

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
| TEST-79 | AC-79 | API + DB | A1 and B1 sessions; seed above | A1 `GET /api/search?q=PROPOSAL`; A1 `?q=prototype`; A1 with no `q`; B1 `?q=proposal`; B1 `?q=prototype` | A1 `q=PROPOSAL`: 200, `items` has only `id(201)` with `teamId` `id(101)` and `status` `REVIEWED`, `total` 1, `page` 1, `limit` 20. A1 `q=prototype`: only `id(202)`. A1 no `q`: `201, 202`, `total` 2. B1 `q=proposal`: only `id(203)`, status `OVERDUE`. B1 `q=prototype`: `items: []`, `total` 0. No item has a `teamId` other than the caller's team. Every response has `Cache-Control: no-store`. | planned |
| TEST-80 | AC-80 | API + DB | S1 and S2 sessions; seed above | S1 `?q=proposal`; S1 no `q`; S1 `?q=proposal&teamId=id(102)`; S2 `?q=proposal`; S2 no `q` | S1 `q=proposal`: `201, 203`, `total` 2. S1 no `q`: `201, 203, 204, 202`, `total` 4. S1 with `teamId=id(102)`: only `203`. S2 `q=proposal`: only `205`, `total` 1. S2 no `q`: only `205`. No S2 response contains a Team A or Team B milestone, and no S1 response contains a Team C milestone. | planned |
| TEST-81 | AC-81 | API + DB | A1 and S2 sessions; seed above; one extra milestone titled `Prototype extra` created in Team B (`id(102)`) by the test | Before the insert and after it: A1 `?q=prototype`; A1 no `q`; S2 `?q=prototype` | A1 `q=prototype`: `items` is `[id(202)]` and `total` is 1 both times. A1 no `q`: `total` 2 both times. S2 `q=prototype`: `items: []`, `total` 0 both times. All A1 items have `teamId` `id(101)`. The Team B milestone is absent from every A1 and S2 response. | planned |
| TEST-82 | AC-82 | API + DB | S1 session; seed above; test closes `id(202)` (`closedAt` set); two extra Team A milestones with the same `dueAt` and ascending ids created for the ordering check | S1 `?status=OVERDUE`; `?status=REVIEWED`; `?status=SUBMITTED&q=requirements`; `?status=OVERDUE&q=proposal`; `?status=CLOSED`; `?status=NOT_SUBMITTED`; no filter; `?limit=2&page=2`; `?limit=20&page=99` | `OVERDUE`: only `203`. `REVIEWED`: only `201`. `SUBMITTED` with `q=requirements`: only `204`. `OVERDUE` with `q=proposal`: only `203`. `CLOSED`: only `202`. `NOT_SUBMITTED`: does not contain `202`. In every case `total` equals the number of matching rows, not the page size. No filter: `201, 203, 204, 202` in `dueAt` order, and the two equal-`dueAt` milestones in ascending `id` order. `limit=2&page=2` returns the third and fourth ordered rows with the same `total` as page 1. `page=99`: 200, `items: []`, real `total`. | planned |
| TEST-83 | AC-83 | API | A1, S1 and S2 sessions; seed above | A1 `?teamId=id(102)`; A1 `?teamId=id(999)` (no such team); S2 `?teamId=id(101)`; S1 `?teamId=id(103)`; A1 `GET /api/teams/id(102)`; A1 `?teamId=id(101)` | The four out-of-scope or nonexistent cases return 404 with the `NOT_FOUND` body, byte-identical to A1's `GET /api/teams/id(102)` response. No item or count is returned. A1 `?teamId=id(101)` returns 200 with `201, 202`. | planned |
| TEST-84 | AC-84 | Unit + API | Unit: `searchQuerySchema`. API: A1 session | Unit: parse `limit` 0, 1, 50, 51, `abc`; `page` 0, `abc`; `q` of 100 and 101 characters; `q` of `  proposal  `; `status` `DONE` and `overdue`; `teamId` `not-a-uuid`; extra key `sort`. API: each of the same values, plus `role=SUPERVISOR`, and `q=a&q=b` | `limit` 0 or 51 or `abc`, `page` 0 or `abc`, `q` of 101 characters, `status` `DONE` or `overdue`, `teamId` `not-a-uuid`, any unknown key (`sort`, `role`) and a repeated `q`: 400 `VALIDATION_ERROR`, no query run. `limit` 1 and 50 and a `q` of exactly 100 characters: accepted. `q` of `  proposal  ` parses to `proposal`. Defaults parse to `page` 1 and `limit` 20. Error bodies do not echo the rejected value. | planned |
| TEST-85 | AC-85 | API | A1 session; Team A extra milestones created by the test with titles `100% done check`, `Plan_B draft`, `Plan B draft` and `Owner's "final" review` | A1 `?q=zzzz`; `?q=%25`; `?q=_`; `?q=%27`; `?q=%22`; `?q=%27%3B%20DROP%20TABLE%20%22Milestone%22%3B--` | `q=zzzz`: 200, `items: []`, `total` 0, `page` 1, `limit` 20. `q=%` returns only `100% done check`. `q=_` returns only `Plan_B draft`, not `Plan B draft`. `q=%27` and `q=%22` return only `Owner's "final" review`. The injection string returns 200 with `items: []`, and a later search still returns the seed milestones. | planned |
| TEST-86 | AC-86 | API | No cookie; then a revoked session (A1 logs out); A1 session for error bodies | `GET /api/search` with no cookie; with the revoked cookie; with no cookie and `?limit=999`; A1 requests that produce 400 and 404 (TEST-83 and TEST-84 inputs); route-matrix test | 401 `UNAUTHENTICATED` body with no items in each unauthenticated case, including the one with invalid params (401 is checked before 400). The 400 and 404 bodies contain only `error.code` and `error.message` and match no stack frame, file path, `SELECT`, `prisma` or SQL text (NFR-03). `tests/security.test.ts` has the line `'GET /api/search': 'protected'` and fails if it is missing. | planned |

### F-11 Progress board and reports (contract only in Deliverable 2)

F-11 has no code in Deliverable 2. These rows reserve the test IDs. The request path, response shape, levels and exact bodies are fixed by the F-11 contract when it is approved, so the Expected result column states the behavior from the AC and the seed numbers only. Counts use the seed above at the fixed clock T0, with `id(202)` closed where a `closed` count is needed. The split of the six F-11 criteria into AC-73 to AC-78 follows the order they are listed in the Deliverable 2 plan and must be matched to the F-11 contract.

| Test | AC | Level | Precondition / input | Action | Expected result | Status |
|---|---|---|---|---|---|---|
| TEST-73 | AC-73 | API + DB (provisional) | S1 and S2 sessions; seed above; `id(202)` closed | Open the progress board as S1, then as S2 | 200. S1 lists Teams A and B only. Team A counts: `reviewed` 1, `closed` 1, others 0. Team B counts: `overdue` 1, `submitted` 1, others 0. S2 lists Team C only, `notSubmitted` 1. | planned, not implemented |
| TEST-74 | AC-74 | API (provisional) | A1 and B1 sessions | Open the board as A1, then as B1 | 200. A1 sees Team A only; B1 sees Team B only. No other team id, name or count appears. | planned, not implemented |
| TEST-75 | AC-75 | Unit + API + DB (provisional) | S1 session; seed above | Read the report totals for S1 | Each team's total equals the sum of its per-status counts and the number of its milestones (Team A 2, Team B 2). The report total for S1 is 4. | planned, not implemented |
| TEST-76 | AC-76 | Unit + API (provisional) | S1 session; `id(203)` (overdue, no submission) closed; `id(201)` (reviewed) closed | Read the board | `id(203)` counts as `closed`, not `overdue`. `id(201)` still counts as `reviewed`. Precedence follows `REVIEWED`, `SUBMITTED`, `CLOSED`, `OVERDUE`, `NOT_SUBMITTED`. | planned, not implemented |
| TEST-77 | AC-77 | API (provisional) | A test-created team with no milestones, or a test-created account with no team (same style as the F-07 empty-state cases) | Open the board for that user | 200 with zero counts and an empty list or zero totals as the contract defines. Not 404. | planned, not implemented |
| TEST-78 | AC-78 | API + DB (provisional) | A1 and S2 sessions; seed above | Add a milestone to Team B in the test DB; reread the board as A1 and as S2 | A1 and S2 counts are unchanged. No Team B count appears for A1. No Team A or Team B count appears for S2. | planned, not implemented |

Every AC-79 to AC-86 maps to exactly one test above. AC-73 to AC-78 each map to one planned test and are not verified.

### Known gaps in this specification

- The 1000-milestone scan cap (`MAX_SCANNED`) has no AC and no test, because the plan lists none. It is a stated limit in the F-12 contract and is carried in the remaining-work plan.
- NFR-05 (response time) for the search route is not covered by TEST-79 to TEST-86. A timing record on seeded data is planned after the release candidate (see Remaining work).
- Sprint 2 tests are in the Sprint 2 STS, not here.

## TDD expectations

For the scope rule (BR-06 and BR-11: TEST-79, TEST-80, TEST-81, TEST-83), the filter and ordering rule (TEST-82), the input rules (TEST-84, TEST-85) and the access rule (TEST-86), write the test first and run it before any search code exists. The expected red failure is a missing route (404 from the router, not a wrong body from a built route). Save the output as `F-12-red.txt`, then implement, then save the passing output as `F-12-green.txt`. Record both commits. Never weaken or skip a test to get a pass, and never edit a test to match code that leaks. If a test fails for a reason other than the intended one, fix the test setup and rerun the red step.

## Sprint 3 Definition of Done as of Deliverable 2

Each criterion is closed only when the evidence in the second column exists and its path is recorded. The Status column shows the state at version 1.0.

| # | Criterion | Evidence required | Status |
|---|---|---|---|
| 1 | Contracts, acceptance criteria and STS exist for every Sprint 3 feature: F-11 (AC-73 to AC-78) and F-12 (AC-79 to AC-86), with every AC mapped to a test row. | This STS, the F-12 contract and the F-11 contract; peer review recorded on each Issue (one specific check per contract). | drafted 2026-11-25, review pending |
| 2 | F-12 is implemented to its contract on `feature/12-search`, and AC-79 to AC-86 are each verified by their mapped test. | Passing output with counts, the command, and the tested commit. | open |
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
| F-12 UI polish, accessibility check, NFR-05 timing record | planned (implemented and API tested once criterion 2 is met) | Keyboard and contrast check, timing run on seeded data | Jinnakan | 2026-12-06 |
| F-12 scan cap (1000) | stated limit, no test | Decide whether to add an AC and a test or keep it as a documented limit | Drarun | 2026-12-06 |
| Open defects from the register | per register | Fix with a new test, re-test live | owner per row | 2026-12-08 |
| UAT re-tests (Lab 6 findings, partner re-test of CF-01) | pending partner | Run cases, record in the register | Both | 2026-12-09 |
| Regression, security suite and dependency audit on the final commit | to be run on the final tag | Re-run on the final tag, record counts | Both | 2026-12-10 |
| Final video, README, clean-clone check, final release tag | not started | Record video, clean-clone run, tag | Both | 2026-12-12 |
