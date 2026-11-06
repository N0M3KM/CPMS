# CPMS Feature Inventory (Part B)

**Version:** 1.0 (draft for review)
**Related:** [SRS](srs.md) · [Traceability](traceability.md) · [Sprint plan](sprints/plan.md)

| ID | Feature | Description | Requirements | Depends on | Sprint |
|---|---|---|---|---|---:|
| F-01 | Authentication and current user | Login screen, bcrypt check, expiring DB session in a cookie, logout, `me`. | FR-01, NFR-01, NFR-02, NFR-03 | F-06 | 1 |
| F-02 | Role and ownership enforcement | Session-derived identity, role checks, ownership and assignment checks, safe errors. | FR-02, BR-05, BR-06, NFR-01, NFR-03 | F-01 | 1 |
| F-03 | Submit proposal | Student picks a supervisor and submits a bounded title and description; one active proposal rule. | FR-03, BR-01, BR-06, NFR-03 | F-01, F-02, F-05 supervisor picker | 1 |
| F-04 | Review proposal | Assigned Supervisor approves or rejects once; comment and capacity rules. | FR-04, BR-02, BR-03, BR-04, BR-06, NFR-03 | F-01, F-02, F-03 | 1 |
| F-05 | Scoped views and workload | Student own list and detail; Supervisor queue, detail, workload; supervisor picker; UI states. | FR-05, BR-05, NFR-04, NFR-05 | F-01, F-02 | 1 |
| F-06 | Foundation and seed | Prisma schema, additive migration, env handling, test DB, health and ready endpoints, idempotent seed. | FR-06, NFR-02, NFR-06 | none | 1 |
| F-07 | Milestones and progress | Participants record and view progress on an approved proposal. | FR-07 | Sprint 1 | 2 |
| F-08 | Project discussion | Participants post and read comments on an approved proposal. | FR-08 | Sprint 1 | 2 |
| F-09 | Administrative management | Admin manages assignment and users. Needs an approved admin role. | FR-09 | Sprint 1, role decision | 3 |
| F-10 | Search and filter | Find only permitted proposal records. | FR-10, BR-05 | Sprint 1 | 3 |
| X-01 | Cross-cutting: Docker, CI/CD, GCP deployment | Containerize, pipeline, Cloud Run, Cloud SQL, Secret Manager. | NFR-06 | Sprints 1 to 3 | Lab 5 |

F-07 to F-10 are proposed and unapproved. X-01 is a named system responsibility, not a Sprint feature.

## Feature order inside Sprint 1

F-06 first, then F-01, then F-02, then F-05 (supervisor picker and read paths), then F-03, then F-04. See the [Sprint 1 plan](sprints/sprint-1/plan.md).
