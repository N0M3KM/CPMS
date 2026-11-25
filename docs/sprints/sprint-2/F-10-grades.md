# F-10 Grades

**Owner:** Jinnakan 1010 · **Reviewer:** Drarun 1016 · **Requirements:** FR-10, BR-10 (new), BR-05, BR-06, BR-07 · **Depends on:** F-05, F-08


**Approval status:** proposed on 2026-11-25, not yet approved. Needs Drarun's approval on PR #50 and confirmation from the instructor or TA. No implementation starts before that is recorded here.

## Behavior and workflow

A Supervisor opens the current revision of a submission of a team they supervise, after they have recorded feedback on it, and enters a whole-number score from 0 to 100. In one transaction the server reads the submission with its feedback inside the supervisor's team scope, compares its revision with the newest revision of the milestone, checks that feedback exists on that same row, and inserts the grade. The team's members and the supervisor then see the grade beside that revision's feedback.

FR-10 says a supervisor assigns a grade with feedback. This contract reads that as: the grade is recorded after, and tied to, the feedback on the same revision (SRS D-20). The grade is not a field on the feedback.

Rules:
- BR-10 (new, SRS D-20): the grade is an integer from 0 to 100, stored in a separate `Grade` table, one per submission row. It is recorded by the team's supervisor only, only after feedback exists on that same submission row, and only on the current revision. It is immutable.
- BR-10, enforced in two places: the service validates the score, and the database holds a CHECK `score BETWEEN 0 AND 100` and a unique index on `submissionId`.
- BR-05: feedback stays immutable and unchanged. A separate table is used so that no column is added to `Feedback`. The grade is linked to its submission by foreign key, so the association between a revision, its feedback and its grade is preserved.
- BR-06 and visibility: the grade is visible to the team's members and the team's supervisor only. It is read through the milestone detail, which already applies the team scope, so another team gets the uniform 404 and no grade appears in anything it can list.
- BR-07: Students cannot grade. A student attempt returns 403.
- A closed milestone does not block grading (SRS D-18). There is no `closedAt` check in this feature.
- Revisions interact with grades as follows: when a team sends a new revision, the earlier revision keeps its grade and the new revision has none until it is graded. An earlier revision can no longer be graded (409 `REVISION_SUPERSEDED`, the same rule as feedback).
- Grades do not change the milestone status. The status is still computed from the current revision's feedback.

Order of checks (the same order Sprint 1 implemented in F-05): auth (401), role (403), body syntax and size (400, 413, 415), ID and score validation (400), scope lookup of the submission (uniform 404 when it is missing or the team is not supervised by the caller), then 409 in this order: `REVISION_SUPERSEDED`, `FEEDBACK_REQUIRED`, `GRADE_EXISTS`. The SRS lists the uniform 404 before validation; the shipped routes validate first and this feature keeps that order. The grade transaction takes the milestone row lock used by submit, revise and feedback, so a revision landing at the same moment cannot leave a grade on a superseded row.

Two consequences of that order: a superseded revision that already has a grade reports `REVISION_SUPERSEDED`, not `GRADE_EXISTS`; a superseded revision without feedback also reports `REVISION_SUPERSEDED`. `GRADE_EXISTS` is raised when the unique index on `submissionId` rejects the insert, so two simultaneous grades on the same revision produce one 201 and one 409, and the first stored value is kept.

Score validation: a JSON number that is an integer from 0 to 100 inclusive. `101`, `-1`, `85.5`, the string `"90"`, `null`, a missing score and any unknown field (for example `supervisorId`) return 400. The supervisor comes from the session and the revision comes from the path, never from the body.

Failure cases: invalid score or unknown field (400); no session (401); Student (403); submission outside the supervisor's scope or nonexistent (uniform 404); revision superseded, feedback missing or grade already recorded (409). Nothing is stored on failure. There is no route to edit or delete a grade.

## UI

Submission detail, supervisor view: a grade form (number input, 0 to 100, with the same error mapping as the feedback form) is shown only on the current revision, when it has feedback and no grade. After success the form is replaced by the saved score. Older revisions show their saved grade, or nothing, and never a form. Student view: each revision shows its grade read-only beside its feedback once one is recorded, and shows no grade before that. The grade form is not rendered for Students, and a direct API call is still denied.

## API

`POST /api/submissions/:submissionId/grade` (team supervisor)

Request: `{ "score": integer }`

201 response: `{ "score", "createdAt", "supervisor": {"id","name"} }`. The response has these three keys only. The revision is identified by the path.

Errors: 400 `VALIDATION_ERROR`, 401 `UNAUTHENTICATED`, 403 `FORBIDDEN`, 404 `NOT_FOUND`, 409 `REVISION_SUPERSEDED`, `FEEDBACK_REQUIRED` or `GRADE_EXISTS`, 413, 415, 429 `RATE_LIMITED`. The error body is `{ "error": { "code", "message" } }` for every error; messages are fixed text and never echo input.

A grade is read through `GET /api/milestones/:milestoneId` (F-07, F-08): each item of `revisions[]` carries `grade`, which is `{ "score", "createdAt", "supervisor": {"id","name"} }` or `null`. The `submission` key keeps its six Sprint 1 keys and has no grade. Grades are not part of the team list, the team detail or any other list response.

## Data

The Sprint 2 foundation migration creates the `Grade` table: `id` (UUID), `submissionId` (unique, foreign key to `Submission`, delete cascades), `supervisorId` (foreign key to `User`, delete restricted), `score` INTEGER NOT NULL, `createdAt` (default now), and CHECK `Grade_score_range` (`score` between 0 and 100). Prisma does not model CHECK constraints, so it lives in the SQL migration only.

This feature inserts `Grade` rows only. It reads `Submission.revisionNo`, the newest `revisionNo` of the same milestone (added by the foundation migration and written by F-08), the submission's `Feedback`, and the team's `supervisorId` for the scope check. The architecture note proposed a nullable grade column on `Feedback`; that is replaced by the `Grade` table so that feedback remains immutable.

## Acceptance criteria

- **AC-65:** POST /api/submissions/:id/grade {score} by the team's supervisor: 201; supervisor from session, revision from path.
- **AC-66:** No feedback on that revision: 409 FEEDBACK_REQUIRED.
- **AC-67:** Second grade on the same revision: 409 GRADE_EXISTS, first value unchanged; concurrent grades give one 201.
- **AC-68:** Score must be an integer 0 to 100; 101, -1, 85.5, "90", null and unknown fields return 400.
- **AC-69:** Team members and supervisor see the grade in revisions[]; other teams get 404 and the grade is absent from their lists.
- **AC-70:** Student 403; other team's supervisor uniform 404; unauthenticated 401.
- **AC-71:** After a new revision the earlier revision keeps its grade; the new revision has none until graded.
- **AC-72:** Grade DTO has only score, createdAt, supervisor {id,name}.
- **AC-87:** Grading a non-current revision: 409 REVISION_SUPERSEDED (same rule as feedback).

## No change needed

- Authentication, session handling, cookies and the `me` route (F-01).
- The JSON-only rule, the 10 kb body cap, the foreign-`Origin` rejection, the rate limit and the security headers (F-02). The new route uses the same middleware chain as `POST /api/submissions/:submissionId/feedback`, with the Supervisor role guard.
- The role guard and the uniform 404 rule (F-02, BR-06). Grading reuses them.
- Feedback (F-05): the table, the one-per-submission rule, `FEEDBACK_EXISTS`, immutability and the absence of edit and delete routes. No column is added to `Feedback`.
- Submissions and revisions (F-04, F-08): grading never writes to `Submission`, and revision numbering, limits and deadline rules are untouched.
- Milestone status and progress counts: grades play no part in `REVIEWED` or in the team progress counts.
- Milestone management (F-09): a closed milestone still accepts grades, so no closed check is added here.
- The seed (row counts are unchanged), the team list and the team detail responses (F-07).

## Tests

TEST-65 to TEST-72 and TEST-87 map one to one to AC-65 to AC-72 and AC-87. TEST-90 is the E2E row: `e2e/f10-grades.spec.ts`, where the supervisor records feedback and a grade, the team's student sees both after a reload, and a student of another team sees nothing. All are in the [STS](sts.md). TDD red and green evidence is required for the score rule (AC-68), the feedback-first rule (AC-66), the one-grade-per-revision rule with concurrency (AC-67), the current-revision rule (AC-87) and the visibility rule (AC-69): the failing run is saved before the code and the passing run after, under `docs/sprints/sprint-2/evidence/`.

## Version history

| Date | Change |
|---|---|
| 2026-11-25 | 1.0 Initial contract for Sprint 2: integer grade 0 to 100 in an immutable `Grade` table, one per submission row, BR-10, visibility to the team and supervisor only (D-20). |
