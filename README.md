# CPMS: Course Project Management System

CPE 334 group project, Theme 6. Documentation index: [docs/README.md](docs/README.md). Working rules: [AGENTS.md](AGENTS.md).

Status: Sprint 1 in progress. F-06 (foundation and seed) is implemented on its feature branch. No UI yet.

## Prerequisites

- Node.js 24 and npm 11 (other recent versions probably work; these were used).
- Docker (only for the local PostgreSQL container).

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
| `npm run dev` | Start the API with reload on `PORT` (default 3000). |
| `npm run build` | Type-check and compile the server. |
| `npm test` | Run all tests against `cpms_test` (applies migrations first). |
| `npm run test:unit -w server` | Run only the database-free tests. |
| `npm run db:migrate` | Create and apply a migration on the dev database. |
| `npm run db:seed` | Idempotent synthetic seed. Safe to run repeatedly. |

`GET /api/health` returns 200 without the database. `GET /api/ready` returns 200 only when the database answers.

Tests refuse to run unless `TEST_DATABASE_URL` points at a database whose name ends in `_test`.

## Not yet available

`npm run test:e2e`, the client, authentication and the proposal-free Theme 6 workflows arrive with F-01 to F-07. Docker packaging, CI/CD and GCP deployment are Lab 5.

## Known limitations

- `npm audit` reports 3 high findings, all in `deepmerge-ts` through the Prisma CLI (a dev-time dependency). The suggested fix is a breaking upgrade and has not been applied.
