# CPMS Sprint 1 Specification

**Version:** 0.6 (draft)  
**Sprint:** 1 — Secure proposal lifecycle  
**Project roadmap:** [project-plan.md](../../plans/project-plan.md)  
**Plan:** [plan.md](plan.md)

## Version history

| Version | Date | Change |
|---|---|---|
| 0.1 | 2026-11-05 | Initial Sprint 1 contracts derived from supplied CPMS brief. |
| 0.2 | 2026-11-05 | Reorganized against Deliverable 1 Parts A–F; clarified Sprint 1 login UI/code and working vertical-slice requirement; recorded unavailable group master specification as a coverage gap. |
| 0.3 | 2026-11-05 | Repaired both UML sequence swimlanes with parser-safe participant names and message labels after Mermaid rendering errors; retained the ownership-aware permission matrix and Sprint 1 assignments. |
| 0.4 | 2026-11-05 | Expanded BR-01–BR-06 into explicit triggering conditions, enforcement requirements, and failure outcomes, including safe concurrency requirements. |
| 0.5 | 2026-11-06 | Moved architecture, domain-model, and UML sequence diagrams to the Sprint 1 plan; added the per-sprint GitHub Issue, staging-branch, review, and release workflow. |
| 0.6 | 2026-11-06 | Moved the all-sprint GitHub workflow to the repository `AGENTS.md`; removed the specification status line. |

## 1. Purpose and scope

This document supplies the documentary engineering baseline for Deliverable 1 Parts A, B, C, and E. Sprint 1 contracts cover F-01–F-05: authentication/current user, role and ownership enforcement, proposal submission, assigned-supervisor review, and scoped proposal views/workload. The eventual Sprint 1 increment includes a login UI and related code and must complete a UI/API/database domain journey. Implementation is paused until the user approves these documents.

Out of scope for Sprint 1: self-registration, password recovery, administrator UI, file uploads, notifications, milestones, grading, and any Sprint 2/3 feature. Docker, CI/CD completion, GCP setup, and deployment are not required for Deliverable 1; deployment readiness/design is documented, deployment is not performed.

## Part A — SRS and product scope

### Stakeholder problem and context

Course project proposals are tracked through chat messages and spreadsheets. Students lack a clear way to know proposal status; supervisors lack a reliable view of assigned work and workload. CPMS centralizes proposal submission, review, status, and role-scoped visibility for the course project context. The source PDF references `group_work_specs.docx` as the master specification and theme assignment, but that file was not supplied in this workspace. This baseline therefore uses the supplied CPMS brief; course-specific theme examples, student names/IDs, or extra rubric requirements remain to be reconciled when available.

### Decisions and assumptions

| ID | Decision / assumption | Status / basis |
|---|---|---|
| D-01 | Student and Supervisor are the only application roles in Sprint 1. | From supplied brief; no admin UI. |
| D-02 | Existing accounts are seeded; self-registration and recovery are excluded. | From supplied brief and deliverable PDF. |
| D-03 | Authentication uses database-backed server sessions and secure cookies. | Fixed by supplied brief. |
| D-04 | Rejected proposals remain history and permit later resubmission if there is no active proposal. | BR-01. |
| D-05 | Inaccessible proposal may return 403 or 404, as long as no private data is returned. | Open implementation choice. |
| D-06 | Sprint sequencing is dependency-driven; duration and effort estimates are not defined here. | Project planning choice; no calendar schedule is included. |
| D-07 | Referenced group master specification was not provided. | Coverage gap; reconcile before final PDF if obtained. |

## 2. Actors and terminology

- **Student:** submits proposals and reads only their own proposal records.
- **Supervisor:** reviews proposals assigned to them and reads only their assigned queue/history and workload.
- **Authenticated user:** a user whose server-side session is valid and unexpired.
- **Active proposal:** a proposal in `SUBMITTED` or `APPROVED` status (BR-01).
- **Assigned supervisor:** the supervisor whose ID is stored in `Proposal.supervisorId`.

## 3. Requirements and traceability

### Functional requirements

| ID | Requirement | Feature |
|---|---|---|
| FR-01 | Authenticate an existing user with email/password; provide logout and current-user lookup; expire sessions. | F-01 |
| FR-02 | Enforce role authorization and record ownership on the server using the session identity. | F-02 |
| FR-03 | Allow a Student to submit a valid proposal assigned to a selected Supervisor. | F-03 |
| FR-04 | Allow only the assigned Supervisor to decide a submitted proposal; enforce capacity and decision-comment rules. | F-04 |
| FR-05 | Provide role-scoped proposal list/detail views and supervisor workload/capacity data. | F-05 |
| FR-06 | Seed repeatable synthetic student/supervisor accounts and sample proposal states. | F-01–F-05 support |

### Business rules (detailed Sprint 1 contract)

| ID | When it applies | Required enforcement | Outcome when violated |
|---|---|---|---|
| BR-01 — One active proposal per student | On proposal submission, consider `SUBMITTED` and `APPROVED` proposals for the authenticated student. `REJECTED` proposals are history and do not block another submission. | Check and create safely under concurrent submissions using a database transaction/constraint strategy. The student ID is derived from the session. | If an active proposal exists, return 409 with an explicit active-proposal error and create no record. A rejected-only history permits a new submission. |
| BR-02 — Supervisor approval capacity | Before changing a proposal to `APPROVED`, count that supervisor's `APPROVED` proposals and compare with their seeded `capacity` (default 5). `SUBMITTED` and `REJECTED` proposals do not consume approved capacity. | Check capacity and perform the approval atomically so concurrent decisions cannot exceed capacity. | If approved count is at or above capacity, return 409 with an explicit capacity message and leave proposal state unchanged. |
| BR-03 — Rejection comment | On a `REJECTED` decision, trim surrounding whitespace and require at least 10 remaining characters. For `APPROVED`, comment is optional. | Validate server-side; persist the supplied comment for a valid rejection and any optional approval comment. | Invalid rejection comment returns 400 and does not change proposal status, comment, or reviewed timestamp. |
| BR-04 — Assigned supervisor and one-time decision | On every review request, the session role must be Supervisor, its user ID must equal the proposal's `supervisorId`, and the current state must be `SUBMITTED`. | Verify role, assignment, and state on the server as part of the decision transaction. Only transitions from `SUBMITTED` to `APPROVED` or `REJECTED` are allowed. | Wrong role/assignment returns 403 or privacy-safe 404. Already-decided proposal returns 409. No invalid request changes the record. |
| BR-05 — Private proposal ownership | On every list and detail request, a Student may access records whose `studentId` matches their session user ID; a Supervisor may access records whose `supervisorId` matches their session user ID. | Scope list queries in the backend and authorize details against the session identity. Never trust a client-supplied user ID or role. | Cross-user access returns 403 or 404 and never includes private proposal fields. Lists omit all records outside the actor's scope. |
| BR-06 — Role separation | On submission and review routes, Student and Supervisor roles have distinct capabilities. | Student may submit but may not review. Supervisor may review assigned records but may not submit. Enforce this in API middleware/application logic regardless of UI visibility. | Disallowed operation returns 403 with a safe error and no state change. |

**Rule precedence:** Authentication is checked before protected business operations. Role and ownership/assignment checks precede access to private proposal data. Request validation failures use 400; rule conflicts BR-01, BR-02, and BR-04 use 409; forbidden roles use 403. Any accepted 404 privacy policy must return no private data. These rules retain the stable BR IDs used by feature contracts, acceptance criteria, and tests.

### Non-functional requirements

| ID | Requirement | Verification / sprint |
|---|---|---|
| NFR-01 | Protected endpoints reject unauthenticated calls with 401 and no private data. | API test; Sprint 1 |
| NFR-02 | Passwords are stored only as bcrypt hashes. | DB integration test; Sprint 1 |
| NFR-03 | Error responses never expose stack traces or SQL. | API test; Sprint 1 |
| NFR-04 | UI text contrast is at least WCAG AA 4.5:1. | Documented contrast calculation for palette tokens; Sprint 1 |
| NFR-05 | Typical API responses are under 500 ms on local seed data. | Manual timing check recorded with endpoint, conditions, and observed latency; Sprint 1 |

### Traceability overview

| Requirement/rule | Feature(s) | Acceptance criteria | Test specs |
|---|---|---|---|
| FR-01 | F-01 | A01–A04 | T01–T04 |
| FR-02, BR-05, BR-06 | F-02 | A05–A08 | T05–T08 |
| FR-03, BR-01 | F-03 | A09–A14 | T09–T14 |
| FR-04, BR-02–BR-04 | F-04 | A15–A22 | T15–T22 |
| FR-05, BR-05 | F-05 | A23–A28 | T23–T28 |
| FR-06 | F-01–F-05 support | A29–A30 | T29–T30 |
| NFR-01–05 | Cross-cutting | A31–A35 | T31–T35 |

Coverage gaps/open decisions: none in the supplied Sprint 1 rule set are intentionally omitted. The exact 403-versus-404 policy for inaccessible proposal IDs remains an implementation decision; either is compliant if no private data is returned. Email normalization/uniqueness and session revocation on password change are not defined by the brief; password change is out of scope. Response-time measurement environment needs to be recorded when execution occurs.

## Part B — Feature inventory and requirements traceability

| Feature | Description | Requirements | Dependencies | Sprint |
|---|---|---|---|---|
| F-01 | Authentication, logout, current user, session expiry | FR-01; NFR-01–03 | Seeded users, Session persistence | 1 |
| F-02 | Role-based access and ownership checks | FR-02; BR-05, BR-06; NFR-01, NFR-03 | F-01 | 1 |
| F-03 | Student submits project proposal | FR-03; BR-01; NFR-03 | F-01, F-02, supervisor directory | 1 |
| F-04 | Assigned supervisor approves/rejects proposal | FR-04; BR-02–04; NFR-03 | F-01, F-02, F-03 | 1 |
| F-05 | Scoped proposal list/detail and supervisor workload | FR-05; BR-05; NFR-01, NFR-04, NFR-05 | F-01–F-04 | 1 |
| F-06 | Idempotent synthetic seed and runtime support | FR-06; NFR-02 | Data model | 1 |
| F-07 (candidate) | Milestones and progress tracking | Baseline addition to be approved | F-01–F-05 | 2 |
| F-08 (candidate) | Project comments/discussion history | Baseline addition to be approved | F-01–F-05 | 2 |
| F-09 (candidate) | Supervisor assignment/user administration | Candidate only; role and authorization TBD | F-01, F-02 | 3 |
| F-10 (candidate) | Search/filter permitted project records | Candidate addition to be approved | F-01, F-02, proposal records | 3 |

The Sprint 1 traceability table above maps every current FR/BR/NFR to features, ACs and tests. Whole-product coverage in Sprints 2–3 is provisional: the supplied baseline explicitly excludes milestones and admin UI from Sprint 1 but does not define later committed requirements. F-07–F-10 are planning candidates, not approved scope. NFR-04 is verified with Sprint 1 UI tokens; NFR-05 by Sprint 1 local timing. Coverage gap: unprovided `group_work_specs.docx` may contain additional theme-specific requirements. No approved requirement changes have been supplied.

## Part C — System-Level SDS

### Architecture and responsibilities

The browser handles accessible forms, navigation, client-side feedback, and role-appropriate presentation. The Express application validates inputs, authenticates the server session, derives the user/role, authorizes access, applies business rules transactionally, and returns safe JSON. PostgreSQL persists users, sessions, and proposals through Prisma migrations. The database/test environment is separate from normal development data. Migrations are additive. Seed data is synthetic and repeatable. Business rules and permissions are enforced server-side; hiding a control in the browser is not security.

### UML and graph models

Architecture, domain-model, and UML sequence diagrams are maintained in [plan.md](plan.md) under **Design diagrams** so the Sprint 1 planning package presents all models together. The text contracts in this specification define their authoritative behavior.

### Main navigation and API conventions

The screen/navigation and API catalog are specified in Part E below. All data views show loading/empty/error/success states. API errors share the JSON envelope, Zod handles request validation, and errors omit SQL/stack traces.

### Project-wide workflow policy

GitHub Issue status transitions, per-sprint staging branches, feature PR review, release PRs, and the no-direct-push rule are maintained in the repository root [AGENTS.md](../../../AGENTS.md) and apply to every sprint. This specification keeps the Sprint 1 feature contracts and verification requirements; it does not redefine the shared workflow.

### Configuration and delivery design

Environment names and secret handling are listed in Section 8. For later deployment, plan one container with Express serving built client assets, Cloud Run, Cloud SQL, and Secret Manager. `GET /api/health` does not require the database; `GET /api/ready` checks database connectivity. Cloud setup, Docker, completed CI/CD, and GCP deployment are outside Deliverable 1 per the supplied assessment PDF.

## 4. Data model and constraints

See the User/Session/Proposal class diagram in [plan.md](plan.md), under **Design diagrams**.

**Entity requirements**

- `User`: `id`; unique email; `passwordHash` only (bcrypt); `role` is `STUDENT` or `SUPERVISOR`; `capacity` is seeded/default 5 for supervisors and unused for students. Whether to represent role-specific capacity as nullable or a separate profile is an implementation detail, provided constraints remain enforceable.
- `Session`: opaque server-generated ID/token; references one user; stores expiry and creation time. Persist server-side in the database. Cookie carries the session identifier, never the role or trusted user identity.
- `Proposal`: fields exactly as listed in product brief: `id`, `title`, `description`, `studentId`, `supervisorId`, `status`, nullable `reviewComment`, `submittedAt`, nullable `reviewedAt`. `title` length 5–100; `description` length 20–2000. FKs reference Student and Supervisor users respectively. Status is `SUBMITTED`, `APPROVED`, or `REJECTED`.
- Proposal transitions: create as `SUBMITTED`; transition exactly once from `SUBMITTED` to `APPROVED` or `REJECTED`. Rejected records remain in history. No edits, deletion, or re-review are specified.
- Capacity counts proposals in `APPROVED` state for the given supervisor. Pending and rejected proposals do not consume approved capacity. No concurrency strategy is prescribed; implementation must prevent over-capacity approvals under concurrent requests.
- BR-01 uniqueness of active proposals per student must be enforced safely even with concurrent submits (database constraint/transaction strategy is implementation-specific).

## 5. Roles and permissions

| Operation | Anonymous | Student | Supervisor assigned to proposal | Supervisor not assigned |
|---|---|---|---|---|
| Login | May authenticate with valid credentials | May authenticate | May authenticate | May authenticate |
| Logout / current-user lookup | 401 | Own session | Own session | Own session |
| List supervisors and remaining capacity | 401 | Allow | 403 | 403 |
| Submit proposal | 401 | Allow; student ID comes from session | 403 | 403 |
| List proposals | 401 | Own proposals only | Assigned proposals only | Assigned proposals only |
| Read proposal detail | 401 | Own proposal only | Assigned proposal only | 403 or privacy-safe 404 |
| Review proposal | 401 | 403 | Allow only while `SUBMITTED` | 403 or privacy-safe 404 |
| Read workload/capacity | 401 | 403 | Own assigned queue and workload only | Own assigned queue and workload only |

For proposal records belonging to another student, Student access is denied with 403 or privacy-safe 404. There is no administrator actor or admin UI in Sprint 1. Hiding unavailable UI actions improves usability but is not an authorization control. The API must enforce all permissions. Do not accept user ID or role from request parameters/body as authority.

## 6. Authentication, API, and error contract

**Session design:** email/password login; compare bcrypt hash; on success create a database-backed session with expiry and set an `httpOnly`, `SameSite=Lax` cookie, `Secure` in production. Logout revokes the session and clears the cookie. `me` returns the authenticated user’s safe identity and role, never password data. Session expiry invalidates access server-side.

**Common response rules:** JSON. Errors use `{ "error": { "code": "...", "message": "..." } }`. Do not return stack, SQL, password hash, session token, or inaccessible proposal data. Validate request shapes with Zod. 200/201 success; 400 validation; 401 unauthenticated; 403 forbidden; 404 missing resource; 409 rule conflict (BR-01/02/04).

| Method + path | Access | Request / response contract |
|---|---|---|
| `POST /api/auth/login` | Public | `{email,password}`; success returns safe user and sets session cookie. Invalid credentials use generic 401. |
| `POST /api/auth/logout` | Authenticated | Revokes current session, clears cookie; success 200. |
| `GET /api/auth/me` | Authenticated | Safe current-user identity (`id`, `email`, `role`). |
| `GET /api/supervisors` | Student | List supervisor safe identifiers/names and `remainingCapacity`; no password/session data. |
| `POST /api/proposals` | Student | `{title,description,supervisorId}`; creates `SUBMITTED`, sets student from session, returns created proposal. |
| `GET /api/proposals` | Authenticated | Student’s own proposals or supervisor’s assigned proposals; includes workload/capacity for supervisor view as needed. |
| `GET /api/proposals/:id` | Owner or assigned supervisor | Returns permitted proposal detail; inaccessible ID is 403 or 404 with no private body. |
| `POST /api/proposals/:id/review` | Assigned supervisor | `{decision:"APPROVED"|"REJECTED",comment?}`; returns updated proposal. |

Remaining capacity is `max(capacity - count(APPROVED), 0)`. A student choosing a supervisor must see a non-negative remaining capacity value; the brief does not require blocking submission when approved capacity is full, only blocking approval at capacity.

## 7. UI contract

Screens: Login; Student dashboard with current proposal status, submit form, and history; Proposal detail; Supervisor dashboard with workload/capacity, pending queue, and decided list; review panel with approve/reject and comment.

Use light theme tokens: app background `#F8FAFC`, white surfaces, text `#0F172A`, muted `#475569`, borders `#E2E8F0`, subtle panel `#F1F5F9`, indigo accent `#4F46E5` and hover `#4338CA`; status colors `#15803D`, `#B45309`, `#B91C1C` paired with text labels. Use Inter/system-ui, 16px base, line-height 1.5, visible focus, keyboard access, labeled fields, inline validation. Dashboard cards use 12-column CSS grid, 16–24px gaps, 12–16px radius, thin border and light shadow. Every data view has loading, empty, error, and success states. UI hides actions unavailable to the role; backend remains authoritative.

## 8. Configuration and deployment readiness (plan only)

| Variable | Purpose | Secret? |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection | Yes |
| `PORT` | Express listening port | No |
| `SESSION_SECRET` | Session signing/crypto secret if required by chosen session implementation | Yes |
| `SESSION_TTL_HOURS` | Session expiry duration | No |
| `NODE_ENV` | Runtime mode; controls secure cookie | No |
| `SEED_STUDENT_PASSWORD` | Password for synthetic seeded students | Yes |
| `SEED_SUPERVISOR_PASSWORD` | Password for synthetic seeded supervisors | Yes |

All configuration from environment; only placeholders in `.env.example`; `.env` ignored. Never print actual secrets. Deployment plan for later: containerized client/server with Express serving built client, Cloud Run service, Cloud SQL PostgreSQL, Secret Manager for secrets, env-based configuration, `GET /api/health` without DB and `GET /api/ready` checking DB. Do not deploy during Sprint 1 documentation.

## 9. Workflow specifications

### Student proposal flow

1. Student logs in; server validates credentials, creates expiring DB session, and sets cookie.
2. Client loads `me`, then requests supervisors; list shows names and remaining capacity.
3. Student submits title, description, and selected supervisor. Server derives student identity from session and validates fields/role/rules.
4. On success create a `SUBMITTED` proposal. Student dashboard/list/detail refresh to show it.
5. If current active proposal exists, return 409 with explicit BR-01 message. If previous proposals are only rejected, allow a new submission.

### Supervisor review flow

1. Supervisor logs in and loads assigned proposal queue and own approved count/capacity.
2. Supervisor opens an assigned `SUBMITTED` proposal and sends `APPROVED` or `REJECTED` with optional comment.
3. Reject requires at least 10 non-whitespace characters. Approve permits absent comment.
4. Server atomically verifies assignment, submitted status, decision validity, and capacity before transition.
5. Success sets status and `reviewedAt`; rejected comment is stored. A full supervisor cannot approve (409 BR-02). Wrong assignment is forbidden/not found; already-decided item returns 409 BR-04.

## Part E — Sprint 1 engineering contracts

**Planned developers:** Jinnakan 1010 and Drarun 1016. Feature ownership, peer review, and sequence-diagram ownership are assigned in [plan.md](plan.md). Each developer reviews the other's work; neither approves their own changes.

### Feature contracts

The following feature slices link the cross-cutting data, permission, API and UI contracts to their acceptance criteria. “No migration” means an implementation still documents that decision in its feature issue/PR.

| Feature | Behavior, dependency and failure boundaries | UI/API/data contract |
|---|---|---|
| F-01 | Existing seeded account logs in; wrong credentials generic 401; logout revokes; expired session fails. Depends on User/Session. | Login screen and authenticated navigation; `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`; persist bcrypt hash and expiring session. |
| F-02 | Authenticate every protected request; derive identity only from session; enforce role and ownership. Depends on F-01. | Hide unavailable controls, but API responds 401/403 or privacy-safe 404; no client-provided role/user authority. No new entity required. |
| F-03 | Student submits once while no active proposal; rejected-only history permits resubmission; invalid bounds/assignee fail. Depends on F-01/02. | Student dashboard form and supervisor picker; `GET /api/supervisors`, `POST /api/proposals`; persist proposal with session student and selected supervisor. |
| F-04 | Assigned Supervisor decides submitted proposal once; rejection comment >=10 trimmed characters; approval checks capacity atomically. Depends on F-01–03. | Queue/detail review panel; `POST /api/proposals/:id/review`; update status/comment/reviewedAt. 400 invalid, 403/404 wrong assignment, 409 state/capacity conflicts. |
| F-05 | Return owner/assigned-scoped lists, details, and supervisor workload; preserve rejected history. Depends on F-01–04. | Student and Supervisor dashboards, detail, loading/empty/error/success; `GET /api/proposals`, `GET /api/proposals/:id`; no new entity required. |
| F-06 | Repeatable synthetic dataset supports local verification. | `npm run db:seed`; no password output; no new API endpoint required. |

### Screen-level contract

- Login: labeled email/password fields, inline validation, pending/error/success feedback, keyboard-visible focus; success routes to the appropriate role dashboard. No self-registration/recovery links are required.
- Student dashboard: current proposal/status, submit form with supervisor/remaining capacity picker, and history including rejected entries.
- Proposal detail: permitted data only, explicit status and review result/comment.
- Supervisor dashboard: own approved count/capacity, assigned pending queue and decided list.
- Review panel: approve/reject; reject comment required with inline minimum length feedback; backend errors remain visible.
- Each data view implements loading, empty, error and success states.

## 10. Acceptance criteria

### F-01 — Authentication and current user

- **A01:** Valid seeded Student credentials log in successfully, set an `httpOnly`, `SameSite=Lax` session cookie, and return safe identity/role.
- **A02:** Valid seeded Supervisor credentials receive the same session behavior and correct role.
- **A03:** Invalid email/password returns generic 401; no session is created and no sensitive detail is disclosed.
- **A04:** `me` returns the session user while valid; logout revokes session; expired/revoked session cannot access protected routes (401).

### F-02 — Role-based access and ownership

- **A05:** Anonymous calls to every protected endpoint return 401 without private data.
- **A06:** Student cannot call review or supervisor-only workload; Supervisor cannot submit or list supervisors; requests return 403.
- **A07:** Student list/detail exposes only their own proposals; supervisor list/detail exposes only assigned proposals.
- **A08:** Cross-user proposal access or review never returns private proposal data (403 or 404); non-assigned supervisor cannot review.

### F-03 — Submit proposal

- **A09:** Student submits valid title (5 and 100 character boundaries inclusive), description (20 and 2000 inclusive), and selected existing supervisor; saved record is `SUBMITTED`, with student ID from session and timestamps.
- **A10:** Title shorter than 5 or longer than 100, description shorter than 20 or longer than 2000, missing fields, malformed IDs, or nonexistent/non-supervisor assignee return 400 without creation.
- **A11:** Student with a `SUBMITTED` proposal is prevented from another submission with 409 BR-01.
- **A12:** Student with an `APPROVED` proposal is prevented from another submission with 409 BR-01.
- **A13:** Student with only `REJECTED` proposal history may submit a new proposal.
- **A14:** Supervisor attempting submission is denied with 403 (also covered by A06).

### F-04 — Review proposal

- **A15:** Assigned supervisor approves a `SUBMITTED` proposal with no comment; status and `reviewedAt` update.
- **A16:** Assigned supervisor rejects with comment at least 10 non-whitespace characters; status, comment, and `reviewedAt` update.
- **A17:** Reject with missing, empty, whitespace-only, or fewer-than-10-character comment returns 400 without state change.
- **A18:** Approve with optional comment persists the supplied comment.
- **A19:** Approving when supervisor already has capacity approved records returns 409 with explicit capacity message and leaves proposal unchanged.
- **A20:** Non-assigned supervisor cannot review a proposal; response 403 or 404 with no private proposal data.
- **A21:** Review of an already approved/rejected proposal returns 409 BR-04 and does not change it.
- **A22:** Student review attempt returns 403 (also covered by A06).

### F-05 — Lists, details, and workload

- **A23:** Student list returns only own proposals including rejected history; Student can open own detail.
- **A24:** Supervisor list returns only assigned pending/decided proposals and workload count/capacity; Supervisor can open assigned detail.
- **A25:** Supervisor list does not expose proposals assigned to others; Student list does not expose another student’s records.
- **A26:** Student supervisor picker lists safe names and remaining capacity, without credentials or session data.
- **A27:** Empty list renders an empty state; loading, error, and success states are present on each data view.
- **A28:** Role-inappropriate actions are hidden in UI and direct API calls remain denied by server (UI behavior plus A06).

### Seed, NFR, and delivery criteria

- **A29:** Idempotent seed operation provides 3 synthetic Students, 2 Supervisors, and sample proposals in multiple states; supervisor default capacity is 5; credentials come only from env variables.
- **A30:** Repeating seed does not duplicate accounts or sample records or print password values.
- **A31:** All protected endpoint auth failures meet NFR-01; no response includes private data.
- **A32:** Database stores only bcrypt password hashes, never plaintext.
- **A33:** Error responses do not contain stack traces or SQL.
- **A34:** Palette token contrasts are documented and body/button text meets 4.5:1 WCAG AA.
- **A35:** Manual local-seed response timing is recorded for representative endpoints and typical API responses are below 500 ms.

### Software Test Specification (STS)

Each AC maps to at least one test specification. Test levels: unit, API (integration with separate test DB), or e2e. Test IDs are stable planning identifiers, not claims that test files exist or have run.

| Test ID | AC | Level | Preconditions | Action | Expected result |
|---|---|---|---|---|---|
| T01 | A01 | API | Seeded Student; isolated DB | POST login with valid credentials | 200, safe role identity, secure cookie attributes |
| T02 | A02 | API | Seeded Supervisor | Login valid credentials | 200, Supervisor identity and cookie |
| T03 | A03 | API | No active session | Login invalid credentials | Generic 401; no valid session |
| T04 | A04 | API | Valid, then revoked/expired session | GET me, logout, then call protected route; repeat expired case | Safe identity while valid; afterward 401 |
| T05 | A05 | API | No cookie | Call each protected route | 401; response has no private fields |
| T06 | A06 | API | Student and Supervisor sessions | Student calls review/workload; Supervisor calls submit/supervisors | 403 for disallowed role actions |
| T07 | A07 | API | Two students, two supervisors, distinct assigned proposals | Each lists and reads permitted records | Results limited to session-owned/assigned records |
| T08 | A08 | API | Proposal owned/assigned to other users | Cross-user GET and review | 403 or 404; no proposal data |
| T09 | A09 | API | Student session; valid supervisor | Submit at title 5/100 and description 20/2000 boundaries | 201; `SUBMITTED`, correct session student and timestamps |
| T10 | A10 | Unit | Request schema | Validate below/above limits, missing/invalid IDs and invalid assignee | Validation rejects invalid inputs; no insert in API counterpart |
| T11 | A11 | API | Student has submitted proposal | Submit another | 409 BR-01; unchanged records |
| T12 | A12 | API | Student has approved proposal | Submit another | 409 BR-01 |
| T13 | A13 | API | Student has rejected-only history | Submit new valid proposal | 201, new `SUBMITTED` record |
| T14 | A14 | API | Supervisor session | POST proposals | 403; no record created |
| T15 | A15 | API | Assigned Supervisor; submitted proposal; available capacity | Approve without comment | 200; approved and reviewed timestamp set |
| T16 | A16 | API | Assigned Supervisor; submitted proposal | Reject with 10+ non-whitespace chars | 200; rejected, comment and timestamp persisted |
| T17 | A17 | API | Assigned Supervisor; submitted proposal | Reject with missing/blank/short comment | 400; state unchanged |
| T18 | A18 | API | Assigned Supervisor; submitted proposal | Approve with comment | 200; comment persisted |
| T19 | A19 | API | Supervisor at capacity; submitted proposal | Approve | 409 with explicit capacity error; proposal unchanged |
| T20 | A20 | API | Other supervisor session | Review proposal assigned elsewhere | 403 or 404; no private data |
| T21 | A21 | API | Already decided proposal | Review again | 409 BR-04; original decision unchanged |
| T22 | A22 | API | Student session; submitted proposal | POST review | 403; no state change |
| T23 | A09, A23 | API + e2e | Seeded Student; valid Supervisor available | Log in, submit valid proposal, reload dashboard, open own detail | Submission persists as SUBMITTED; own detail/history appears; no other students’ data |
| T24 | A15, A17, A24 | API + e2e | Seeded assigned Supervisor; submitted assigned proposal; capacity available | Log in, load queue, attempt reject without valid comment, observe validation error, then approve and reload | Missing/short reject comment is blocked without state change; approved result persists and appears in assigned list; own workload is shown |
| T25 | A25 | API | Mixed users/assignments | Query scoped lists | No records outside principal's scope |
| T26 | A26 | API + e2e | Student session; seeded supervisors | Load supervisor picker | Safe names and non-negative remaining capacity only |
| T27 | A27 | e2e | Data view in empty/loading/error/success conditions | Exercise each state | Correct state feedback visible for each data view |
| T28 | A28 | API + e2e | Student and Supervisor sessions | Inspect role UI then directly call forbidden endpoint | Forbidden action hidden; API returns 403 |
| T29 | A29 | API/DB integration | Empty test database; seed env supplied | Run seed and inspect records | 3 Students, 2 Supervisors, varied proposal states, capacity 5; no plaintext password |
| T30 | A30 | API/DB integration | Seeded test DB | Run seed twice and inspect logs/counts | Stable counts/identities; no duplicate records or password output |
| T31 | A31 | API | No auth cookie | Exercise all protected routes | 401 and no private data |
| T32 | A32 | DB integration | Seeded synthetic user | Inspect persisted credential field | bcrypt hash present; plaintext absent |
| T33 | A33 | API | Trigger validation, conflict, and unexpected error paths | Inspect JSON responses | No stack trace or SQL text |
| T34 | A34 | Unit/manual documented check | Final palette tokens known | Calculate contrast for text/button pairs | Recorded ratios meet 4.5:1 |
| T35 | A35 | Manual | Local seeded environment | Time representative auth/list/detail/submit/review calls | Record method, conditions, latency; typical values <500 ms |

### Product Definition of Done (DoD)

- Approved contracts cover F-01–F-05 and BR-01–BR-06.
- Every AC A01–A35 has a mapped test specification T01–T35.
- On implementation, run planned tests and report actual failures/skips/results honestly; no results are asserted by this document.
- Real login/logout/me, roles, and all backend rule/ownership checks are implemented as specified.
- The required UI states and role-appropriate screens are present; contrast and manual timing evidence are recorded.
- Additive migrations, idempotent synthetic seed, env-only secrets, health/ready endpoints, and production-serving configuration meet the brief; deployment itself remains out of scope.
- Documentation and README are current; known gaps and integration/review evidence are disclosed.
- No secrets appear in Git, logs, or screenshots.

## 13. Review decisions requested

1. Approve or amend this Sprint 1 scope, requirements, and AC/test mapping before implementation.
2. Confirm the permitted inaccessible-resource response policy (403 or 404); both are currently accepted.
3. Confirm whether “Deliverable 1” requires any course-specific artifact beyond the supplied CPMS project brief.

## Part F — Working Sprint 1 and verification record

Part F is an execution record and must be filled only from actual implementation and observed output. The required outcome is a working Sprint 1 release with a complete domain journey through UI, API/application layer and database; a login screen and related authentication code; real login/logout/current-user identity; two roles; a meaningful transaction and business-rule rejection; persisted retrieval; automated domain/persistence/access checks; the two selected UI/E2E journeys described in T23 and T24; and reviewed integration to `main`.

Do not mark F complete by copying the planned criteria as results. When implementation is authorized, record:

- Local setup summary and repository URL; immutable release tag/commit.
- Build/test commands, tested commit, actual test names/files, pass/fail/skip counts and relevant output.
- AC → planned TEST ID → actual test name/file → actual result table.
- Captions for normal journey/persisted retrieval, rule rejection, login/logout and forbidden access (feature/AC IDs, role, starting condition, steps, expected and actual result).
- Two short excerpts from actual automated tests (one domain rule, one role/ownership) with execution results; preserve failing-before/fixed-after evidence for TDD.
- Selected Issues, branch/PR/reviewer and review evidence, staging integration and release history; both students' contributions and brief AI-use declaration.
- Known limitations and all failed/skipped tests. No real credentials or secrets in the PDF or repository.

The final submitted PDF must include complete Parts A–E and selected Part F evidence directly, with a contents/navigation table and actual page ranges. These source documents do not substitute for the self-contained PDF. The program, tests, Git workflow, release, screenshot evidence, PDF, and actual results remain future work.

