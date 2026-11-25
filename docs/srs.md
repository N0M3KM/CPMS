# CPMS Software Requirements Specification (Part A)

**Version:** 3.0 (Sprint 2 requirements approved 2026-11-25; Sprint 3 requirements proposed, approval pending)
**Product:** Course Project Management System (CPMS), CPE 334, Theme 6
**Related:** [Features](features.md) · [Traceability](traceability.md) · [System SDS](system-sds.md) · [Sprint plan](sprints/plan.md) · [Security test plan](security-test-plan.md) · [Change register](sprints/sprint-2/change-register.md)

## Version history

| Version | Date | Change |
|---|---|---|
| 3.0 | 2026-11-25 | FR-08 to FR-10 approved for Sprint 2; FR-11 and FR-12 proposed for Sprint 3 (not yet approved). BR-01 revised (revision numbers unique per milestone, at most 5 versions). Added BR-08 to BR-11, decisions D-16 to D-23, and the terms Revision, Grade and Closed. Milestone status gains CLOSED. Sprint 2 approvals: D-16, D-17, D-23 and FR-08 (Drarun, PR #59 review), D-18, D-19 and FR-09 (PR #60 review), D-20 and FR-10 (PR #61 review), all 2026-11-25. D-21, D-22, FR-11 and FR-12 (Sprint 3) are still proposed. Instructor or TA confirmation was not received for any decision. No Sprint 1 requirement text removed. |
| 2.1 | 2026-11-07 | Status updated after Sprint 1 implementation; no requirement, rule or acceptance-criteria change. |
| 2.0 | 2026-11-06 | Reworked from a proposal approve/reject product to the Theme 6 domain in `group_work_specs_v1.pdf`: teams, milestones, submissions, feedback, progress. Requirement, rule, AC and test IDs renumbered. Closes D-07. |
| 1.1 | 2026-11-06 | Approved NFR-07 to NFR-12. |
| 1.0 | 2026-11-06 | Initial split SRS (proposal domain, superseded). |

## 1. Stakeholder problem and context

A course project program has teams working toward milestones. Supervisors set milestones and need to see which teams have submitted, which are late, and what feedback was given. Students need one place to see their team's milestones, submit work, and read feedback. Today this is spread across chat, email and spreadsheets, so deadlines are missed, submissions are lost and feedback is hard to find.

CPMS gives each team a private workspace: supervisors define milestones for their teams, team members submit a title, description and link, and supervisors record feedback tied to that submission.

Context chosen: a single course with seeded teams, students and supervisors. The theme is assigned from the student IDs (`...016` and `...010`); the team chose Theme 6.

## 2. Actors and responsibilities

| Actor | Responsibility | Data boundary |
|---|---|---|
| Anonymous visitor | Log in with a seeded account. | None. |
| Student | View own team, its milestones, submissions and feedback; submit work for a team milestone. | Only teams where they are a member. |
| Supervisor | Create milestones for supervised teams; view their submissions and progress; record feedback. | Only teams assigned to them. |

No admin role in any sprint unless a later decision adds one. Teams and membership are seeded in Sprint 1.

### Terminology

- **Team:** a group of students with exactly one supervisor.
- **Milestone:** a deliverable with a due date, created for one team.
- **Submission:** a team member's work for one milestone (title, description, link).
- **Feedback:** a supervisor's comment attached to one submission.
- **Revision:** a numbered version of a team's work on one milestone. The first submission is revision 1; the current revision is the highest number; at most 5 versions exist per milestone (BR-08).
- **Closed milestone:** a milestone a supervisor has closed; it accepts no edits, first submissions or revisions (BR-09).
- **Grade:** an integer 0 to 100 a supervisor records on one revision after feedback on that revision (BR-10).
- **Milestone status (computed):** `NOT_SUBMITTED`, `SUBMITTED`, `REVIEWED` (the current revision has feedback), `CLOSED` (closed with no submission), or `OVERDUE` (due date passed with no submission). Precedence: REVIEWED, SUBMITTED, CLOSED, OVERDUE, NOT_SUBMITTED.

## 3. Scope

**In scope (whole product):** authentication and access (Sprint 1); milestone creation, submission, feedback, scoped views and progress (Sprint 1); revisions with history, milestone management, grades (Sprint 2); progress board, summary reports, search and filter (Sprint 3; search and filter implemented first, progress board contracted).

**Excluded:** self-registration, password recovery, email verification, multiple roles per account, file upload (links only), notifications, real external integrations. Docker, CI/CD and GCP deployment are designed for now and delivered in Lab 5.

## 4. Functional requirements

| ID | Requirement | Feature | Sprint | Status |
|---|---|---|---:|---|
| FR-01 | A seeded user logs in with email and password, logs out, retrieves current-user identity, and uses an expiring session. | F-01 | 1 | Baseline |
| FR-02 | Every protected operation enforces role and team ownership from the server session only. | F-02 | 1 | Baseline |
| FR-03 | A Supervisor creates a milestone (title, description, due date) for a team they supervise. | F-03 | 1 | Baseline |
| FR-04 | A Student team member submits a title, description and link for a milestone of their team. | F-04 | 1 | Baseline |
| FR-05 | A Supervisor records feedback on a submission of a team they supervise. | F-05 | 1 | Baseline |
| FR-06 | A repeatable idempotent seed provides teams, membership, users, milestones, submissions and feedback. | F-06 | 1 | Baseline |
| FR-07 | Students view their team, milestones, submissions, feedback and progress. Supervisors view assigned teams and per-milestone progress. | F-07 | 1 | Baseline |
| FR-08 | A team may resubmit a milestone under a revision policy, with preserved revision history. | F-08 | 2 | Approved 2026-11-25 (Drarun, approving review on PR #59) |
| FR-09 | A Supervisor edits or closes a milestone and manages team deadlines. | F-09 | 2 | Approved 2026-11-25 (Drarun, approving review on PR #60) |
| FR-10 | A Supervisor assigns a grade with feedback; visibility of grades is defined by rule. | F-10 | 2 | Approved 2026-11-25 (Drarun, approving review on PR #61) |
| FR-11 | A progress board and summary reports show team and milestone status. | F-11 | 3 | Proposed, approval pending (contract only) |
| FR-12 | Users search and filter only records they are entitled to see. | F-12 | 3 | Proposed, approval pending |

FR-08 to FR-12 now have contracts: [F-08](sprints/sprint-2/F-08-revisions.md), [F-09](sprints/sprint-2/F-09-milestone-management.md), [F-10](sprints/sprint-2/F-10-grades.md), [F-11](sprints/sprint-3/F-11-progress-board.md), [F-12](sprints/sprint-3/F-12-search-filter.md). FR-08 to FR-10 are approved (2026-11-25; sources in the status column). FR-11 and FR-12 are proposed: they are approved only when Drarun approves them in a review and the approval is recorded here with its date.

## 5. Business rules

| ID | Applies when | Required enforcement | Outcome when violated |
|---|---|---|---|
| BR-01 One first submission per milestone; unique revision numbers (revised in 3.0) | A team member submits to a milestone. | Unique constraint on (`Submission.milestoneId`, `revisionNo`) plus a transaction. The first submission is revision 1, so a second first-submission still fails. Further versions go through BR-08. | 409 `DUPLICATE_SUBMISSION`; no new record. |
| BR-02 Deadline | A submission is created. | Accept at or before `dueAt`; compare against an injectable server clock. | 409 `DEADLINE_PASSED`; no record. |
| BR-03 Milestone creation | A Supervisor creates a milestone. | Only the team's supervisor; title 5 to 100 chars; description 0 to 1000; `dueAt` must be a valid date in the future at creation. | 400 for bad fields; unassigned team returns the uniform 404; no record. |
| BR-04 Submission authorization and data | Any submission. | Only a Student who is a member of the milestone's team. `submittedById` comes from the session. Title 5 to 100; description 20 to 2000; link is `http` or `https`, at most 500 chars, stored as text and never fetched. | 400 invalid data (including `javascript:`, `data:`, `ftp:` links); non-member gets the uniform 404; no record. |
| BR-05 Feedback | A Supervisor records feedback. | Only the team's supervisor, on an existing submission; comment trimmed has 10 to 2000 chars; one feedback per submission; feedback is immutable and linked by foreign key. | 400 invalid comment; 409 `FEEDBACK_EXISTS`; unassigned supervisor gets the uniform 404. |
| BR-06 Private team data | Every read. | Students read only data of teams they belong to; Supervisors only data of teams they supervise. Scope is applied in the query. | Uniform 404 for another team's data and for nonexistent IDs; lists omit out-of-scope records. |
| BR-07 Role separation | Milestone, submission and feedback routes. | Students submit but cannot create milestones or feedback. Supervisors create milestones and feedback but cannot submit. | 403 with a safe error; no change. |
| BR-08 Revisions (3.0) | A team member resubmits a milestone that already has a submission. | Milestone open (BR-09), `now <= dueAt`, at most 5 versions in total (the first submission counts), same field rules as BR-04, session student recorded. The milestone row is locked so two concurrent revisions get numbers 2 and 3. Earlier revisions and their feedback and grades are never changed. Feedback and grades are accepted only on the current revision. | 409 `NO_SUBMISSION`, `MILESTONE_CLOSED`, `DEADLINE_PASSED`, `REVISION_LIMIT` (in that order); 409 `REVISION_SUPERSEDED` for feedback or a grade on an older revision; no change. |
| BR-09 Milestone lifecycle (3.0) | A supervisor edits or closes a milestone of a team they supervise. | Edit title (5 to 100), description (0 to 1000) and `dueAt` (must be in the future, earlier or later) only while open. Close sets `closedAt` once and is not reversible in Sprint 2. A closed milestone accepts no edits, first submissions or revisions; reads, feedback and grades stay allowed. | 409 `MILESTONE_CLOSED`, 409 `ALREADY_CLOSED`, 400 for a past `dueAt`; other team's milestone returns the uniform 404. |
| BR-10 Grades (3.0) | A supervisor grades a revision. | Team's supervisor only; integer 0 to 100; feedback must already exist on that revision; the revision must be the current one; one grade per revision; immutable. Visible only to the team's members and supervisor. | 400 invalid score; 409 `FEEDBACK_REQUIRED`, `REVISION_SUPERSEDED`, `GRADE_EXISTS`; other team gets the uniform 404. |
| BR-11 Scoped search (3.0) | A user searches or filters milestones. | The team scope is part of every query, including counts and pagination. At most 1000 in-scope milestones are scanned. `teamId` outside scope returns the uniform 404. | 400 for bad parameters; uniform 404 for an out-of-scope `teamId`; no cross-team data or counts. |

**Precedence:** authentication (401), role (403), team ownership (uniform 404), validation (400), rule conflict (409).

## 6. Non-functional requirements

| ID | Requirement and measurable target | Verification | Sprint |
|---|---|---|---:|
| NFR-01 | Protected endpoints reject unauthenticated requests with 401 and return no private data. | API test | 1 |
| NFR-02 | Passwords are stored only as bcrypt hashes; plaintext appears nowhere in persistence. | DB integration test | 1 |
| NFR-03 | Error responses never contain stack traces or SQL. | API test across validation, conflict and unexpected-error paths | 1 |
| NFR-04 | Body and button text contrast is at least 4.5:1 (WCAG AA). | Recorded contrast calculation | 1 |
| NFR-05 | Typical API responses take under 500 ms on local seeded data. | Manual timing record | 1 |
| NFR-06 | The app builds and runs from environment variables alone, with no secrets in Git or client code. | Clean-clone setup run | 1, Lab 5 |
| NFR-07 | Hostile input cannot cause script, SQL, command, file-path or server-side request effects. | Security tests | 1 |
| NFR-08 | State-changing requests from a foreign `Origin` or with a non-JSON body are rejected. | Security tests | 1 |
| NFR-09 | Login does not reveal registered emails, ignores unanticipated fields and redirect inputs, issues a fresh session ID, and rejects tampered cookies. | Security tests | 1 |
| NFR-10 | Repeated failed logins and request bursts are throttled with 429 (placeholders: 5 failures per 15 min per IP and email; 100 requests per minute per IP). | Security tests | 1 |
| NFR-11 | Request schemas reject unknown fields; responses contain only whitelisted fields. | Security tests | 1 |
| NFR-12 | Security headers, strict CORS, body size cap, and no high or critical dependency vulnerabilities. | Security tests | 1 |

NFR-07 to NFR-12 were approved for Sprint 1 on 2026-11-06 and carry over unchanged. Details are in the [security test plan](security-test-plan.md).

## 7. Assumptions, decisions and open questions

The spec says to resolve theme ambiguities and record decisions. Items marked Proposed are the team's answers and need confirmation with the instructor or TA where noted.

| ID | Decision or assumption | Status |
|---|---|---|
| D-01 | Student and Supervisor are the only roles. | Decided (spec 5.2, Theme 6) |
| D-02 | Accounts, teams and memberships are seeded; no registration or recovery. | Decided (spec 5.2) |
| D-03 | Authentication uses database-backed expiring sessions in a secure cookie. | Decided |
| D-04 | Another team's data and a nonexistent ID return the same 404 body. Wrong role returns 403. | Decided 2026-11-06 |
| D-05 | Each student belongs to exactly one team; each team has exactly one supervisor; a supervisor may supervise several teams. | Proposed |
| D-06 | A milestone belongs to one team and is created per team. | Proposed |
| D-07 | Deadline policy: submissions at or before `dueAt` are accepted; later ones are rejected with 409. | Proposed |
| D-08 | Revision policy for Sprint 1: one submission per milestone, no edit or resubmit. Revisions with history move to Sprint 2 (F-08). | Proposed; superseded for Sprint 2 by D-16 |
| D-09 | Supervision scope: a supervisor sees and acts only on teams assigned to them. | Decided (spec Theme 6) |
| D-10 | Feedback visibility: the team's members and the team's supervisor only. No other team and no grades in Sprint 1. | Proposed |
| D-11 | A submission is by the team, recorded with the member who sent it; any member may submit. | Proposed |
| D-12 | Submission uses a link only; no file upload. | Proposed |
| D-13 | Email is unique and compared case-insensitively. | Proposed |
| D-14 | Password change is out of scope. | Decided |
| D-15 | `group_work_specs_v1.pdf` was reviewed; the earlier proposal-approval slice is removed. | Decided 2026-11-06 |
| D-16 | Revision policy: any team member may resubmit while the milestone is open and `now <= dueAt`; at most 5 versions in total (first submission is revision 1, so 4 resubmissions); current revision is the highest number. | Approved 2026-11-25 (Drarun, approving review on PR #59) |
| D-17 | Feedback attaches to one revision and only the current revision can receive it (409 `REVISION_SUPERSEDED`); older feedback stays visible. | Approved 2026-11-25 (Drarun, approving review on PR #59) |
| D-18 | Milestone lifecycle: supervisor edits title, description and due date while open and may close at any time; closed blocks edits, first submissions and revisions; reads, feedback and grades stay allowed; closing is not reversible in Sprint 2. | Approved 2026-11-25 (Drarun, approving review on PR #60) |
| D-19 | Deadline change: new `dueAt` must be in the future, earlier or later; status is recomputed, so extending an overdue milestone with no submission opens it again. | Approved 2026-11-25 (Drarun, approving review on PR #60) |
| D-20 | Grade: integer 0 to 100 in a separate `Grade` table, one per revision, only after feedback on that revision and only on the current revision, immutable, visible to the team and supervisor only. "Grade with feedback" (FR-10) means recorded after, and tied to, that revision's feedback. | Approved 2026-11-25 (Drarun, approving review on PR #61) |
| D-21 | Search (F-12): milestones only; `q` (title, max 100), `status`, `teamId`, `page`, `limit` (default 20, max 50); scope before filters and counts; at most 1000 in-scope milestones scanned. | Proposed; approval pending (Drarun, instructor or TA) |
| D-22 | Sprint 3 rule implemented for Deliverable 2: F-12. F-11 has a contract only. | Proposed; approval pending (Drarun, instructor or TA) |
| D-23 | API shape: `submission` in the milestone detail keeps its Sprint 1 key set; new data goes in `revisions[]` and `closedAt`; team `progress` gains `closed`. Proposed baseline change; one Sprint 1 assertion edited on purpose. | Approved 2026-11-25 (Drarun, approving review on PR #59) |
