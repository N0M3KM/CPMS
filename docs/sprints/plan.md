# CPMS Three-Sprint Plan (Part D)

**Version:** 2.2 (Sprints 2 and 3 proposed, approval pending, 2026-11-25)
**Related:** [Features](../features.md) · [Traceability](../traceability.md) · [Sprint 1 plan](sprint-1/plan.md)

## Version history

| Version | Date | Change |
|---|---|---|
| 2.2 | 2026-11-25 | Sprint 2 and Sprint 3 proposed with detailed contracts (F-08 to F-12) and decisions D-16 to D-23; approval from Drarun and the instructor or TA is pending. F-12 is the Sprint 3 feature implemented for Deliverable 2; F-11 has a contract only. Staging branches follow AGENTS.md: `sprint-3-staging` is cut after the Sprint 2 release. |
| 2.1 | 2026-11-07 | Status updated after Sprint 1 implementation; no requirement, rule or acceptance-criteria change. |
| 2.0 | 2026-11-06 | Reworked for Theme 6; Sprint 2 and 3 allocation follows the theme's later-sprint list. |
| 1.0 | 2026-11-06 | Initial (proposal domain, superseded). |

## Sprint overview

| Sprint | Goal | Features | Depends on | Completion outcome | Checkpoint |
|---|---|---|---|---|---|
| 1 | Small deployable product: auth, team-scoped access, and the milestone to submission to feedback slice | F-06, F-01, F-02, F-07, F-03, F-04, F-05 | none | Supervisor creates a milestone for a supervised team. A team member submits work and reads it back after reload. A late or duplicate submission is rejected. The supervisor records feedback; the team sees it. Another team sees nothing. | Deliverable 1, 8 Nov |
| 2 (proposed 2026-11-25, approval pending) | Core expansion of milestone workflows | F-08 revisions and history, F-09 milestone management, F-10 grades | Sprint 1 release on `main` | Teams can revise within a policy with history preserved; supervisors manage milestones; grades follow a visibility rule. Integrated and tested. | Deliverable 2, 29 Nov |
| 3 (proposed 2026-11-25, approval pending) | Completion and hardening | F-11 progress board and reports, F-12 search and filter, X-01 deployment, regression and defect fixes | Sprint 2 | Remaining features complete, failure handling and usability polished, regression suite green, released. | Progress 29 Nov, complete 13 Dec |

Together the sprints cover every baseline requirement (FR-01 to FR-12) in the [SRS](../srs.md). Sprints 1, 2 and 3 now have detailed contracts: [Sprint 2](sprint-2/plan.md) (F-08, F-09, F-10) and [Sprint 3](sprint-3/plan.md) (F-11 contract, F-12 contract and implementation). Status stays planned until a test result and a deployed release exist.

## Dependencies

Inside Sprint 1: F-06, then F-01, F-02, F-07, then F-03, F-04, F-05. Sprint 2 needs the accepted Sprint 1 release. F-10 needs F-05 and F-08. Sprint 3 needs Sprint 2 data. Docker, CI/CD and GCP deployment (X-01) land in Lab 5 on 15 Nov, before Deliverable 2, and are maintained afterwards.

## Sprint 1 scope and feasibility

Sprint 1 meets the Theme 6 minimum: authentication, authorization, UI to API to database persistence, one real transaction chain (create milestone, submit, feedback) and tested business rules (one submission, deadline, link validation, feedback comment, ownership). It has seven features, 41 acceptance criteria and two end-to-end journeys. Two owners review each other's work.

Out of scope: self-registration, password recovery, grades, revisions, milestone editing, file upload, notifications, admin UI, Docker, CI/CD, GCP.

## Branching

Each sprint has a staging branch; every feature branch comes from and returns to it, per [AGENTS.md](../../AGENTS.md). Sprint 1 integrates on `sprint-1-staging`, then a reviewed release PR goes to `main` and is tagged.
