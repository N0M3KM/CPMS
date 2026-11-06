# CPMS Three-Sprint Plan (Part D)

**Version:** 1.0 (draft for review)
**Related:** [Features](../features.md) · [Traceability](../traceability.md) · [Sprint 1 plan](sprint-1/plan.md)

## Version history

| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-11-06 | Moved from `docs/plans/project-plan.md`; added course checkpoints and the Sprint 1 scope explanation. |

## Sprint overview

| Sprint | Goal | Features | Depends on | Completion outcome | Checkpoint |
|---|---|---|---|---|---|
| 1 | Secure proposal lifecycle with UI, API and persistence | F-06, F-01, F-02, F-05, F-03, F-04 | none | Student logs in, submits, reloads and sees the saved proposal. Assigned Supervisor logs in, sees queue and workload, is stopped by an invalid rejection, then decides. Persisted records are visible only to permitted roles. BR-01 to BR-06 pass. | Deliverable 1, 8 Nov |
| 2 (proposed) | Add progress collaboration to approved proposals | F-07, F-08 | Sprint 1 identity, ownership, proposal model | Approved proposals carry progress and discussion with agreed role boundaries and tests. | Deliverable 2, 29 Nov |
| 3 (proposed) | Remaining features, integration, hardening | F-09, F-10, X-01 | Sprint 2 model; admin role decision for F-09 | Remaining features complete, access boundaries enforced, product hardened. | Progress 29 Nov, complete 13 Dec |

Collectively the sprints cover every baseline requirement in the [SRS](../srs.md). Sprints 2 and 3 are candidates until authorized and specified; only Sprint 1 has detailed contracts.

## Dependencies

F-06 to F-01 to F-02 to F-05 to F-03 to F-04 inside Sprint 1. Sprint 2 needs the accepted Sprint 1 release on `main`. Sprint 3 needs Sprint 2 and, for F-09, a decision on whether an admin role exists. Docker, CI/CD and GCP deployment (X-01) land in Lab 5.

## Why Sprint 1 is feasible and what it contains

Sprint 1 is the smallest slice that proves the whole stack and the core rules: login, role enforcement, one real transaction (submit) and one real state transition with rules (review). It has six features and 35 acceptance criteria, two owners with swapped review, and no deployment work. Out of scope: self-registration, password recovery, admin UI, uploads, notifications, milestones, grading, Docker, CI/CD, GCP.

## Branching

Each sprint has a staging branch and every feature branch comes from and returns to it, per [AGENTS.md](../../AGENTS.md). Sprint 1 integrates on the Sprint 1 staging branch, then a reviewed release PR goes to `main`.
