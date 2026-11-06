# F-06 Foundation and synthetic seed

**Owner:** Jinnakan 1010 · **Reviewer:** Drarun 1016 · **Requirements:** FR-06, NFR-02, NFR-06 · **Depends on:** none

## Behavior and workflow

Provides the base the other features run on: monorepo layout (`client/`, `server/`), Prisma schema and additive migration, environment loading, a separate test database, health and ready endpoints, and an idempotent seed.

Seed content: 3 Students, 2 Supervisors (capacity 5), and proposals in `SUBMITTED`, `APPROVED` and `REJECTED` states, including one supervisor close to capacity and one student with rejected-only history. Passwords come from `SEED_STUDENT_PASSWORD` and `SEED_SUPERVISOR_PASSWORD`, are hashed with bcrypt, and are never printed.

Idempotency: seed uses upserts keyed on unique email and fixed proposal keys, so running twice changes nothing.

## UI and API

No UI. Endpoints: `GET /api/health` returns 200 without touching the DB; `GET /api/ready` returns 200 only when the DB answers, otherwise 503 with a generic body.

## Data and commands

Migration creates `User`, `Session`, `Proposal`, enums and constraints (see [system SDS](../../system-sds.md)). Target root commands once implemented: `npm run db:migrate`, `npm run db:seed`, `npm run dev`, `npm run build`, `npm test`, `npm run test:e2e`. These are not claimed to work until real output shows it.

`.env.example` lists the variables in the SDS with placeholders only.

## Acceptance criteria

- **AC-29:** The seed on an empty test DB creates 3 Students, 2 Supervisors, proposals in several states, capacity 5, with credentials taken only from environment variables.
- **AC-30:** Running the seed twice duplicates nothing and prints no password values.

Tests: TEST-29, TEST-30, plus TEST-32 (shared with F-01) in the [STS](sts.md).
