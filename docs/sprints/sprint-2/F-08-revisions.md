# F-08 Submission revisions

**Owner:** Jinnakan 1010 · **Reviewer:** Drarun 1016 · **Requirements:** FR-08, BR-01 (revised), BR-02, BR-04, BR-05, BR-07, BR-08 (new) · **Depends on:** F-04, F-05, F-07, Sprint 2 foundation task

## Behavior and workflow

A Student who is a member of the milestone's team opens a milestone that already has a submission and sends a new version: title, description and link. In one transaction the server checks that the milestone is visible to the student, locks the milestone row, reads the latest revision, checks that the milestone is open, that the deadline has not passed and that fewer than 5 versions exist, then inserts a new submission row with `revisionNo` = latest + 1. The milestone detail reloads and shows every version, oldest first. Earlier versions, their feedback and their grades are never changed.

Terms: the first submission (F-04) is `revisionNo` 1. The current revision is the one with the highest `revisionNo`. Any member of the team may revise, including a member who did not send the earlier versions. `submittedById` comes from the session.

Rules:
- BR-08 (new, SRS D-16): a team may revise a milestone's work while the milestone is open and `now <= dueAt`. At most 5 versions in total, the first submission included, so at most 4 revisions. Revision numbers are consecutive per milestone, with no gap and no duplicate.
- BR-01 (revised): the rule becomes "revision numbers are unique per milestone". The Sprint 1 unique index on `milestoneId` is replaced by a unique index on (`milestoneId`, `revisionNo`). The first submission still returns 409 `DUPLICATE_SUBMISSION` when a submission already exists (F-04); a second version goes through the revisions route.
- BR-08 limit, enforced in three places: the service (`assertRevisionAllowed`, `MAX_REVISIONS = 5`), a CHECK constraint `revisionNo BETWEEN 1 AND 5`, and the unique index. The database rejects `revisionNo` 6 even if the service is bypassed.
- BR-08 concurrency: the transaction takes a row lock on the milestone (`SELECT ... FOR UPDATE`) after the visibility check. Submit and revise use the same lock, so two members revising at the same time are serialized and both succeed, as 2 and 3. A 409 `REVISION_CONFLICT` is returned only if the unique index still raises a duplicate (a backstop that the lock is meant to make unreachable).
- BR-02: a revision is accepted when `now <= dueAt`, using the same injectable clock as F-04. `now` is read once at the start of the request.
- BR-04: the same field rules as F-04. Title trimmed, 5 to 100; description trimmed, 20 to 2000; link an absolute `http` or `https` URL of at most 500 characters, stored as text and never fetched. The schema is strict: `revisionNo`, `submittedById`, `milestoneId`, `submittedAt` and any other unknown field return 400.
- BR-05 (decision D-17): feedback attaches to one revision row, and only the current revision can receive it. Feedback on an older revision returns 409 `REVISION_SUPERSEDED`. Old feedback stays visible on its own revision. One immutable feedback per submission row is unchanged.
- BR-07: Supervisors cannot revise.

Order of checks (the same order Sprint 1 implemented in F-04): auth (401), role (403), body syntax and size (400, 413, 415), ID and field validation (400), milestone not yours or missing (uniform 404), then 409 in this order: `NO_SUBMISSION`, `MILESTONE_CLOSED`, `DEADLINE_PASSED`, `REVISION_LIMIT`. The SRS lists the uniform 404 before validation; the shipped routes validate first, and this feature keeps the shipped order so that all submission routes behave alike (recorded as a known difference between the SRS text and the code). A student of another team who sends a valid body gets the uniform 404 (TEST-51).

For feedback (F-05) the check order gains one step: not in scope or missing (404), `REVISION_SUPERSEDED` (409), then `FEEDBACK_EXISTS` (409). A superseded revision that already has feedback reports `REVISION_SUPERSEDED`. The feedback transaction takes the same milestone row lock as submit and revise, so a revision that lands at the same moment cannot leave feedback on a superseded row.

Status: after a revision the current revision has no feedback, so the milestone status is `SUBMITTED`. When the supervisor gives feedback on that revision it becomes `REVIEWED` again. A revision is only accepted when `now <= dueAt`, so a milestone with a submission is never `OVERDUE` because of a revision.

Failure cases: invalid fields or unknown field (400); no session (401); Supervisor (403); non-member or nonexistent milestone (uniform 404); no first submission, closed milestone, deadline passed, revision limit reached (409); simultaneous duplicate (409 `REVISION_CONFLICT`). Nothing is stored on failure. There is no route to edit or delete a revision.

## UI

Milestone detail, student view: below the saved submissions, a revise form (title, description, link, same fields and inline validation as the submit form) is shown when a submission exists, the milestone is open, the deadline has not passed and fewer than 5 versions exist. Otherwise the form is hidden. Every version is listed, oldest first, with its revision number, its feedback and its grade (F-10), so the first feedback is still readable after a revision. API errors are shown in plain sentences (409 codes map to one sentence each; 401 shows the session-ended message). Supervisor view: the same history, no revise form.

## API

`POST /api/milestones/:milestoneId/revisions` (team student)

Request: `{ "title": string, "description": string, "link": string }`

201 response: `{ "id", "milestoneId", "revisionNo", "title", "description", "link", "submittedBy": {"id","name"}, "submittedAt", "feedback": null, "grade": null }`

Errors: 400 `VALIDATION_ERROR`, 401 `UNAUTHENTICATED`, 403 `FORBIDDEN`, 404 `NOT_FOUND`, 409 `NO_SUBMISSION`, `MILESTONE_CLOSED`, `DEADLINE_PASSED`, `REVISION_LIMIT` or `REVISION_CONFLICT`, 413, 415, 429 `RATE_LIMITED`. The error body is `{ "error": { "code", "message" } }` for every error; messages are fixed text and never echo input.

`POST /api/submissions/:submissionId/feedback` (F-05) gains one error: 409 `REVISION_SUPERSEDED`. Its request and 201 response are unchanged.

`GET /api/milestones/:milestoneId` (F-07, additive, decision D-23):
- `submission` keeps its six Sprint 1 keys (`id`, `title`, `description`, `link`, `submittedAt`, `feedback`) and now holds the current revision, or `null` when none exists.
- `revisions` is new: an array in ascending `revisionNo` order, empty when there is no submission. Each item is `{ "revisionNo", "id", "title", "description", "link", "submittedAt", "feedback": {"id","comment","createdAt"} | null, "grade": {"score","createdAt","supervisor":{"id","name"}} | null }`.
- `closedAt` is new (added by the foundation task, set by F-09).

The detail read keeps the team scope: another team's milestone is the uniform 404 and its revisions are not loaded.

## Data

The Sprint 2 foundation migration adds what this feature needs:
- `Submission.revisionNo` INTEGER NOT NULL DEFAULT 1, so every existing row becomes revision 1.
- CHECK `Submission_revisionNo_range`: `revisionNo` between 1 and 5.
- The unique index on `milestoneId` is dropped. A unique index on (`milestoneId`, `revisionNo`) and a plain index on `milestoneId` are added.
- `Milestone.submission` (one) becomes `Milestone.submissions` (many) in the Prisma schema.
- `Milestone.closedAt` (nullable) and the `Grade` table, which this feature only reads. F-09 writes `closedAt`; F-10 writes `Grade`.

This feature inserts `Submission` rows only. It reads `Milestone.dueAt`, `Milestone.closedAt`, the latest `revisionNo`, and each revision's `Feedback` and `Grade`. Prisma does not model CHECK constraints, so the CHECK lives in the SQL migration only.

## Acceptance criteria

- **AC-44:** POST /api/milestones/:id/revisions by a team member returns 201 with revisionNo = previous + 1; earlier rows unchanged.
- **AC-45:** No first submission: 409 NO_SUBMISSION; no record.
- **AC-46:** After dueAt: 409 DEADLINE_PASSED; at exactly dueAt accepted (injectable clock).
- **AC-47:** Closed milestone: 409 MILESTONE_CLOSED.
- **AC-48:** At most 5 versions in total: when the latest revisionNo is 5, a revision returns 409 REVISION_LIMIT; the database also rejects revisionNo 6 (CHECK).
- **AC-49:** Two concurrent revisions both return 201 with numbers 2 and 3 (row lock serializes them). No gap, no duplicate.
- **AC-50:** Same field rules as BR-04; unknown fields (revisionNo, submittedById) return 400.
- **AC-51:** Unauthenticated 401; supervisor 403; non-member student uniform 404.
- **AC-52:** Milestone detail keeps the Sprint 1 submission key set (current revision) and adds revisions[] ascending with revisionNo, feedback, grade; another team gets 404.
- **AC-53:** After a new revision the status is SUBMITTED; earlier feedback stays visible on its revision.
- **AC-54:** Feedback on a non-current revision: 409 REVISION_SUPERSEDED.

## No change needed

- Authentication, session handling, cookies and the `me` route (F-01).
- The JSON-only rule, the 10 kb body cap, the foreign-`Origin` rejection, the rate limit and the security headers (F-02). The new route uses the same middleware chain as `POST /api/milestones/:milestoneId/submission`.
- The role guard and the uniform 404 rule for another team's data and nonexistent IDs (F-02, BR-06). Revisions use them as they are.
- Field validation (`submissionSchema`) and the deadline helper (`assertBeforeDeadline`, `isPastDue`, injectable clock). Both are reused unchanged.
- The first-submission route contract (F-04): same request, same 201 body, same errors. AC-21 to AC-26 keep passing, including the one-record result of two concurrent first submissions (AC-23).
- Feedback storage and rules (F-05, BR-05): one immutable feedback per submission row, `FEEDBACK_EXISTS`, no edit or delete route. Only the new `REVISION_SUPERSEDED` check is added.
- Milestone creation (F-03), the seed (row counts are unchanged), and the team list and team detail responses (F-07), apart from the foundation's `CLOSED` status and `progress.closed`.

## Tests

TEST-44 to TEST-54 map one to one to AC-44 to AC-54. TEST-55 is the E2E row: `e2e/f08-revisions.spec.ts` submits, reviews, revises, and checks that a reload shows both revisions and the first feedback. All are in the [STS](sts.md). TDD red and green evidence is required for the revision limit (AC-48), the deadline boundary (AC-46), concurrent revisions (AC-49) and `REVISION_SUPERSEDED` (AC-54): the failing run is saved before the code and the passing run after, under `docs/sprints/sprint-2/evidence/`.

## Version history

| Date | Change |
|---|---|
| 2026-11-25 | 1.0 Initial contract for Sprint 2: revisions with history, BR-08, revised BR-01, `REVISION_SUPERSEDED` on feedback, additive `revisions[]` and `closedAt` in the milestone detail (D-16, D-17, D-23). |
