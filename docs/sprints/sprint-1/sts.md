# CPMS Sprint 1 Software Test Specification and Definition of Done

**Version:** 2.1
**Related:** [Sprint 1 plan](plan.md) · [Traceability](../../traceability.md) · [Security test plan](../../security-test-plan.md) · feature contracts `F-01` to `F-07` in this folder

## Version history

| Version | Date | Change |
|---|---|---|
| 2.1 | 2026-11-06 | Aligned TEST-06 with the F-01 request validation and redirect behavior. |
| 2.0 | 2026-11-06 | Reworked for Theme 6. AC-01 to AC-41 and TEST-01 to TEST-43 renumbered by feature; security cases grouped into AC-06, 07, 13 to 16. |
| 1.1 | 2026-11-06 | Added security ACs for NFR-07 to NFR-12 (proposal domain, superseded). |
| 1.0 | 2026-11-06 | Initial split (proposal domain, superseded). |

## Software Test Specification

Test IDs are planned. No test file exists and nothing has run. Levels: unit, API (Vitest and Supertest on a separate test DB), DB integration, E2E (Playwright), manual. `TEST-nn` verifies `AC-nn`.

Seed users used below: Student A1, A2 (Team A), B1 (Team B), C1 (Team C); Supervisor S1 (Teams A and B), S2 (Team C).

| Test | AC | Level | Precondition / input | Action | Expected result |
|---|---|---|---|---|---|
| TEST-01 | AC-01 | API | Seeded Student | Login with valid credentials | 200, safe identity and role, cookie `httpOnly` and `SameSite=Lax` |
| TEST-02 | AC-02 | API | Seeded Supervisor | Valid login | 200, Supervisor role, cookie |
| TEST-03 | AC-03 | API | No session | Invalid email, then invalid password | Identical generic 401; no session row |
| TEST-04 | AC-04 | API | Valid, revoked and expired sessions | `me`, logout, protected call; repeat for expiry | Identity while valid; 401 afterward |
| TEST-05 | AC-05 | DB integration | Seeded user | Inspect credential column | bcrypt hash only |
| TEST-06 | AC-06 | API | Registered and unknown emails | SEC-07, SEC-09, SEC-10 | Same status and body with comparable timing; unknown JSON fields 400; redirect query parameters ignored; fresh session ID; tampered cookies 401 |
| TEST-07 | AC-07 | API | One IP, repeated failures and bursts | SEC-08, SEC-16 | 429 with `Retry-After` after threshold; same for unknown emails; normal use unaffected |
| TEST-08 | AC-08 | API | No cookie | Call each protected route | 401; no private fields |
| TEST-09 | AC-09 | API | Student and Supervisor sessions | Student creates milestone and feedback; Supervisor submits | 403 each; nothing created |
| TEST-10 | AC-10 | API | A1 session; B1 team data | A1 reads and submits to Team B resources, and to a nonexistent ID | Same 404 status and body for both; no data |
| TEST-11 | AC-11 | API | S2 session; Teams A and B | S2 reads, creates milestone, gives feedback on Team A resources | Same uniform 404; nothing stored |
| TEST-12 | AC-12 | API | Trigger validation, conflict, unexpected error | Inspect JSON | No stack or SQL text |
| TEST-13 | AC-13 | API + review | Hostile payloads | SEC-01, 02, 04, 11, 12 | No effect; no system data; code gates pass |
| TEST-14 | AC-14 | API | Valid session | SEC-03 foreign Origin, form-encoded body | 403 and 415; `GET` never mutates |
| TEST-15 | AC-15 | API | All endpoints and roles | SEC-05, 06, 13, 14, 15 | Unknown fields rejected; whitelisted fields only; BOLA matrix denied outside scope |
| TEST-16 | AC-16 | API + command | Running app, repo | SEC-17, 18, 19, 20 | Headers, CORS, size cap, clean audit, no secrets |
| TEST-17 | AC-17 | API | S1 session, Team A | Create milestones with title 5 and 100, future `dueAt` | 201; creator is S1; appears in team list |
| TEST-18 | AC-18 | Unit + API | Request schema | Short or long title, long description, bad date, malformed team ID | 400; no insert |
| TEST-19 | AC-19 | Unit + API | Fixed clock | `dueAt` in the past and equal to now | 400; no insert |
| TEST-20 | AC-20 | API | A1 session | POST milestone | 403; no insert |
| TEST-21 | AC-21 | API | A1 session; open milestone | Submit at 5/100 and 20/2000 boundaries with `https` link | 201; `submittedById` is A1; readable after reload |
| TEST-22 | AC-22 | Unit + API | Request schema | Bad lengths, `javascript:`, `data:`, `file:`, `ftp:`, relative and 501-char links | 400; no insert |
| TEST-23 | AC-23 | API | Existing submission; then two concurrent members | Submit again; submit as A1 and A2 at once | 409 and original kept; exactly one record |
| TEST-24 | AC-24 | Unit + API | Fixed clock | Submit at `dueAt` minus 1 s, at `dueAt`, at `dueAt` plus 1 s | Accepted, accepted, 409 `DEADLINE_PASSED` with no record |
| TEST-25 | AC-25 | API | B1 session; Team A milestone | Submit | Uniform 404; no record |
| TEST-26 | AC-26 | API | S1 session | POST submission | 403; no record |
| TEST-27 | AC-27 | API | S1 session; Team A submission | Feedback of 10 and 2000 trimmed characters | 201; linked to submission; status `REVIEWED` |
| TEST-28 | AC-28 | Unit + API | S1 session | Missing, blank, 9-char, 2001-char comment | 400; no record |
| TEST-29 | AC-29 | API | Submission with feedback | Second feedback | 409; original kept |
| TEST-30 | AC-30 | API | S2 session; Team A submission | POST feedback | Uniform 404; no record |
| TEST-31 | AC-31 | API | A1 session | POST feedback | 403; no record |
| TEST-32 | AC-32 | API | Team A feedback exists | A1 and A2 read; B1 reads | A1, A2 see it; B1 gets uniform 404 |
| TEST-33 | AC-33 | DB integration | Empty test DB; seed env set | Run seed, inspect | 2 Supervisors, 6 Students, 3 teams, milestones in every status |
| TEST-34 | AC-34 | DB integration | Seeded test DB | Run seed twice, inspect counts and logs | Stable counts; no passwords printed |
| TEST-35 | AC-35 | API | A1 session | List teams; read team, milestone | Only Team A data |
| TEST-36 | AC-36 | API | S1 and S2 sessions | List teams; open milestones | S1 sees A and B with correct counts; S2 sees C; cross access 404 |
| TEST-37 | AC-37 | Unit + API | Fixed clock; milestone in each state | Read status at `dueAt` and `dueAt` plus 1 s | Four statuses correct; boundary not overdue |
| TEST-38 | AC-38 | E2E | Empty, loading, error, success conditions | Exercise each view | Correct feedback visible |
| TEST-39 | AC-39 | Unit or documented check | Final tokens | Compute contrast | Ratios at least 4.5:1 |
| TEST-40 | AC-40 | Manual | Local seeded env | Time auth, list, detail, create, submit, feedback | Method, conditions and latency recorded; typical under 500 ms |
| TEST-41 | AC-41 | API + E2E | Student and Supervisor sessions | Inspect role UI; call forbidden endpoints directly | Actions hidden; API denies |
| TEST-42 | AC-17, AC-21, AC-35 | E2E | Seeded S1 and A1, Team A | S1 logs in, creates milestone; A1 logs in, submits, reloads | Milestone and submission persist; status `SUBMITTED`; A1 sees own team only |
| TEST-43 | AC-27, AC-28, AC-32 | E2E | Seeded S1, A1, B1; submission exists | S1 sends short comment (blocked), then valid; A1 views; B1 attempts | Invalid blocked with no state change; feedback persists; A1 sees it; B1 cannot |

Every AC-01 to AC-41 maps to at least one test above. SEC case details are in the [security test plan](../../security-test-plan.md).

## TDD expectations

For BR-01 (TEST-23), BR-02 (TEST-24), the link rule (TEST-22), BR-03 (TEST-18, TEST-19), BR-05 (TEST-28, TEST-29) and the role and scope rules (TEST-09 to TEST-11) write the test first, run it, keep the failing output showing the intended reason, then implement and keep the passing output. Record both commits. Never weaken or skip a test to get a pass.

## Product Definition of Done

- F-01 to F-07 implemented to these contracts; BR-01 to BR-07 enforced on the backend.
- Every AC-01 to AC-41 verified by its mapped test; actual results, counts, commands and tested commit recorded.
- Real login, logout and `me`; two roles; milestone to submission to feedback persisted through UI, API and database; both E2E journeys pass.
- Loading, empty, error and success states present; contrast and timing evidence recorded.
- Additive migration, idempotent seed, env-only secrets, health and ready endpoints work from a clean clone using the README.
- Each feature reviewed by the other developer through a PR into Sprint 1 staging; staging integrated, system and acceptance checks run, release PR merged to `main`, tag recorded.
- Failed, skipped and incomplete work disclosed; no real secrets in Git, logs, screenshots or the PDF.
- Completion is shown by evidence, not by an AI agent's statement.
