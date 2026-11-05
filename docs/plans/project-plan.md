# CPMS Project Plan (Sprints 1–3)

**Status:** Draft for review  
**Project name:** Course Project Management System (CPMS)  
**Course:** CPE 334  
**Planning boundary:** Product-level scope across Sprints 1–3. Detailed Sprint 1 work is in [Sprint 1 plan](../sprints/sprint-1/plan.md). No calendar schedule or effort estimates are included.

## Planning basis

The supplied CPMS brief defines the product behavior, actors, stack, and Sprint 1 domain rules. The course deliverable requires a whole-product baseline and a working, tested Sprint 1 release. Sprint 1 implementation is paused until the user approves its plan and specification. Sprint 2 and 3 scope below is candidate planning only and does not authorize detailed specification or implementation.

## Team

| Name | Student ID | GitHub display name |
|---|---:|---|
| Drarun Yookphan | 67070501016 | [N0M3KM](https://github.com/N0M3KM) |
| Jinnakan Chaviengpob | 67070501010 | [Jinnakan](https://github.com/Jinnakan) |

Both developers share responsibility for understanding the requirements, tests, design decisions, and released behavior. Sprint 1 feature ownership and peer review are recorded in the [Sprint 1 plan](../sprints/sprint-1/plan.md).

## Product requirements baseline

### Functional requirements

| ID | Requirement | Planned allocation |
|---|---|---|
| FR-01 | Existing seeded users can log in with email/password, log out, retrieve current-user identity, and use an expiring session. | Sprint 1 — F-01 |
| FR-02 | Protected operations enforce role and record ownership using identity and role derived from the server session. | Sprint 1 — F-02 |
| FR-03 | A Student can submit a proposal assigned to a selected Supervisor. Title length is 5–100 characters; description length is 20–2000 characters. | Sprint 1 — F-03 |
| FR-04 | Only the assigned Supervisor can approve or reject a `SUBMITTED` proposal; review comment and approval-capacity rules apply. | Sprint 1 — F-04 |
| FR-05 | Students can list/read only their own proposals; Supervisors can list/read only assigned proposals and see their own workload/capacity. | Sprint 1 — F-05 |
| FR-06 | A repeatable, idempotent seed provides synthetic Student/Supervisor accounts and proposal records in multiple states. | Sprint 1 — F-06 support |

The supplied CPMS baseline maps all in-scope functional requirements to Sprint 1. Candidate features in Sprints 2–3 expand the product and remain unapproved until separately specified.

### Business requirements and rules

| ID | Rule |
|---|---|
| BR-01 | A Student may have at most one active proposal (`SUBMITTED` or `APPROVED`). Rejected-only history permits a new submission. Enforce safely under concurrent submissions. |
| BR-02 | Do not approve a proposal when the assigned Supervisor's approved proposal count is at capacity (seeded default 5); return an explicit 409 conflict and leave the proposal unchanged. |
| BR-03 | Rejection requires a comment with at least 10 non-whitespace characters. Approval comment is optional. Invalid rejection returns 400 without changing the proposal. |
| BR-04 | Only the assigned Supervisor may review, and only while the proposal is `SUBMITTED`. A second decision is rejected with 409. |
| BR-05 | Students read only proposals with their session user ID as `studentId`; Supervisors read only proposals with their session user ID as `supervisorId`. Cross-user requests return 403 or privacy-safe 404 without private data. |
| BR-06 | Students may submit but may not review; Supervisors may review assigned proposals but may not submit. Enforce in the backend. |

Stable rule definitions and implementation outcomes are specified in the [Sprint 1 specification](../sprints/sprint-1/specification.md).

### Non-functional requirements

| ID | Requirement and measurable target | Verification | Sprint |
|---|---|---|---:|
| NFR-01 | Protected endpoints reject unauthenticated requests with 401 and return no private data. | API test | 1 |
| NFR-02 | Passwords are stored only as bcrypt hashes; plaintext is absent from persistence. | DB integration test | 1 |
| NFR-03 | Error responses expose no stack traces or SQL. | API test across validation, conflict, and unexpected error paths | 1 |
| NFR-04 | Body and button text contrast is at least WCAG AA 4.5:1 for the selected token pairs. | Record palette token contrast calculations | 1 |
| NFR-05 | Typical API responses are under 500 ms on local seeded data. | Record measured latency and conditions for representative endpoints | 1 |

## Product goals

- Give students a clear proposal submission and status history.
- Let supervisors review only proposals assigned to them and see their own workload.
- Enforce identity, role, ownership, proposal lifecycle, and capacity on the backend.
- Deliver a reproducible, tested local application with a login screen and a complete proposal journey for Sprint 1.

## Actors

| Actor | Product responsibility | Data boundary |
|---|---|---|
| Student | Submit a proposal, select a supervisor, track status and history. | Reads only proposals where their authenticated user ID is `studentId`. |
| Supervisor | Review assigned proposals and inspect queue/workload. | Reads/reviews only proposals where their authenticated user ID is `supervisorId`. |
| Anonymous visitor | Authenticate with an existing seeded account. | No protected data or operations. |

Self-registration, password recovery, and admin UI are excluded from Sprint 1. Any future admin role requires an explicit later decision and specification.

## Product feature roadmap

| ID | Feature | Planned sprint | Dependencies | Outcome |
|---|---|---:|---|---|
| F-01 | Authentication and current user: login, logout, session expiry, `me` | 1 | Seeded accounts, Session data | Existing users can establish and revoke an expiring server-side session; UI shows a Login screen. |
| F-02 | Role-based access and ownership checks | 1 | F-01 | Backend derives user/role from session and enforces permissions and data ownership. |
| F-03 | Submit project proposal | 1 | F-01, F-02, supervisor directory | Student submits a valid proposal assigned to a selected supervisor. |
| F-04 | Review proposal: approve or reject | 1 | F-01, F-02, F-03 | Assigned supervisor makes one valid decision subject to comment and capacity rules. |
| F-05 | View proposals: scoped lists/detail and supervisor workload | 1 | F-01–F-04 | Students view their records; supervisors view assigned queue, decisions, and workload. |
| F-06 | Schema, migrations, synthetic seed, and runtime support | 1 | Fixed stack | Local build, test DB, health/ready, and idempotent sample data support the vertical slice. |
| F-07 (candidate) | Milestones and project progress tracking | 2 | Approved Sprint 1 identity and project records | Student and supervisor can see agreed progress state/history. Workflow and requirements remain to be defined. |
| F-08 (candidate) | Project comments or discussion history | 2 | F-01, F-02, project records | Authorized participants can review project discussion history. Exact access/retention rules remain to be defined. |
| F-09 (candidate) | Administrative user/assignment management | 3 | Approved role and assignment model | Authorized administrative operation only if the team approves the role and scope. |
| F-10 (candidate) | Search and filter permitted project records | 3 | F-01, F-02, proposal/project records | Users find only records they are entitled to see. |

F-07–F-10 are candidates because later-sprint requirements are not detailed in the supplied CPMS brief. Do not treat their descriptions as approved commitments. Each later sprint requires its own reviewed project/sprint plan and specification before work begins.

## Sprint goals and dependencies

| Sprint | Goal | Depends on | Completion outcome |
|---|---|---|---|
| Sprint 1 | Secure proposal lifecycle with UI, API, and persistence | Initial schema and seed; then F-01 → F-02 → F-05/F-03 → F-04 | Student login-submit-reload journey and assigned supervisor review journey work end to end; persisted records are visible only to permitted roles; BR-01–BR-06 pass. |
| Sprint 2 (candidate) | Add progress collaboration to accepted proposal records | Approved Sprint 1 identity, ownership, and proposal model | Approved project can carry progress updates and/or comments with agreed role boundaries and verification. Details require authorization. |
| Sprint 3 (candidate) | Improve operations and permitted-record discovery | Approved Sprint 2 model; explicit administrative permission decision if F-09 retained | Approved operational tasks and search/filter are complete with enforced access boundaries. Details require authorization. |

## Cross-sprint engineering constraints

- Fixed stack: React + TypeScript + Vite; Node + Express + TypeScript; Zod; PostgreSQL + Prisma; Vitest/Supertest; 1–2 Playwright journeys.
- Use additive migrations, synthetic seed records, and environment-only secrets. Keep `.env` ignored and placeholders only in `.env.example`.
- Auth uses bcrypt hashes and a database-backed expiring server session in an `httpOnly`, `SameSite=Lax` cookie (`Secure` in production). Backend identity and role come from that session only.
- Keep feature requirements, rules, acceptance criteria, and tests traceable by stable IDs. Implement business rules test-first and preserve failing-then-passing evidence.
- Apply the repository-wide Issue, Kanban, branch, peer-review, and release workflow in the root `AGENTS.md` on every sprint.
- Every sprint requires user authorization. Future sprint folders/specifications must not be created before authorization.

## Project-level review gates

1. Approve the whole-product baseline and candidate later-sprint scope.
2. Approve the Sprint 1 plan and specification before implementation starts.
3. Review Sprint 1 evidence against actual build/test output and release commit before treating Deliverable 1 as complete.
4. Authorize each later sprint separately before creating its detailed plan/specification or starting work.
