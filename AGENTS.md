# CPMS Project Guide for Agents

Read this file before changing the project. These instructions combine the team's working rules with CPMS-specific requirements. Follow the user's current request within these boundaries; if two requirements conflict, state the conflict and use the user's newest explicit direction unless it would violate a safety or approval gate below.

## 1. Project and team

- Project: CPE 334 Course Project Management System (CPMS).
- Developers: Drarun Yookphan (67070501016, GitHub display name `N0M3KM`) and Jinnakan Chaviengpob (67070501010, GitHub display name `Jinnakan`). Both must understand the requirements, tests, design decisions, and released behavior.
- Product problem (Theme 6): milestone work, deadlines and feedback are tracked through chat and spreadsheets, so teams miss deadlines and supervisors cannot see team progress.
- Sprint 1 actors: Student and Supervisor. A Supervisor creates milestones for supervised teams and records feedback. A Student team member submits title, description and link for a team milestone and reads feedback. Teams, membership and accounts are seeded; no self-registration or password recovery.
- Sprint 1 must deliver a working UI -> API/application layer -> PostgreSQL journey, including a Login screen and related authentication code.
- Current documentation layout:
  - `docs/srs.md`, `docs/features.md`, `docs/traceability.md`, `docs/system-sds.md` — product-level Parts A–C.
  - `docs/sprints/plan.md` — three-sprint plan (Part D).
  - `docs/sprints/sprint-<number>/plan.md` — that sprint only; `F-<nn>-*.md` feature contracts and `sts.md` tests/DoD.
  - `docs/README.md` — documentation index.
- The root `AGENTS.md` is the repository-wide rulebook. Do not copy the full project roadmap or workflow rules into individual sprint specifications; link here where needed.

## 2. Stack and project conventions

- Client: React + TypeScript + Vite, React Router, plain CSS variables or CSS modules.
- Server: Node + Express + TypeScript; Zod at request boundaries.
- Database: PostgreSQL + Prisma; migrations are additive.
- Verification: Vitest unit tests; Vitest + Supertest API/database integration tests on a separate test database; 1–2 Playwright end-to-end journeys.
- Auth: bcrypt password hashes; database-backed expiring server session; `httpOnly`, `SameSite=Lax` cookie and `Secure` in production. Backend derives identity and role from the session only.
- Target root commands after implementation exists: `npm run dev`, `npm run build`, `npm test`, `npm run test:e2e`, `npm run db:migrate`, and `npm run db:seed`. Do not claim these commands work until actual command output verifies them.
- Key docs/source locations: `docs/`, `client/`, `server/`, `server/prisma/`, and `server/tests/` (some implementation directories may not exist yet).

## 3. Scope and approval gates

- Keep the three-sprint roadmap in `docs/sprints/plan.md`; an individual sprint plan covers only that sprint.
- Detailed feature contracts are written only for the currently authorized sprint. Later sprint plans/specifications and implementations require separate authorization.
- Do not begin implementation until the user has rechecked and explicitly approved the Sprint 1 plan/specification. Do not silently expand scope; record specification revisions in the visible version history.
- Work in reviewable phases. After a requested documentation/implementation phase, summarize the result and changed files, then stop for the user's review when an approval gate applies.
- Do not push files or changes to GitHub until the user has reviewed the local result and explicitly authorized the push. Do not create/submit/mark-ready/merge PRs or close Issues without explicit authorization. Current authorization is documentation work only.

## 4. GitHub Issues, Kanban, branches, and review (applies to every sprint)

### Issue board

Create all Issues for an authorized sprint before implementation begins. Each Issue links its feature ID, FR/BR/NFR IDs, approved contract, acceptance criteria, dependencies, owner, and test IDs. Add every Issue to the project board in **Backlog**.

Use these columns in this exact order: **Backlog -> Specified -> Started -> PR Review -> Fixing -> Done**.

| Status | Rule |
|---|---|
| Backlog | Issue exists but has not yet been fully understood/specified. |
| Specified | Move only after requirements, contract, dependencies, acceptance criteria, and test expectations are understood. |
| Started | Only the Issue actively being implemented may be in Started. |
| PR Review | Feature PR is open against the matching sprint staging branch and ready for peer review/checks. |
| Fixing | Review changes are requested or checks fail. Fix on the same feature branch, then return the Issue to PR Review. |
| Done | Required checks and acceptance criteria pass, peer review is approved, and the PR is merged into that sprint's staging branch. |

A blocked/paused item keeps its current status and receives a blocker/paused marker with reason, owner, and next action. Resume from that status. Do not add a new status column unless the user explicitly approves it.

### Per-sprint branch policy

Each sprint has its own staging branch; every feature in that sprint is based on and merged into that branch. Branch names:

| Purpose | Branch |
|---|---|
| Released baseline | `main` |
| Sprint 1 integration | `sprint-1-staging` |
| Sprint 2 integration | `sprint-2-staging` |
| Sprint 3 integration | `sprint-3-staging` |
| Sprint 1 F-01 authentication | `feature/01-authentication` |
| Sprint 1 F-02 role/team ownership | `feature/02-role-ownership` |
| Sprint 2 F-08 revisions | `feature/08-revisions` |
| Sprint 3 F-12 search | `feature/12-search` |

Create each sprint staging branch from the preceding accepted release on `main` (Sprint 1 from the agreed project base). Name each feature branch `feature/<two-digit-feature-number>-<short-name>` (for example, `feature/01-authentication`). Create the feature branch from its matching sprint staging branch, and set its PR base to that same staging branch. Review-fix commits stay on the same feature branch. Never send one sprint's feature PR to a different sprint's staging branch.

- No direct pushes or commits to `main` or any sprint staging branch. Feature changes enter staging only through peer-reviewed PRs.
- After sprint integration and acceptance checks, use a separate reviewed release PR from that sprint's staging branch to `main`. Record the tested commit/tag.
- The feature author does not approve their own PR. The peer reviewer records a specific check, finding, question, or reason for approval.
- Use one branch per Issue/feature. Keep PRs focused and include feature/AC IDs, actual tests run, and relevant outputs.
- Never force-push. Do not invent branch names for a user's requested base; inspect the current branches first.
- Before any GitHub push, wait for the user's explicit approval after they have rechecked the local files.

## 5. Test-first, evidence, and security

- For meaningful business rules: write the test first; run it and retain evidence that it fails for the intended reason; implement; rerun and retain passing evidence. Never weaken, skip, or delete a test to make it pass.
- Use unit tests for isolated rules, API/database integration tests for persistence and permissions, and selected E2E journeys for user flows. Report failures and skips honestly.
- Never claim a test, build, review, release, screenshot, or deliverable is complete without actual evidence. Include the command, tested commit where applicable, and output.
- Never create, print, or request real secrets. Use synthetic data. Passwords/keys come from environment variables; commit placeholders only in `.env.example`; keep `.env` ignored.
- Never run `gcloud`, billing, IAM, or database-destroying commands. Before any destructive shell command (including drop/reset/delete/force-push), show the exact command and wait for the user's explicit approval.
- Enforce permissions in the backend. Never trust a client-provided user ID or role. Do not expose password hashes, sessions, stack traces, SQL, or unauthorized proposal data.

## 6. Deliverable 1 checklist

The course submission must be one self-contained PDF with Parts A–F, a contents/navigation table with actual page ranges, both developers' names/IDs, repository URL, and tested release tag/commit. Repository documents do not replace content required directly in the PDF.

- **A — SRS/product scope:** stakeholder problem, actors, inclusions/exclusions, stable FR/BR/NFR IDs, assumptions/decisions.
- **B — Features/traceability:** feature IDs, requirement-to-feature-to-sprint/test mapping, coverage gaps and approved changes.
- **C — System SDS:** stack/architecture, data model, UI/API conventions, role/ownership matrix, authentication, environment/secrets, deployment plan.
- **D — Three-sprint plan:** goals, feature IDs, dependencies, completion outcomes, and Sprint 1 scope.
- **E — Sprint 1 contracts:** feature behavior, ACs, STS mapping every AC, DoD, and version history.
- **F — Working release/evidence:** actual UI/API/DB journey, login/logout, meaningful rejection and forbidden access, build/test outputs, AC-to-test result table, two test excerpts with TDD evidence, Issues/PR review and integration history, contributions, limitations, setup notes, and selected labeled screenshots.

Only Parts A–E can be judged from the current docs. Part F requires real implementation and observed evidence; never fill it with planned or invented results.

## 7. Efficient working behavior

- Think before acting: state material assumptions; if ambiguity changes scope or security, stop and ask rather than silently choosing.
- Prefer the simplest complete solution. Avoid speculative features, abstractions, and adjacent cleanup.
- Make surgical changes: every changed line should serve the request; preserve existing project style and unrelated work.
- For multi-step work, give a short plan and verify each step against the requested outcome.
- Read only relevant files. Use targeted `rg`/`rg --files` searches before broad scans. Do not reread unchanged files or repeat findings.
- Keep updates concise; report changed files and what was checked. When something fails, show the relevant log excerpt and explain the root cause before proposing a fix.
