# Sprint 2 Plan — Milestone Workflow Expansion

**Version:** 1.1 (PROPOSED 2026-11-25, approval pending)  
**Product:** CPMS, Theme 6  
**Team:** Drarun Yookphan (67070501016), Jinnakan Chaviengpob (67070501010)  
**Related:** [Three-sprint plan](../plan.md) · [Feature inventory](../../features.md) · [SRS](../../srs.md) · [System SDS](../../system-sds.md) · [Traceability](../../traceability.md)

## Version history

| Version | Date | Change |
|---|---|---|
| 1.3 | 2026-11-26 | F-09 approval recorded (PR #60 review); F-10 approval record opened. |
| 1.2 | 2026-11-25 | F-08 approval record added (requested in the review of PR #59). F-08 is marked implemented and in review; decisions and approvals stay pending until their sources exist. |
| 1.1 | 2026-11-25 | Proposed; approval pending (Drarun, instructor or TA). Policies proposed (SRS D-16 to D-23), contracts F-08 to F-10, test specification and change register added, owners and reviewers assigned. |
| 1.0 | 2026-11-06 | Initial plan aligned with the team's Theme 6 baseline. |

## Goal and scope

Build on the accepted Sprint 1 release so a team can revise milestone work with history, a supervisor can manage milestones, and grades can be recorded and viewed according to an agreed policy. Retain the Student and Supervisor roles, team-scoped access, persistent UI/API/database journey and security foundation. Contracts: [F-08](F-08-revisions.md), [F-09](F-09-milestone-management.md), [F-10](F-10-grades.md); tests and Definition of Done: [sts.md](sts.md); findings and baseline changes: [change-register.md](change-register.md). The contracts and decisions D-16 to D-23 are proposed. Approvals are recorded per feature in the table below, each with its source and date; a status is changed to approved only when its source exists.

| Feature | Owner | Reviewer | Branch | Status |
|---|---|---|---|---|
| Sprint 2 foundation (schema, shared guards, test fixtures) | Jinnakan 1010 | Drarun 1016 | `feature/sprint2-foundation` | planned |
| F-08 Revisions | Jinnakan 1010 | Drarun 1016 | `feature/08-revisions` | merged (PR #59); approved 2026-11-25 |
| F-09 Milestone management | Drarun 1016 | Jinnakan 1010 | `feature/09-milestone-management` | merged (PR #60); approved 2026-11-25 |
| F-10 Grades | Jinnakan 1010 | Drarun 1016 | `feature/10-grades` | implemented, in review; approval pending, see below |

| Feature | Requirement | Planned outcome | Dependencies |
|---|---|---|---|
| F-08 Revisions and resubmission | FR-08 | Team resubmits under an agreed policy; earlier submissions and associated feedback remain available as history. | Sprint 1 F-04 submission, F-05 feedback and F-07 views; revision policy decision. |
| F-09 Milestone management | FR-09 | Supervisor edits or closes a supervised team's milestone and adjusts deadlines under agreed rules. | Sprint 1 F-03, F-07 and team authorization; lifecycle decision. |
| F-10 Grades | FR-10 | Supervisor assigns a grade with feedback; permitted users see it under the agreed visibility rule. | F-05 feedback, F-08 revision history and grading decisions. |

### Approval record for F-08 (decisions D-16, D-17, D-23)

| Who | What | Status | Source and date |
|---|---|---|---|
| Jinnakan | Authorized building Sprint 2, including F-08, and pushing it for review | Given | Chat instructions, 2026-11-25 ("Approve, start", "Lets do deliverable for Sprint 2 and 3", "Yes, push") |
| Drarun | Approval of D-16, D-17, D-23 and of the F-08 implementation | Given | Approving review on PR #59, 2026-11-25 ("I approve the F-08 decisions D-16, D-17 and D-23 and the implementation in this PR"); CI run #21 passed for commit c6bbdc9; PR #59 merged |
| Instructor or TA | Confirmation of D-16 (5 versions in total) and D-17 (feedback only on the current revision) | Not received | The plan asks for it "where necessary"; Drarun approved F-08 without it. Still open for the PDF's list of confirmations |
| Drarun | Approval of the documentation (contracts, specifications, register) | Given | PR #50 approving review, 2026-11-25 (documentation only; implementation approval was kept pending there) |

The status words for F-08 (this plan, the F-08 contract, SRS FR-08, D-16, D-17, D-23, change register BASE-01, BASE-03, BASE-05) were changed to approved on 2026-11-25 with that source.

### Approval record for F-09 (decisions D-18, D-19, D-23)

| Who | What | Status | Source and date |
|---|---|---|---|
| Jinnakan | Authorized building Sprint 2, including F-09, and pushing it for review | Given | Chat instructions, 2026-11-25 ("Lets do F-9") |
| Drarun | Approval of D-18 (close is not reversible; closed blocks edits, first submissions and revisions), D-19 (deadline change rules) and of the F-09 implementation | Given | Approving review on PR #60, 2026-11-25 ("This approval covers the documented F-09 close and deadline policies D-18/D-19 and implementation"); CI run #22 passed for commit 8c038a5; PR #60 merged |
| Drarun | Approval of D-23 (API shape: `closedAt`, `progress.closed`) | Given | Approving review on PR #59, 2026-11-25 |
| Instructor or TA | Confirmation of D-18 and D-19 | Not received | Asked "where necessary"; Drarun approved F-09 without it |

The status words for F-09 (this plan, the F-09 contract, SRS FR-09, D-18, D-19, change register BASE-02) were changed to approved on 2026-11-25 with that source.

### Approval record for F-10 (decisions D-20, D-17, D-23)

| Who | What | Status | Source and date |
|---|---|---|---|
| Jinnakan | Authorized building Sprint 2, including F-10, and pushing it for review | Given | Chat instruction, 2026-11-26 ("Lets do feature 10") |
| Drarun | Approval of D-20 (grade 0 to 100 in its own table, only after feedback on the current revision, immutable, visible to the team and supervisor) and of the F-10 implementation | Pending | His approving review on the F-10 pull request is the record |
| Drarun | Approval of D-17 (current revision only) and D-23 (API shape) | Given | Approving review on PR #59, 2026-11-25 |
| Instructor or TA | Confirmation of D-20 | Not received | Asked "where necessary"; Drarun decides, as for F-08 and F-09 |

The status words for F-10 change to approved, with the review's date, in one commit once the approving review exists.

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
