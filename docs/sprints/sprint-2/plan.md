# Sprint 2 Plan — Milestone Workflow Expansion

**Version:** 1.0 (draft for review)  
**Product:** CPMS, Theme 6  
**Team:** Drarun Yookphan (67070501016), Jinnakan Chaviengpob (67070501010)  
**Related:** [Three-sprint plan](../plan.md) · [Feature inventory](../../features.md) · [SRS](../../srs.md) · [System SDS](../../system-sds.md) · [Traceability](../../traceability.md)

## Version history

| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-11-06 | Initial plan aligned with the team's Theme 6 baseline. |

## Goal and scope

Build on the accepted Sprint 1 release so a team can revise milestone work with history, a supervisor can manage milestones, and grades can be recorded and viewed according to an agreed policy. Retain the Student and Supervisor roles, team-scoped access, persistent UI/API/database journey and security foundation. F-08 to F-10 are proposed; detailed contracts and implementation require separate authorization.

| Feature | Requirement | Planned outcome | Dependencies |
|---|---|---|---|
| F-08 Revisions and resubmission | FR-08 | Team resubmits under an agreed policy; earlier submissions and associated feedback remain available as history. | Sprint 1 F-04 submission, F-05 feedback and F-07 views; revision policy decision. |
| F-09 Milestone management | FR-09 | Supervisor edits or closes a supervised team's milestone and adjusts deadlines under agreed rules. | Sprint 1 F-03, F-07 and team authorization; lifecycle decision. |
| F-10 Grades | FR-10 | Supervisor assigns a grade with feedback; permitted users see it under the agreed visibility rule. | F-05 feedback, F-08 revision history and grading decisions. |

## Work packages and integration

1. Confirm the Sprint 1 release and review UAT and defect status. Agree the policies below; record changes to requirements and design for review.
2. Once authorized, prepare each feature's Issue, contract and test specification before implementation. Link requirements, rules, dependencies and verification.
3. Plan F-08 history and migration. Sprint 1 enforces one submission per milestone and immutable feedback; changes to BR-01, BR-02, BR-05 and unique constraints must be explicitly specified, preserve existing records and handle concurrency safely.
4. Plan F-09 changes to milestones, including effects of deadline changes and closure on submissions and history. F-09 can be prepared alongside F-08 after shared policies are decided.
5. Plan F-10 after agreeing its relationship to revisions and feedback. Preserve the association between a grade, its intended submission or feedback and the team.
6. Integrate the features and record verification and release evidence. Both developers participate in requirements, design, testing, implementation and peer review; assign individual owners and reviewers when Issues are prepared.

## Verification and completion

Plan rule tests first, then unit, API/database and selected end-to-end checks. Cover authorized and unauthorized access, cross-team privacy, deadline boundaries, concurrent revisions, persistence and history preservation, grade visibility, and interactions between changed deadlines and submissions. Regress Sprint 1 journeys and applicable NFR-01 to NFR-12. Later contracts define detailed test IDs and expectations; retain actual commands, results, tested commits, failures and peer-review evidence.

Completion requires integrated and reviewed F-08 to F-10, relevant passing checks, documented defects and traceability, and an accepted release using `sprint-2-staging` and [AGENTS.md](../../../AGENTS.md). Deliverable 2 also requires Sprint 1 continuity, a deployed integrated release candidate, and documented Sprint 3 progress and remaining work. Record actual evidence rather than assuming completion.

## Decisions, risks and exclusions

- Agree who can resubmit, limits and deadlines, revision ordering, feedback association and how the current revision is identified.
- Agree when milestones can be edited or closed, how deadline changes affect existing work, and whether closure permits revisions.
- Agree grade scale, association with revisions and feedback, visibility, correction policy and authorization.
- Preserve team isolation and existing data during migration. Confirm ambiguous decisions with the instructor/TA where necessary.
- F-11 and F-12 belong to Sprint 3. Labs 5–7 are cross-cutting course work with separate evidence.
