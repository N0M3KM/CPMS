# F-06 Foundation and synthetic seed

**Owner:** Jinnakan 1010 · **Reviewer:** Drarun 1016 · **Requirements:** FR-06, NFR-02, NFR-06, NFR-12 · **Depends on:** none

## Behavior and workflow

Provides the base the other features run on: repository layout (`client/`, `server/`), Prisma schema and additive migration, environment loading, a separate test database, health and ready endpoints, an injectable clock, and an idempotent seed.

Seed content (all synthetic):
- 2 Supervisors and 6 Students.
- 3 teams of 2 students: Team A and Team B supervised by Supervisor 1, Team C by Supervisor 2.
- Milestones per team covering each status: open `NOT_SUBMITTED`, past-due `OVERDUE`, `SUBMITTED`, and `REVIEWED` with feedback.

Passwords come from `SEED_STUDENT_PASSWORD` and `SEED_SUPERVISOR_PASSWORD`, are hashed with bcrypt, and are never printed. Idempotency: upserts keyed on unique email, team name and fixed milestone keys, so a second run changes nothing.

## UI and API

No UI. `GET /api/health` returns 200 without the DB. `GET /api/ready` returns 200 only when the DB answers, otherwise 503 with a generic body.

## Data and commands

The migration creates `User`, `Session`, `Team`, `TeamMember`, `Milestone`, `Submission`, `Feedback`, enums and constraints (see [system SDS](../../system-sds.md)). Target root commands once implemented: `npm run db:migrate`, `npm run db:seed`, `npm run dev`, `npm run build`, `npm test`, `npm run test:e2e`. They are not claimed to work until real output shows it. `.env.example` lists the SDS variables with placeholders only.

## Acceptance criteria

- **AC-33:** The seed on an empty test DB creates 2 Supervisors, 6 Students, 3 teams with memberships, and milestones, submissions and feedback in each status, with credentials only from environment variables.
- **AC-34:** Running the seed twice duplicates nothing and prints no password values.

Tests: TEST-33, TEST-34 in the [STS](sts.md). Clean-clone setup is checked against the README (NFR-06).
