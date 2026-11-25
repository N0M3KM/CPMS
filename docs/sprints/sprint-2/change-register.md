# CPMS change and defect register (Deliverable 2, Part A)

**Version:** 1.0 · **Date:** 2026-11-25 · **Related:** [Sprint 2 plan](plan.md) · [SRS](../../srs.md) · [Traceability](../../traceability.md) · [Lab 6 UAT cases](../../labs/lab-06/uat-cases.md)

Only recorded facts are listed. A row says resolved only where a merged change and a result exist. "Re-test" names what was actually run.

## Version history

| Version | Date | Change |
|---|---|---|
| 1.1 | 2026-11-25 | BASE-02 and BASE-03 corrected after the foundation was built: no Sprint 1 expected value changed; only lookups and an additive `closed: 0` check. |
| 1.0 | 2026-11-25 | First register: Lab 5 and Lab 6 findings, CI audit fix, and the baseline revisions that Sprint 2 introduces. |

## Findings and fixes

| ID | Source | Affects | Accepted decision | Status | Fix or change release | Re-test outcome |
|---|---|---|---|---|---|---|
| CF-01 | Partner UAT report on CPMS, session 2026-11-21 (commit `b5e8b1e`) | FR-07 scoped views, NFR-01 | Accepted, Minor. Cause: the page loader handled only 404, so a 401 after the session ended showed "Could not load this view." with a Try again that cannot work. | Resolved on `main`. Not confirmed deployed. | PR #47 merged 2026-11-21 (fix commit `48280ef`, merge `94aeba7`) | Failing end-to-end test written first (`e2e/session-ended.spec.ts`), then the fix; passes locally. Live re-test on the deployed candidate: pending (Deliverable 2 T9). |
| O-02 | Partner UAT report | FR-07 | Open: same message as CF-01 when the session has ended; two earlier occurrences had a live session. Log check for 429 or other errors in the partner's session window. | Remaining | none | Log result not yet recorded. |
| O-01 | Partner UAT report | NFR-05 | No change. Likely cold start (the service scales to zero) plus a shared network. | Closed, not measured | none | none |
| O-03 | Partner UAT report | none | No reset of the database. The handoff said data only grows and a reset is destructive. | Closed | none | none |
| DEP-01 | CI dependency audit, fixed in PR #49 (title: "override Effect to patched version for CI audit") | NFR-12 | Accepted | Resolved on `main` | PR #49 merged 2026-11-21 | CI audit step passes on `main`. Re-run on the candidate (T10). |
| L5-01 | `docs/labs/lab-05/deployment.md`, section 11 | NFR-10 | Accepted limitation: the login throttle is in memory and per instance; many users behind one address share the limit. | Remaining (accepted) | none | none |
| L5-02 | `docs/labs/lab-05/deployment.md`, section 11 | NFR-06 | Accepted limitation: the image keeps development dependencies for the migration job (about 800 MB). | Remaining (accepted) | none | none |
| L5-03 | `docs/labs/lab-05/persistence-rollback-runbook.md`, limitations | Delivery (X-01) | Rollback skips the migration job and is safe only while migrations are additive. | Remaining. Sprint 2 changes this: see RISK-01. | none | Rollback mechanism shown on `bfe97b1` to `b5e8b1e` (same file contents). |
| RISK-01 | Sprint 2 migration (T3) | Delivery (X-01), BR-01 | The Sprint 2 migration replaces the unique index on `Submission.milestoneId` with a unique index on (`milestoneId`, `revisionNo`). Code from before Sprint 2 cannot run on that schema. Rollback to a pre-Sprint 2 release is not supported; roll forward only, or restore a database backup. | Open (accepted risk) | planned in `sprint-2-release` | To be recorded in the readiness review. |
| UAT-F1 | Our UAT of the partner product (`docs/labs/lab-06/partner-product-results.md`) | partner product, not CPMS | Observed once from page text, no screenshot. Not reproduced. Not sent. | Remaining, unconfirmed | none | Not reproduced. |
| Lab 7 | `docs/labs` holds Lab 5 and Lab 6 only | none | No Lab 7 record exists at this checkpoint. | none | none | none |

## Baseline revisions (proposed requirement and design changes)

| ID | Revision | Rationale | Approval | Release |
|---|---|---|---|---|
| BASE-01 | BR-01 changes from "one submission per milestone" to "revision numbers are unique per milestone, at most 5 versions" (D-16). The first submission still returns 409 `DUPLICATE_SUBMISSION` on its own route (AC-23 unchanged). | Revisions with history (FR-08) need more than one row per milestone. | Approved 2026-11-25 (Drarun, approving review on PR #59; D-16). TA confirmation not received | `sprint-2-release` (planned) |
| BASE-02 | Team `progress` gains a `closed` count and milestone status gains `CLOSED` (D-18, D-23). No Sprint 1 assertion had to change: `scoped-views-db.test.ts` matches `progress` partially, and `closed: 0` was added to its expectations as a new check. | Milestone close (FR-09) needs a status that is neither overdue nor open. | Part approved 2026-11-25 (D-23, PR #59); the D-18 part is pending (F-09 review) | `sprint-2-release` (planned) |
| BASE-03 | `Milestone.submission` becomes `Milestone.submissions` in the data model; the API field `submission` keeps its Sprint 1 six keys and `revisions[]` is added (D-23). The foundation changed only relation lookups in Sprint 1 tests: `seed.test.ts` reads `submissions`, and `submit-work-db.test.ts` uses `findFirst` instead of `findUnique` on `milestoneId` (two lines). No expected value was changed. | Versioned submissions. | Approved 2026-11-25 (Drarun, approving review on PR #59; D-23) | `sprint-2-release` (planned) |
| BASE-04 | Grades use a separate immutable `Grade` table, not a nullable column on `Feedback` as the architecture note proposed (D-20). `docs/architecture.md` is corrected. | A nullable grade on feedback would break BR-05 (immutable feedback). | Proposed; approval of D-20 pending (F-10 review) | `sprint-2-release` (planned) |
| BASE-05 | Feedback and grades are accepted only on the current revision (D-17, AC-54, AC-87). | One clear target per review. | Approved 2026-11-25 (Drarun, approving review on PR #59; D-17) | `sprint-2-release` (planned) |
| BASE-07 | New optional setting `REQUEST_LIMIT_PER_MINUTE` (default 100, 1 to 100000; production refuses more than 100). The browser journeys together exceed the fixed 100-requests-per-minute limit and failed with 429 (CF-01 timed out on Sign in once the F-08 journeys were added). The default and NFR-10 behavior are unchanged; only the Playwright config raises it. Config tests written first (`evidence/rate-limit-config-red.txt`, `rate-limit-prod-red.txt`). | Keep the journeys reliable as the suite grows. | Merged with PR #59 after Drarun's approving review, 2026-11-25 | `sprint-2-release` (planned) |
| BASE-06 | Decisions D-16 to D-23 are added to the SRS. | Record every proposed choice. | Part approved 2026-11-25 (D-16, D-17, D-23, PR #59); D-18 to D-22 pending | SRS v3.0 |
