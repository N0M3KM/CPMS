# CPMS Software Requirements Specification (Part A)

**Version:** 1.0 (draft for review)
**Product:** Course Project Management System (CPMS), CPE 334
**Related:** [Features](features.md) · [Traceability](traceability.md) · [System SDS](system-sds.md) · [Sprint plan](sprints/plan.md)

## Version history

| Version | Date | Change |
|---|---|---|
| 1.1 | 2026-11-06 | Approved NFR-07 to NFR-12 for Sprint 1; decided D-05 as uniform 404. |
| 1.0 | 2026-11-06 | Split out of the former project plan and Sprint 1 specification. Renamed AC/test IDs to `AC-nn` / `TEST-nn`. Added proposed FR-07 to FR-10 for Sprints 2 and 3 (unapproved). |

## 1. Stakeholder problem and context

Course project proposals are tracked through chat messages and spreadsheets. Students cannot see where their proposal stands. Supervisors have no reliable view of what is assigned to them or how loaded they are. CPMS centralizes proposal submission, review, status and role-scoped visibility for a course project setting.

The course brief points to `group_work_specs.docx` as the master specification. It has not been supplied, so this SRS rests on the CPMS brief the team received. Theme-specific examples or rubric details in that file may require changes (see D-07).

## 2. Actors and responsibilities

| Actor | Responsibility | Data boundary |
|---|---|---|
| Anonymous visitor | Log in with an existing seeded account. | No protected data or operations. |
| Student | Submit a proposal to a chosen supervisor; track status and history. | Only proposals whose `studentId` is their session user ID. |
| Supervisor | Review proposals assigned to them; see own queue and workload. | Only proposals whose `supervisorId` is their session user ID. |

There is no administrator actor in Sprint 1. A later admin role (F-09) needs an explicit decision first.

### Terminology

- **Active proposal:** a proposal in `SUBMITTED` or `APPROVED` status.
- **Assigned supervisor:** the user whose ID is stored in `Proposal.supervisorId`.
- **Authenticated user:** a user holding a valid, unexpired, unrevoked server-side session.
- **Remaining capacity:** `max(capacity - count(APPROVED), 0)` for a supervisor.

## 3. Scope

**In scope (whole product):** authentication, role and ownership enforcement, proposal submission, proposal review, scoped views and workload (Sprint 1); progress tracking and project discussion (Sprint 2, proposed); administrative assignment and search (Sprint 3, proposed).

**Explicitly excluded:** self-registration, password recovery, file uploads, notifications, grading, and any admin UI in Sprint 1. Docker packaging, CI/CD and GCP deployment are designed for but not performed in Deliverable 1 (Lab 5).

## 4. Functional requirements

| ID | Requirement | Feature | Sprint | Status |
|---|---|---|---:|---|
| FR-01 | An existing seeded user can log in with email and password, log out, retrieve current-user identity, and use a session that expires. | F-01 | 1 | Baseline |
| FR-02 | Every protected operation enforces role and record ownership using identity and role derived from the server session only. | F-02 | 1 | Baseline |
| FR-03 | A Student can submit a proposal assigned to a selected Supervisor. Title is 5 to 100 characters and description is 20 to 2000 characters. | F-03 | 1 | Baseline |
| FR-04 | Only the assigned Supervisor can approve or reject a `SUBMITTED` proposal, subject to the comment and capacity rules. | F-04 | 1 | Baseline |
| FR-05 | Students list and read only their own proposals. Supervisors list and read only assigned proposals and see their own workload and capacity. | F-05 | 1 | Baseline |
| FR-06 | A repeatable, idempotent seed provides synthetic Student and Supervisor accounts and proposals in several states. | F-06 | 1 | Baseline |
| FR-07 | Student and Supervisor can record and view progress milestones on an approved proposal. | F-07 | 2 | Proposed |
| FR-08 | Participants of an approved proposal can post and read a discussion history for it. | F-08 | 2 | Proposed |
| FR-09 | An authorized administrator can manage supervisor assignment and users. | F-09 | 3 | Proposed, needs role decision |
| FR-10 | A user can search and filter only the proposal records they are entitled to see. | F-10 | 3 | Proposed |

FR-07 to FR-10 are placeholders so the three sprints cover a whole-product baseline. They are not detailed or approved. Each needs its own authorization before specification.

## 5. Business rules

| ID | Applies when | Required enforcement | Outcome when violated |
|---|---|---|---|
| BR-01 One active proposal per student | A Student submits. `SUBMITTED` and `APPROVED` proposals count; `REJECTED` ones are history. | Check and insert safely under concurrent submissions (transaction or constraint). Student ID comes from the session. | 409 with an explicit active-proposal error; no record created. Rejected-only history allows a new submission. |
| BR-02 Supervisor approval capacity | Before a proposal becomes `APPROVED`, compare the supervisor's `APPROVED` count to their `capacity` (seed default 5). | Check and approve atomically so concurrent approvals cannot exceed capacity. | 409 with an explicit capacity message; proposal unchanged. |
| BR-03 Rejection comment | A `REJECTED` decision. Trim whitespace; at least 10 characters must remain. Approval comment is optional. | Validate on the server; persist the comment. | 400; status, comment and `reviewedAt` unchanged. |
| BR-04 Assigned supervisor, one decision | Every review request. | Role is Supervisor, user ID equals `supervisorId`, state is `SUBMITTED`, all checked inside the decision transaction. | Wrong role or assignment: 403 or privacy-safe 404. Already decided: 409. Nothing changes. |
| BR-05 Private ownership | Every list and detail request. | Scope list queries in the backend; authorize detail against the session identity; never trust a client-supplied ID or role. | 403 or 404 with no private fields; lists omit out-of-scope records. |
| BR-06 Role separation | Submission and review routes. | Student may submit, not review. Supervisor may review assigned records, not submit. Enforced in the API. | 403 with a safe error; no state change. |

**Precedence:** authentication first, then role, then ownership or assignment, then validation (400), then rule conflicts (409).

## 6. Non-functional requirements

| ID | Requirement and measurable target | Verification | Sprint |
|---|---|---|---:|
| NFR-01 | Protected endpoints reject unauthenticated requests with 401 and return no private data. | API test (TEST-31) | 1 |
| NFR-02 | Passwords are stored only as bcrypt hashes; plaintext appears nowhere in persistence. | DB integration test (TEST-32) | 1 |
| NFR-03 | Error responses never contain stack traces or SQL. | API test across validation, conflict and unexpected-error paths (TEST-33) | 1 |
| NFR-04 | Body and button text contrast is at least 4.5:1 (WCAG AA) for the chosen token pairs. | Recorded contrast calculation (TEST-34) | 1 |
| NFR-05 | Typical API responses take under 500 ms on local seeded data. | Manual timing record with endpoint and conditions (TEST-35) | 1 |
| NFR-06 | The app builds and runs from environment variables alone, with no secrets in Git or client code. | Review of `.env.example` and a clean-clone setup run | 1, re-verified in Lab 5 |

### Security NFRs (approved 2026-11-06 for Sprint 1)

| ID | Requirement and measurable target | Verification | Sprint |
|---|---|---|---:|
| NFR-07 | User-supplied input cannot cause script execution, SQL, command, file-path or server-side request effects. | SEC-01, 02, 04, 11, 12 | 1 |
| NFR-08 | State-changing requests from a foreign `Origin` or non-JSON body are rejected. | SEC-03 | 1 |
| NFR-09 | Login does not reveal whether an email is registered, ignores unanticipated fields and redirect inputs, and issues a fresh session ID; tampered cookies are rejected. | SEC-07, 09, 10 | 1 |
| NFR-10 | Repeated failed logins and request bursts are throttled with 429 (proposed: 5 failures per 15 min per IP and email; 100 requests per minute per IP). | SEC-08, 16 | 1 |
| NFR-11 | Request schemas reject unknown fields; responses contain only whitelisted fields. | SEC-13, 14 | 1 |
| NFR-12 | Security headers, strict CORS, body size cap and no high or critical dependency vulnerabilities. | SEC-17, 18, 19 | 1 |

See the [security test plan](security-test-plan.md) and the [architecture plan](architecture.md).

## 7. Assumptions, decisions and open questions

| ID | Decision or assumption | Status |
|---|---|---|
| D-01 | Student and Supervisor are the only roles in Sprint 1. | Decided (brief) |
| D-02 | Accounts are seeded; no self-registration or recovery. | Decided (brief, course PDF) |
| D-03 | Authentication uses database-backed expiring sessions in a secure cookie. | Decided (brief) |
| D-04 | Rejected proposals stay as history and allow resubmission when no active proposal exists. | Decided (BR-01) |
| D-05 | Another user's proposal and a nonexistent proposal both return the same 404 body (no existence leak). 403 remains for wrong role. | Decided 2026-11-06 |
| D-06 | Sprint order is dependency-driven; no calendar or effort estimates are fixed beyond course checkpoints. | Decided |
| D-07 | `group_work_specs.docx` was not available. | Open gap; reconcile if obtained |
| D-08 | Email is unique and compared case-insensitively. | Proposed; brief is silent |
| D-09 | Password change and session revocation on change are out of scope. | Decided |
| D-10 | Submission is not blocked when a chosen supervisor is at approval capacity; only approval is blocked. | Decided (brief) |
