# Sprint 3 Plan — Progress Visibility and Product Hardening

**Version:** 1.0 (draft for review)  
**Product:** CPMS, Theme 6  
**Team:** Drarun Yookphan (67070501016), Jinnakan Chaviengpob (67070501010)  
**Related:** [Three-sprint plan](../plan.md) · [Feature inventory](../../features.md) · [SRS](../../srs.md) · [System SDS](../../system-sds.md) · [Traceability](../../traceability.md)

## Version history

| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-11-06 | Initial plan aligned with the team's Theme 6 baseline. |

## Goal and scope

Complete progress boards and reports, search and filtering, then integrate, harden and release the product. Build on accepted Sprint 1 and 2 work while preserving team-scoped access and history. F-11 and F-12 are proposed; detailed contracts and implementation require separate authorization.

| Feature | Requirement | Planned outcome | Dependencies |
|---|---|---|---|
| F-11 Progress board and reports | FR-11 | Team and milestone status views and useful summaries within authorized scope. | F-07 scoped views and progress; Sprint 2 milestone and revision semantics. |
| F-12 Search and filter | FR-12, BR-06 | Find permitted teams, milestones and submissions without exposing other teams' records. | F-07 team scope and data from prior sprints. |
| Integration and hardening | Applicable FR, BR and NFR | Resolve defects, improve failure handling and usability, run regression and demonstrate release readiness. | Integrated Sprint 1 and 2 increments; UAT and maintenance results. |

## Work packages and integration

1. Review the Sprint 2 release, open defects, UAT findings, deployment and migration status. Agree report scope and search fields, filters, ordering and pagination.
2. Once authorized, prepare F-11 and F-12 Issues, contracts and test specifications. Define how revisions and adjusted deadlines affect displayed status.
3. Plan F-11 using team-scoped progress data; establish its audience, reporting calculations and treatment of revisions and closed or overdue milestones.
4. Plan F-12 using the same authorization boundary; apply team scope before search, filters, counts and pagination. F-11 and F-12 can proceed in parallel once shared decisions are settled.
5. Integrate all sprint work, address accepted defects, verify usability and failure paths, and maintain a remaining-work and known-debt list. Both developers participate in requirements, design, testing, implementation and peer review; assign owners and reviewers with the Issues.

## Verification and completion

Plan unit and API/database checks for status calculations, report accuracy, search/filter combinations, empty results, pagination and cross-team leakage including counts. Include Student and Supervisor browser journeys, accessibility checks, Sprint 1 and 2 regression, and applicable NFR-01 to NFR-12 security and performance checks. Record actual commands, results, tested commits, CI runs and defect status; detailed AC and test IDs belong in later contracts.

For Deliverable 2, record Sprint 3 contracts and actual working progress, a bounded remaining-work list and the deployed integrated release candidate. Final completion requires all planned features integrated and peer reviewed on `sprint-3-staging`, relevant passing checks, UAT re-tests and known limitations, an accepted release from `main`, deployment evidence, and final report/demo evidence. Follow [AGENTS.md](../../../AGENTS.md).

## Decisions, risks and cross-cutting work

- Agree report audiences, aggregate scope and status calculations, including revisions, closure and deadline changes.
- Agree searchable fields, filter behavior, ordering and limits; prevent unauthorized data and aggregate counts from being exposed.
- Maintain Lab 5 Docker, CI/CD and GCP delivery as X-01; initial delivery is separate from Sprint 3. Record Lab 6 cross-team UAT and re-tests and Lab 7 approved change/regression evidence separately from feature progress.
- Track critical defects, failures, configuration gaps and deployment status. Confirm ambiguous policy with the instructor/TA where necessary.
