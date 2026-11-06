# Local API latency (TEST-40, NFR-05)

Date: 2026-11-07 00:04 +07. Machine: Apple M3, macOS 15.6.1, Node v24.14.0. Server and PostgreSQL 15 container on the same machine, seeded development database, no load. Command: node --env-file=.env scripts/measure-latency.mjs

| Call | Samples | Median ms | p95 ms | Max ms |
|---|---:|---:|---:|---:|
| GET /api/auth/me | 15 | 8.8 | 29.0 | 29.0 |
| GET /api/teams (student) | 15 | 18.9 | 33.4 | 33.4 |
| GET /api/teams (supervisor) | 15 | 18.4 | 26.9 | 26.9 |
| GET /api/teams/:id | 15 | 18.4 | 28.5 | 28.5 |
| GET /api/milestones/:id | 15 | 15.6 | 29.5 | 29.5 |
| POST /api/teams/:id/milestones | 15 | 20.5 | 30.1 | 30.1 |
| POST /api/milestones/:id/submission (first 201, then 409) | 15 | 17.4 | 22.0 | 22.0 |
