# CPMS Software Requirements Specification (Part A)

**Version:** 2.0 (draft for review)
**Product:** Course Project Management System (CPMS), CPE 334, Theme 6
**Related:** [Features](features.md) · [Traceability](traceability.md) · [System SDS](system-sds.md) · [Sprint plan](sprints/plan.md) · [Security test plan](security-test-plan.md)

## Version history

| Version | Date | Change |
|---|---|---|
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
- **Milestone status (computed):** `NOT_SUBMITTED`, `SUBMITTED`, `REVIEWED` (has feedback), or `OVERDUE` (due date passed with no submission).

## 3. Scope

**In scope (whole product):** authentication and access (Sprint 1); milestone creation, submission, feedback, scoped views and progress (Sprint 1); revisions with history, milestone management, grades (Sprint 2, proposed); progress board, summary reports, search and filter (Sprint 3, proposed).

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
| FR-08 | A team may resubmit a milestone under a revision policy, with preserved revision history. | F-08 | 2 | Proposed |
| FR-09 | A Supervisor edits or closes a milestone and manages team deadlines. | F-09 | 2 | Proposed |
| FR-10 | A Supervisor assigns a grade with feedback; visibility of grades is defined by rule. | F-10 | 2 | Proposed |
| FR-11 | A progress board and summary reports show team and milestone status. | F-11 | 3 | Proposed |
| FR-12 | Users search and filter only records they are entitled to see. | F-12 | 3 | Proposed |

FR-08 to FR-12 are placeholders so the three sprints cover a whole-product baseline. They are unapproved and need their own contracts.

## 5. Business rules

| ID | Applies when | Required enforcement | Outcome when violated |
|---|---|---|---|
| BR-01 One submission per milestone | A team member submits to a milestone. | Unique constraint on `Submission.milestoneId` plus a transaction, safe under concurrent submits by two members. | 409 `DUPLICATE_SUBMISSION`; no new record. |
| BR-02 Deadline | A submission is created. | Accept at or before `dueAt`; compare against an injectable server clock. | 409 `DEADLINE_PASSED`; no record. |
| BR-03 Milestone creation | A Supervisor creates a milestone. | Only the team's supervisor; title 5 to 100 chars; description 0 to 1000; `dueAt` must be a valid date in the future at creation. | 400 for bad fields; unassigned team returns the uniform 404; no record. |
| BR-04 Submission authorization and data | Any submission. | Only a Student who is a member of the milestone's team. `submittedById` comes from the session. Title 5 to 100; description 20 to 2000; link is `http` or `https`, at most 500 chars, stored as text and never fetched. | 400 invalid data (including `javascript:`, `data:`, `ftp:` links); non-member gets the uniform 404; no record. |
| BR-05 Feedback | A Supervisor records feedback. | Only the team's supervisor, on an existing submission; comment trimmed has 10 to 2000 chars; one feedback per submission; feedback is immutable and linked by foreign key. | 400 invalid comment; 409 `FEEDBACK_EXISTS`; unassigned supervisor gets the uniform 404. |
| BR-06 Private team data | Every read. | Students read only data of teams they belong to; Supervisors only data of teams they supervise. Scope is applied in the query. | Uniform 404 for another team's data and for nonexistent IDs; lists omit out-of-scope records. |
| BR-07 Role separation | Milestone, submission and feedback routes. | Students submit but cannot create milestones or feedback. Supervisors create milestones and feedback but cannot submit. | 403 with a safe error; no change. |

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
| D-08 | Revision policy for Sprint 1: one submission per milestone, no edit or resubmit. Revisions with history move to Sprint 2 (F-08). | Proposed |
| D-09 | Supervision scope: a supervisor sees and acts only on teams assigned to them. | Decided (spec Theme 6) |
| D-10 | Feedback visibility: the team's members and the team's supervisor only. No other team and no grades in Sprint 1. | Proposed |
| D-11 | A submission is by the team, recorded with the member who sent it; any member may submit. | Proposed |
| D-12 | Submission uses a link only; no file upload. | Proposed |
| D-13 | Email is unique and compared case-insensitively. | Proposed |
| D-14 | Password change is out of scope. | Decided |
| D-15 | `group_work_specs_v1.pdf` was reviewed; the earlier proposal-approval slice is removed. | Decided 2026-11-06 |
