# CPMS deployment (Lab 5)

How CPMS is packaged, configured, tested, released and run on Google Cloud. Placeholders such as
`YOUR_PROJECT_ID` are replaced with the team's own values. No real secret appears in this file.

## 1. Observed status and prerequisites

Reviewed on 14 November 2026. CPMS release PR [#35](https://github.com/N0M3KM/CPMS/pull/35) merged to main at `b5e8b1e109c2dfa3c93464405b936280cc2cb560`. The [Deploy demo run](https://github.com/N0M3KM/CPMS/actions/runs/43469048223) succeeded, including tests, build, migration, deployment and smoke checks.

Local prerequisites are Node.js 24, npm 11, Docker with Compose, Python 3 and Chrome for browser tests. Copy `.env.example` to `.env`, fill local values privately, and provide a separate test database. The cloud release requires the configured GitHub `demo` environment and GCP resources.

| Check | Observed evidence |
|---|---|
| C-01 | [Release PR CI](https://github.com/N0M3KM/CPMS/actions/runs/43465760598) passed at `bfe97b1ce6e14182461ed687470f970604e6a3e2`. |
| C-02 | [PR #34](https://github.com/N0M3KM/CPMS/pull/34) failed a required test and was blocked. [Screenshot](https://github.com/N0M3KM/CPMS/issues/26#issuecomment-6859024306). |
| C-03 | [Local verification](evidence/local-verification.txt) records a Docker run on an uncommitted working tree based on `144770cf87008731515859a4a55962981d9ad936`. A clean clone at the release SHA remains unverified. |
| C-04 | [Public app](https://cpms-vxyvatwb4q-as.a.run.app), [UI evidence](https://github.com/N0M3KM/CPMS/issues/37), and the successful deploy smoke check. Confirm the full business journey and access restriction. |
| C-05 | [Issue #28 evidence](https://github.com/N0M3KM/CPMS/issues/28#issuecomment-6860521059) shows the same synthetic record across three revisions and a commit change and return. A separate application restart is not established by that screenshot. |
| C-06 | [Reviewed release PR](https://github.com/N0M3KM/CPMS/pull/35) and [successful deployment](https://github.com/N0M3KM/CPMS/actions/runs/43469048223). Capture the Cloud Run revision and digest for submission. |

## 2. Stack and changes from the reference kit

The reference stack is used unchanged: Artifact Registry, Cloud Run, Cloud SQL for PostgreSQL, Secret
Manager and GitHub Actions. What differs because CPMS is a different application:

| Area | CPMS |
|---|---|
| Repository layout | npm workspaces: `server/` (Express, TypeScript, Prisma, Zod) and `client/` (React, Vite) with one root `package-lock.json` |
| Image | One root `Dockerfile`: stage 1 installs, compiles the server (`tsc`, `server/tsconfig.build.json`) and builds the client; stage 2 copies the compiled server, Prisma schema, seed source, `node_modules` and the built client. Runs as the non-root `node` user on port 3000 |
| Serving | Express serves the API under `/api` and the built client from `client/dist` (single container, same origin). Client routes fall back to `index.html`; dotfiles are never served |
| Sessions | Stored in the database (`Session` table), not in the container, so they survive restarts and redeploys |
| Migration job | A separate Cloud Run job runs `npx prisma migrate deploy && npx tsx src/seed/run.ts` from the same image. Migrations are additive; the seed is idempotent |
| Proxy | `TRUST_PROXY=1` on Cloud Run so the rate limits use the real client address |
| Same-origin check | `ALLOWED_ORIGIN` must equal the public URL; the app refuses to start in production without a valid one |
| Commit on the URL | `GET /api/version` returns the commit baked into the image (`APP_COMMIT` build argument) |
| Smoke test | `deploy/smoke_test.py`: health, readiness, client page, anonymous 401, version, and an optional login check with a seeded student account |
| CI additions | Type-check, `npm audit`, browser journeys (Playwright with Chrome), and a run of the production image against PostgreSQL with the smoke test |

## 3. Environment variables

| Name | Purpose | Secret? | Where the value comes from |
|---|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | Yes | Local: `.env`. Compose: built from `CPMS_DB_PASSWORD`. Cloud Run: Secret Manager `cpms-database-url` (Cloud SQL socket) |
| `TEST_DATABASE_URL` | Separate database for tests; the name must end in `_test` | Yes | Local `.env`; CI: workflow `env` (throw-away value) |
| `CPMS_DB_PASSWORD` | Password of the local PostgreSQL container | Yes | Local `.env` only |
| `SESSION_SECRET` | Session secret, at least 16 characters, required in production | Yes | Local `.env`; Cloud Run: Secret Manager `cpms-session-secret` |
| `SESSION_TTL_HOURS` | Session lifetime in hours (default 8) | No | `.env`; Cloud Run env var |
| `ALLOWED_ORIGIN` | Browser origin allowed for state-changing requests; required in production (https, or http://localhost) | No | Local `.env`; Cloud Run env var set by `deploy/deploy.sh` to the service URL |
| `TRUST_PROXY` | Trusted proxy hops, 0 to 5 (default 0) | No | `.env`; Cloud Run env var `1` |
| `PORT` | Listening port (default 3000) | No | Image sets 3000; `--port 3000` on the service |
| `NODE_ENV` | `development`, `test` or `production`; production turns on the `Secure` cookie and the production checks | No | Image and Cloud Run set `production` |
| `CLIENT_DIST` | Directory of the built client (default `../client/dist` in production) | No | Optional |
| `APP_COMMIT` | Commit of the running image, shown by `/api/version` | No | `docker build --build-arg APP_COMMIT=<sha>` in `deploy.yml` |
| `SEED_STUDENT_PASSWORD`, `SEED_SUPERVISOR_PASSWORD` | Passwords for the seeded demo accounts | Yes | Local `.env`; Cloud Run job: Secret Manager `cpms-seed-student-password`, `cpms-seed-supervisor-password` |
| `SMOKE_EMAIL`, `SMOKE_PASSWORD` | Optional login check in the smoke test (a seeded student); set both or neither | Password: yes | GitHub environment `demo`: variable and secret |
| `EXPECTED_COMMIT` | Commit the smoke test expects `/api/version` to report | No | Set by `deploy.yml` |

`.env.example` lists every variable with placeholders only. `.env` is ignored by Git and by the Docker build.

## 4. Commands

| Task | Command |
|---|---|
| Install | `npm ci` |
| Local database (development) | `docker compose -f compose.dev.yml --env-file .env up -d` |
| Migrate (development) | `npm run db:migrate` |
| Seed (idempotent) | `npm run db:seed` |
| Run in development (API on 3000, client on 5173) | `npm run dev` |
| Type-check | `npm run typecheck` |
| Build server and client | `npm run build` |
| Unit, API and database tests | `npm test` |
| Browser journeys | `npm run test:e2e` |
| Deploy-script tests (no GCP access) | `bash deploy/tests/test_deploy_stub.sh && bash deploy/tests/test_release_stub.sh && python3 -m unittest discover -s deploy/tests -p 'test_smoke.py'` |
| Build the production image | `docker build --build-arg APP_COMMIT=$(git rev-parse HEAD) -t cpms .` |
| Run the whole stack in containers (PostgreSQL, migrate and seed, app on http://localhost:3000) | `docker compose up --build`, then `docker compose down` (add `-v` to delete the data) |
| Smoke test a URL | `python3 deploy/smoke_test.py http://localhost:3000` |

A fresh clone needs only `.env.example` copied to `.env` with local values (C-03):
`cp .env.example .env`, edit the values, `docker compose up --build`.

## 5. GCP resources (names used by the scripts)

| Resource | Name |
|---|---|
| Project | `cpe334-th-014` (one project for Labs 5 to 7 and the final project) |
| Region | `asia-southeast1` |
| Artifact Registry repository and image | `cpms` / `cpms` (`REGION-docker.pkg.dev/PROJECT/cpms/cpms:<commit sha>`) |
| Cloud SQL | instance `cpms-pg` (PostgreSQL 16, enterprise edition, `db-f1-micro`, 10 GB, storage auto-increase off); database `cpms`; user `cpms` |
| Cloud Run service | `cpms` (min instances 0, max 3, 512 Mi, port 3000, public) |
| Cloud Run job | `cpms-migrate` |
| Runtime service account | `cpms-runner` (role `cloudsql.client`; access to each secret one by one) |
| Secrets | `cpms-database-url`, `cpms-session-secret`, `cpms-seed-student-password`, `cpms-seed-supervisor-password` |
| Deploy service account (CI) | `cpms-deployer` |
| GitHub environment | `demo` (deployable from `main` only) |

## 6. First deployment (a team member, Cloud Shell or a terminal)

Create the Free Trial project and the budget alert first (Student Guide Episode 1). Then:

```bash
DRY_RUN=1 PROJECT_ID=YOUR_PROJECT_ID bash deploy/deploy.sh   # read the output
PROJECT_ID=YOUR_PROJECT_ID bash deploy/deploy.sh
```

The script is safe to re-run. It never prints a secret, grants secret access one secret at a time,
runs the migration job before the service, and stops if the job fails. At the end it prints the
service URL. The GCP owner shares demo credentials privately. Keep credentials out of logs and screenshots.

Seed accounts: students `student.a1@example.test` to `student.c2@example.test`, supervisors
`supervisor1@example.test` and `supervisor2@example.test`. Teams A and B are supervised by
supervisor 1, team C by supervisor 2.

## 7. One-time GitHub and Google setup for the pipeline

1. Create the GitHub environment `demo`, allow only `main` to deploy to it, and add the variables
   `GCP_PROJECT_ID`, `GCP_REGION` (`asia-southeast1`), `WIF_PROVIDER` and `WIF_SERVICE_ACCOUNT`
   (`cpms-deployer@YOUR_PROJECT_ID.iam.gserviceaccount.com`). Optional: variable `SMOKE_EMAIL` and secret
   `SMOKE_PASSWORD` (a seeded student account; set both or neither).
2. Enable the IAM Service Account Credentials and Security Token Service APIs, create the deploy
   service account and Workload Identity Federation (keyless login from GitHub). Check the repository's
   OIDC subject format first: `gh api repos/N0M3KM/CPMS/actions/oidc/customization/sub`. Restrict the
   provider to this repository, `main`, the workflow `deploy.yml` and the environment `demo`.
3. Permissions for the deploy account, least privilege: `roles/run.developer` on the project,
   `roles/artifactregistry.writer` on the `cpms` repository only, `roles/iam.serviceAccountUser` on
   `cpms-runner` only. The deploy account never reads Secret Manager.
4. Ruleset for `main` and for the staging branch: enforcement Active, empty bypass list, require a
   pull request with one approval, require the status check `test-and-docker` (selected through Add
   checks), require branches to be up to date. Turn on secret scanning and push protection.
5. Create the label `lab5` and use it on every Lab 5 Issue and Pull Request.

## 8. Release procedure

1. Create an Issue (label `lab5`) and a feature branch from the staging branch (`lab5-staging`).
2. Open a Pull Request into staging. CI (`ci-docker.yml`, job `test-and-docker`) must pass and the
   teammate must approve with a specific review comment. Authors do not approve their own PRs.
3. Merge into staging. When the increment is ready, open a release Pull Request from staging into
   `main`. CI runs again and the teammate reviews.
4. Merge into `main`. `deploy.yml` runs: CI again, then builds the image tagged with the full commit
   SHA, pushes it, reads its digest, runs the migration job, updates Cloud Run to that digest, and
   smoke-tests the public URL (including that `/api/version` reports the same commit).
5. Find the commit that is running, any of:
   - `curl https://YOUR_SERVICE_URL/api/version` returns `{"commit":"<full sha>"}`;
   - the run summary of `Deploy demo` in GitHub Actions shows the image tag and digest;
   - `gcloud run services describe cpms --region asia-southeast1 --format='value(spec.template.spec.containers[0].image)'`
     prints the image digest, which maps to the tag in Artifact Registry.

## 9. Rollback

Actions, Deploy demo, Run workflow on `main`, enter the full 40-character commit SHA of an earlier
release in `image_tag`. Tests, build and migration are skipped; only the service is pointed back at
that image, then smoke-tested. This changes the application image only, not the database, so it works
while the schema is still compatible (migrations are additive: add first, remove later). To roll
forward, run the workflow again with the newer full SHA.

## 10. Cost control and teardown

Cloud SQL is billed for every hour it exists; Cloud Run scales to zero. Create a budget alert before
anything else, keep Cloud Run at max 3 instances, and use the smallest Cloud SQL tier with storage
auto-increase off. After the course: `PROJECT_ID=YOUR_PROJECT_ID bash deploy/teardown.sh` (asks you to
type the project ID, then deletes the service, job, database instance, repository, secrets and runtime
account). Keep the service running until grading ends.

## 11. Known limitations

- The login throttle also limits by IP; behind Cloud Run it uses the real client address (`TRUST_PROXY=1`),
  but many users behind one address share the limit. The limiter is in memory and per instance.
- The image includes development dependencies because the migration job needs the Prisma CLI and
  `tsx` (the image is large, about 800 MB).
- The smoke test's login check needs a seeded student account; it is optional.
- The clean-clone release check and separate application restart evidence remain open, as noted in section 1.


## Issue #24 CI failure evidence

- Passing PR check: [PR #31 run 43438522847](https://github.com/N0M3KM/CPMS/actions/runs/43438522847) tested commit `a2a3628697e248bc7f6df0721137ba4a083c6738`; `test-and-docker` succeeded, including tests, browser journeys, Docker build and image smoke test.
- Passing check for this PR: [PR #32 run 43443048368](https://github.com/N0M3KM/CPMS/actions/runs/43443048368) tested commit `737263e58efb52c7f67ce3f29f1f4251fd3be4db`; `test-and-docker` succeeded after the temporary probe was removed.
- Deliberate failing check: [PR #32 run 43442753199](https://github.com/N0M3KM/CPMS/actions/runs/43442753199) tested commit `8d49503dc3ddc54acda5606e1f7279aa6846a4bc`. The failed step was `Temporary issue`; its log reported `Intentional failure to verify PR check reporting for issue #24` followed by `Process completed with exit code 1`. Later build and test steps were skipped because this probe intentionally stopped the job. The probe was removed in the follow-up commit.
