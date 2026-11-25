# CPMS Sprint 2 Software Test Specification and Definition of Done

**Version:** 1.0


**Approval status:** proposed on 2026-11-25, not yet approved. Needs Drarun's approval on PR #50 and confirmation from the instructor or TA. No implementation starts before that is recorded here.
**Related:** [Sprint 2 plan](plan.md) · [Change register](change-register.md) · [Traceability](../../traceability.md) · [Sprint 1 STS](../sprint-1/sts.md) · contracts [F-08](F-08-revisions.md), [F-09](F-09-milestone-management.md), [F-10](F-10-grades.md)

## Version history

| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-11-25 | Initial Sprint 2 test specification for AC-44 to AC-72, AC-87 to AC-89 and the cross-feature checks TEST-91 to TEST-95. |

## Software Test Specification

Test IDs are stable. `TEST-nn` verifies `AC-nn` one to one for AC-44 to AC-72 and AC-87 to AC-89. TEST-55, TEST-64 and TEST-90 are end-to-end browser journeys. TEST-91 to TEST-95 are cross-feature checks with no single AC. Every row starts as **planned**; actual results, counts, commands and the tested commit are recorded in the Deliverable 2 evidence and the traceability matrix, not here. Levels: unit, API and DB integration (Vitest and Supertest on the separate test database), E2E (Playwright).

Seed users (as in the [Sprint 1 STS](../sprint-1/sts.md)): Student A1, A2 (Team A), B1 (Team B), C1 (Team C); Supervisor S1 (Teams A and B), S2 (Team C). Working milestone: "Prototype demo" (Team A, open, no submission in the seed). Error bodies are `{ "error": { "code", "message" } }`.

### F-08 Revisions

| Test | AC | Level | Precondition / input | Action | Expected result |
|---|---|---|---|---|---|
| TEST-44 | AC-44 | API + DB | A1 submitted version 1 | A1 posts a valid revision | 201, `revisionNo` 2; version 1 row unchanged |
| TEST-45 | AC-45 | API + DB | No submission yet | A1 posts a revision | 409 `NO_SUBMISSION`; no row |
| TEST-46 | AC-46 | unit + API | Version 1 exists; clock set before, at and after `dueAt` | Post a revision each time | Before and at: 201. After: 409 `DEADLINE_PASSED`; no row |
| TEST-47 | AC-47 | API + DB | Version 1 exists; milestone closed | A1 posts a revision | 409 `MILESTONE_CLOSED`; no row |
| TEST-48 | AC-48 | unit + API + DB | Latest `revisionNo` 4, then 5 | Post a revision; insert `revisionNo` 6 directly | From 4: 201 (becomes 5). From 5: 409 `REVISION_LIMIT`. Direct insert of 6 is rejected by the database |
| TEST-49 | AC-49 | DB integration | Version 1 exists; A1 and A2 logged in | Both post a revision at once | Both 201; numbers 2 and 3; no gap, no duplicate |
| TEST-50 | AC-50 | API | Version 1 exists | Short title, short description, `javascript:` link, extra field `revisionNo`, extra field `submittedById` | 400 each; no row |
| TEST-51 | AC-51 | API | Version 1 exists | No session; S1; B1 | 401; 403; uniform 404 |
| TEST-52 | AC-52 | API | Versions 1 and 2 exist | A1 reads the milestone; B1 reads it | `submission` has exactly the six Sprint 1 keys and is version 2; `revisions` has two items ascending, each with `revisionNo`, `feedback`, `grade`. B1 gets 404 |
| TEST-53 | AC-53 | unit + API | Version 1 has feedback | A1 posts version 2 | Status `SUBMITTED`; version 1 feedback still returned on version 1 |
| TEST-54 | AC-54 | API + DB | Versions 1 and 2 exist | S1 posts feedback on version 1 | 409 `REVISION_SUPERSEDED`; no feedback row |
| TEST-54c | AC-54 | E2E | Supervisor has a feedback draft open on version 1; the student sends version 2 | Supervisor saves | A message about the newer version (not "already has feedback"); the draft text is kept; the page shows version 2; saving again stores feedback on version 2 |
| TEST-55 | AC-44, AC-52, AC-54 | E2E | Seeded, clean database | A1 submits; S1 gives feedback; A1 revises; reload | Both revisions listed; first feedback shown; status Submitted |

### F-09 Milestone management

| Test | AC | Level | Precondition / input | Action | Expected result |
|---|---|---|---|---|---|
| TEST-56 | AC-56 | API + DB | Open milestone | S1 patches title and description; reload | 200; values persisted and returned after reload |
| TEST-57 | AC-57 | unit + API | Open milestone; clock fixed | S1 patches `dueAt` to the past, then to a later and an earlier future time | Past: 400. Future (either direction): 200 and status recomputed |
| TEST-58 | AC-58 | API | Open milestone | A1 patches; S2 patches; no session; S1 patches with an unknown field | 403; uniform 404; 401; 400 |
| TEST-59 | AC-59 | API + DB | Open milestone | S1 closes; S1 closes again | First: 200, returned `closedAt` equals the stored value. Second: 409 `ALREADY_CLOSED` |
| TEST-60 | AC-60 | API + DB | Closed milestone | S1 patches; A1 submits the first version | Both 409 `MILESTONE_CLOSED`. Order of checks: 404, closed, duplicate, deadline |
| TEST-61 | AC-61 | API | Closed milestone with a submission, feedback and a grade | A1 and S1 read it | 200; submission, feedback, grade and revisions all returned |
| TEST-62 | AC-62 | unit | Status inputs | Closed without submission; closed with submission; closed with feedback | `CLOSED`; `SUBMITTED`; `REVIEWED` |
| TEST-63 | AC-63 | API + DB | Overdue milestone, no submission | S1 patches `dueAt` to the future; A1 submits | Status `NOT_SUBMITTED`; submission 201 |
| TEST-64 | AC-56, AC-59, AC-60, AC-63 | E2E | Seeded, clean database | S1 extends a deadline; A1 submits; S1 closes; A1 reloads | Closed shown; no submit form |
| TEST-88 | AC-88 | API + DB | Closed milestone with a submission | S1 posts feedback, then a grade | Both 201 |
| TEST-89 | AC-89 | DB integration | Open milestone; S1 and A1 logged in | (a) A separate transaction locks the milestone row and sets `closedAt`; A1 submits and waits; the transaction commits. (b) Close and first submission started together, 10 times | (a) The submission gets 409 `MILESTONE_CLOSED`; no row. (b) Each run ends as submission 201 then close 200, or close 200 then submission 409 with no row |

### F-10 Grades

| Test | AC | Level | Precondition / input | Action | Expected result |
|---|---|---|---|---|---|
| TEST-65 | AC-65 | API + DB | Current revision has feedback | S1 posts `{ "score": 90 }` | 201; row linked to the revision with S1 as supervisor |
| TEST-66 | AC-66 | API + DB | Current revision, no feedback | S1 posts a grade | 409 `FEEDBACK_REQUIRED`; no row |
| TEST-67 | AC-67 | DB integration | Current revision has feedback | S1 posts a grade twice; then two at once | Second: 409 `GRADE_EXISTS`, first value kept. Concurrent: one 201, one 409; one row |
| TEST-68 | AC-68 | unit + API | Current revision has feedback | Score 101, -1, 85.5, "90", null, 0, 100; extra field | First five and extra field: 400. 0 and 100: 201 (on separate revisions) |
| TEST-69 | AC-69 | API | Graded revision | A1 reads the milestone; B1 reads it; list as B1 | A1 sees the grade in `revisions`. B1 gets 404 and no grade appears in B1's lists |
| TEST-70 | AC-70 | API | Current revision has feedback | A1 posts a grade; S2 posts a grade; no session | 403; uniform 404; 401 |
| TEST-71 | AC-71 | API + DB | Version 1 graded; version 2 posted later | Read the milestone | Version 1 keeps its grade; version 2 has `grade: null` |
| TEST-72 | AC-72 | API | Graded revision | Read the grade object | Keys are exactly `score`, `createdAt`, `supervisor` (`id`, `name`) |
| TEST-87 | AC-87 | API + DB | Versions 1 (with feedback) and 2 exist | S1 posts a grade on version 1 | 409 `REVISION_SUPERSEDED`; no row |
| TEST-90 | AC-65, AC-69 | E2E | Seeded, clean database | S1 gives feedback and a grade; A1 reloads; B1 opens the milestone URL | A1 sees both. B1 sees no grade and no data |

### Cross-feature checks (Part E)

| Test | Level | Precondition / input | Action | Expected result |
|---|---|---|---|---|
| TEST-91 | API + DB | Open milestone | Submit; feedback on version 1; revise | Status `SUBMITTED`, `REVIEWED`, `SUBMITTED` in that order |
| TEST-92 | API + DB | Open milestone with a due date | Extend the deadline then submit; try to set a past deadline | Submission 201; past deadline 400 |
| TEST-93 | API + DB | Closed milestone with a submission | Revise; then feedback and grade | Revise: 409 `MILESTONE_CLOSED`. Feedback and grade: 201 |
| TEST-94 | API + DB | One closed milestone with no submission in Team A | A1 lists teams | Team A `progress.closed` is 1 and the other four counts exclude it; Team B counts unchanged |
| TEST-95 | API | B1 and S2 logged in | Call `/revisions`, `/close`, `/grade` and `/search?teamId=` for Team A resources | Uniform 404 each; no data returned |

## TDD expectations

For the revision limit and concurrency (TEST-48, TEST-49), the close rules (TEST-59, TEST-60, TEST-89), the grade rules (TEST-66, TEST-67, TEST-87) and the supersede rule (TEST-54), write the test first, run it, keep the failing output showing the intended reason, then implement and keep the passing output. Record both commits. Never weaken or skip a test to get a pass. No Sprint 1 expected value changes; the relation lookups updated for the new schema are listed in the [change register](change-register.md) (BASE-03).

## Sprint 2 Definition of Done

- F-08, F-09 and F-10 implemented to these contracts; BR-08, BR-09 and BR-10 enforced on the backend; BR-01 as revised.
- Every AC in the table above verified by its mapped test; actual results, counts, commands and the tested commit recorded.
- Revisions, close and grade persisted through UI, API and database; the three Sprint 2 journeys and the two Sprint 1 journeys pass.
- Earlier behavior still works: all Sprint 1 tests pass with no expected value changed (only relation lookups in two test files were updated for the new schema), authentication, role checks and team ownership unchanged.
- Additive migration apart from the recorded unique-index swap (RISK-01); idempotent seed unchanged; env-only secrets.
- Each feature reviewed by the other developer through a PR into `sprint-2-staging`; staging integrated, system checks run, release PR merged to `main`, tag `sprint-2-release` recorded and kept even after later changes.
- Failed, skipped and incomplete work disclosed; no real secrets in Git, logs, screenshots or the PDF.
- Completion is shown by evidence, not by an AI agent's statement.
