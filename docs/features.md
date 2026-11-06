# CPMS Feature Inventory (Part B)

**Version:** 2.0 (draft for review)
**Related:** [SRS](srs.md) · [Traceability](traceability.md) · [Sprint plan](sprints/plan.md)

| ID | Feature | Description | Requirements | Depends on | Sprint |
|---|---|---|---|---|---:|
| F-01 | Authentication and current user | Login screen, bcrypt check, expiring DB session cookie, logout, `me`, login protections. | FR-01, NFR-01, NFR-02, NFR-03, NFR-09, NFR-10 | F-06 | 1 |
| F-02 | Role and team ownership enforcement | Session-derived identity, role guards, team scope, uniform 404, shared security middleware. | FR-02, BR-06, BR-07, NFR-01, NFR-03, NFR-07, NFR-08, NFR-10, NFR-11, NFR-12 | F-01 | 1 |
| F-03 | Create milestone | Supervisor creates a milestone with a due date for a supervised team. | FR-03, BR-03, BR-07 | F-01, F-02, F-07 | 1 |
| F-04 | Submit milestone work | Team member submits title, description and link before the deadline; one per milestone. | FR-04, BR-01, BR-02, BR-04, BR-07 | F-01, F-02, F-03 | 1 |
| F-05 | Supervisor feedback | Supervisor records immutable feedback on a submission of a supervised team. | FR-05, BR-05, BR-07 | F-01, F-02, F-04 | 1 |
| F-06 | Foundation and seed | Schema, migration, env handling, test DB, health and ready, idempotent seed of teams, members, milestones, submissions. | FR-06, NFR-02, NFR-06, NFR-12 | none | 1 |
| F-07 | Scoped views and progress | Team, milestone, submission and feedback views; supervisor team list; computed milestone status. | FR-07, BR-06, NFR-04, NFR-05 | F-01, F-02 | 1 |
| F-08 | Revisions and resubmission | Revision policy with preserved history of submissions and feedback. | FR-08 | Sprint 1 | 2 |
| F-09 | Milestone management | Edit or close milestones, adjust deadlines. | FR-09 | Sprint 1 | 2 |
| F-10 | Grades | Supervisor grade with feedback and a visibility rule. | FR-10 | F-05, F-08 | 2 |
| F-11 | Progress board and reports | Board of teams by milestone status, summary views. | FR-11 | F-07 | 3 |
| F-12 | Search and filter | Find permitted milestones, submissions, teams. | FR-12, BR-06 | F-07 | 3 |
| X-01 | Docker, CI/CD, GCP deployment | Container, pipeline, Cloud Run, Cloud SQL, Secret Manager. | NFR-06 | Sprints 1 to 3 | Lab 5 |

F-08 to F-12 are proposed and unapproved. X-01 is a named system responsibility delivered in Lab 5.

## Feature order inside Sprint 1

F-06, F-01, F-02, F-07 (read paths and team scope), F-03, F-04, F-05. See the [Sprint 1 plan](sprints/sprint-1/plan.md).
