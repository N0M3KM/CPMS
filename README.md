# CPMS: Course Project Management System

CPE 334 group project, Theme 6. Documentation index: [docs/README.md](docs/README.md). Working rules: [AGENTS.md](AGENTS.md).

Status: Sprint 1 (F-01 to F-07) is implemented and merged into `sprint-1-staging`. Tests, evidence and the release record are described in `docs/sprints/sprint-1/evidence/`.

## Prerequisites

- Node.js 24 and npm 11 (other recent versions probably work; these were used).
- Docker (only for the local PostgreSQL container).
- Google Chrome (only for `npm run test:e2e`; set `E2E_CHANNEL` to use another Playwright channel).

## Setup

```bash
cp .env.example .env
```

Edit `.env` and replace every `change-me...` value with local-only values. Use the same password in `CPMS_DB_PASSWORD`, `DATABASE_URL` and `TEST_DATABASE_URL`. `.env` is git-ignored; never commit it.

```bash
docker compose -f compose.dev.yml --env-file .env up -d
npm install
npm run db:migrate
npm run db:seed
```

The container creates two databases: `cpms_dev` and `cpms_test`. Seed accounts use synthetic `@example.test` emails and the passwords from `SEED_STUDENT_PASSWORD` and `SEED_SUPERVISOR_PASSWORD`.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Start the API on `PORT` (default 3000) and the client at `http://localhost:5173`. |
| `npm run build` | Type-check and build the server and client. |
| `npm test` | Run all tests against `cpms_test` (applies migrations first). |
| `npm run test:e2e` | Run the two browser journeys (TEST-42, TEST-43) against `cpms_test` with the real API and client. Resets and re-seeds `cpms_test`. Ports 3000 and 5173 must be free. |
| `npm run test:unit -w server` | Run only the database-free tests. |
| `npm run db:migrate` | Create and apply a migration on the dev database. |
| `npm run db:seed` | Idempotent synthetic seed. Safe to run repeatedly. |

`GET /api/health` returns 200 without the database. `GET /api/ready` returns 200 only when the database answers.

Open `http://localhost:5173` and sign in as `student.a1@example.test` or `supervisor1@example.test` using the corresponding seed password from `.env`. The Vite dev server proxies `/api` to Express.

Tests refuse to run unless `TEST_DATABASE_URL` points at a database whose name ends in `_test`.

## Not yet available

Docker packaging, CI/CD and GCP deployment are Lab 5.

## Known limitations

- Rate limits are per server process and reset on restart. The local server uses the socket IP and ignores forwarded IP headers.
- `npm audit` reports 3 high findings, all in `deepmerge-ts` through the Prisma CLI (a dev-time dependency). The suggested fix is a breaking upgrade and has not been applied.
