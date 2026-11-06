# CPMS Sprint 1 Software Test Specification and Definition of Done

**Version:** 1.0 (draft for review)
**Related:** [Sprint 1 plan](plan.md) · [Traceability](../../traceability.md) · feature contracts `F-01` to `F-06` in this folder

## Version history

| Version | Date | Change |
|---|---|---|
| 0.1 to 0.6 | 2026-11-05 to 2026-11-06 | Drafts as `docs/sprints/sprint-1/specification.md`. |
| 1.0 | 2026-11-06 | Split into per-feature contracts and this STS. Renamed `A01..A35` to `AC-01..AC-35` and `T01..T35` to `TEST-01..TEST-35` (editorial, no behavior change). Moved FR/BR/NFR to the SRS. Added F-06 contract and `NFR-06`. |

## Software Test Specification

Test IDs are planned. No test file exists and nothing has run. Levels: unit, API (Vitest and Supertest against a separate test DB), DB integration, E2E (Playwright), manual.

| Test | AC | Level | Precondition / input | Action | Expected result |
|---|---|---|---|---|---|
| TEST-01 | AC-01 | API | Seeded Student; isolated DB | POST login with valid credentials | 200, safe role identity, cookie `httpOnly` and `SameSite=Lax` |
| TEST-02 | AC-02 | API | Seeded Supervisor | Valid login | 200, Supervisor identity and cookie |
| TEST-03 | AC-03 | API | No session | Login with invalid credentials | Generic 401; no session row |
| TEST-04 | AC-04 | API | Valid, then revoked and expired sessions | `me`, logout, protected call; repeat for expiry | Identity while valid; 401 afterward |
| TEST-05 | AC-05 | API | No cookie | Call each protected route | 401; no private fields |
| TEST-06 | AC-06 | API | Student and Supervisor sessions | Student calls review and workload; Supervisor calls submit and supervisors | 403 each |
| TEST-07 | AC-07 | API | Two students, two supervisors, distinct proposals | Each lists and reads permitted records | Only own or assigned records |
| TEST-08 | AC-08 | API | Proposal owned by or assigned to others | Cross-user GET and review | 403 or 404; no proposal data |
| TEST-09 | AC-09 | API | Student session; valid supervisor | Submit at 5/100 and 20/2000 boundaries | 201; `SUBMITTED`, session student, timestamps |
| TEST-10 | AC-10 | Unit + API | Request schema | Below and above limits, missing and invalid IDs, bad assignee | Rejected; no insert |
| TEST-11 | AC-11 | API | Student has `SUBMITTED` proposal | Submit another | 409; unchanged |
| TEST-12 | AC-12 | API | Student has `APPROVED` proposal | Submit another | 409 |
| TEST-13 | AC-13 | API | Rejected-only history | Submit valid proposal | 201, new `SUBMITTED` |
| TEST-14 | AC-14 | API | Supervisor session | POST proposals | 403; no record |
| TEST-15 | AC-15 | API | Assigned Supervisor; submitted; capacity free | Approve without comment | 200; approved; `reviewedAt` set |
| TEST-16 | AC-16 | API | Assigned Supervisor; submitted | Reject with 10+ chars | 200; rejected; comment and time stored |
| TEST-17 | AC-17 | Unit + API | Assigned Supervisor; submitted | Reject with missing, blank, short comment | 400; unchanged |
| TEST-18 | AC-18 | API | Assigned Supervisor; submitted | Approve with comment | 200; comment stored |
| TEST-19 | AC-19 | API | Supervisor at capacity | Approve | 409 explicit capacity error; unchanged |
| TEST-20 | AC-20 | API | Other Supervisor | Review elsewhere-assigned proposal | 403 or 404; no data |
| TEST-21 | AC-21 | API | Decided proposal | Review again | 409; original decision kept |
| TEST-22 | AC-22 | API | Student session | POST review | 403; unchanged |
| TEST-23 | AC-09, AC-23 | API + E2E | Seeded Student, supervisor available | Log in, submit, reload, open detail | Persists as `SUBMITTED`; own history only |
| TEST-24 | AC-15, AC-17, AC-24 | API + E2E | Seeded assigned Supervisor; submitted proposal | Log in, load queue, reject without valid comment, then approve, reload | Invalid reject blocked; approval persists; workload shown |
| TEST-25 | AC-25 | API | Mixed users and assignments | Query scoped lists | Nothing outside the principal's scope |
| TEST-26 | AC-26 | API + E2E | Student session | Load supervisor picker | Safe names, non-negative remaining capacity |
| TEST-27 | AC-27 | E2E | Empty, loading, error, success conditions | Exercise each | Correct feedback on every data view |
| TEST-28 | AC-28 | API + E2E | Student and Supervisor sessions | Inspect role UI, call forbidden endpoint directly | Action hidden; API 403 |
| TEST-29 | AC-29 | DB integration | Empty test DB; seed env set | Run seed, inspect | 3 Students, 2 Supervisors, mixed states, capacity 5 |
| TEST-30 | AC-30 | DB integration | Seeded test DB | Run seed twice, inspect counts and logs | Stable counts; no passwords printed |
| TEST-31 | AC-31 | API | No cookie | Exercise all protected routes | 401; no private data |
| TEST-32 | AC-32 | DB integration | Seeded user | Inspect credential column | bcrypt hash only |
| TEST-33 | AC-33 | API | Trigger validation, conflict, unexpected error | Inspect JSON | No stack or SQL |
| TEST-34 | AC-34 | Unit or documented check | Final tokens | Compute contrast | Ratios at least 4.5:1 |
| TEST-35 | AC-35 | Manual | Local seeded env | Time auth, list, detail, submit, review | Method, conditions and latency recorded; typical under 500 ms |

Every AC-01 to AC-35 maps to at least one test above.

## TDD expectations

For BR-01 (TEST-11, TEST-12), BR-02 (TEST-19), BR-03 (TEST-17), BR-04 (TEST-21) and BR-06 write the test first, run it, keep the failing output that shows the intended reason, then implement and keep the passing output. Record both commits. Never weaken or skip a test to get a pass.

## Product Definition of Done

- F-01 to F-06 implemented to these contracts; BR-01 to BR-06 enforced on the backend.
- Every AC-01 to AC-35 verified by its mapped test; actual results, counts, commands and tested commit recorded.
- Real login, logout and `me`; two roles; a persisted submit and a persisted review through UI, API and database.
- Loading, empty, error and success states present; contrast and timing evidence recorded.
- Additive migration, idempotent seed, env-only secrets, health and ready endpoints work from a clean clone using the README.
- Each feature reviewed by the other developer through a PR into Sprint 1 staging; staging integrated, system and acceptance checks run, release PR merged to `main`, tag recorded.
- Failed, skipped and incomplete work disclosed; no real secrets in Git, logs, screenshots or the PDF.
- Completion is shown by evidence, not by an AI agent's statement.
