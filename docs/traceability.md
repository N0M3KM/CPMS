# CPMS Traceability (Part B)

**Version:** 2.1 (Sprint 1 baseline)
**Related:** [SRS](srs.md) · [Features](features.md) · [Sprint 1 STS](sprints/sprint-1/sts.md) · [Security test plan](security-test-plan.md)

`TEST-nn` verifies `AC-nn` one to one for AC-01 to AC-41; TEST-42 and TEST-43 are end-to-end browser journeys. Test files exist for every row; observed results, the actual test names and any gaps are in Part F of the submission and in `docs/sprints/sprint-1/evidence/`.

## Requirement to feature to sprint and verification

| Requirement | Feature | Sprint | AC | Test |
|---|---|---:|---|---|
| FR-01 | F-01 | 1 | AC-01 to AC-04 | TEST-01 to TEST-04 |
| FR-02 | F-02 | 1 | AC-08 to AC-11 | TEST-08 to TEST-11 |
| FR-03 | F-03 | 1 | AC-17 to AC-20 | TEST-17 to TEST-20, TEST-42 |
| FR-04 | F-04 | 1 | AC-21, AC-22, AC-26 | TEST-21, TEST-22, TEST-26, TEST-42 |
| FR-05 | F-05 | 1 | AC-27, AC-28, AC-31, AC-32 | TEST-27, TEST-28, TEST-31, TEST-32, TEST-43 |
| FR-06 | F-06 | 1 | AC-33, AC-34 | TEST-33, TEST-34 |
| FR-07 | F-07 | 1 | AC-35 to AC-38, AC-41 | TEST-35 to TEST-38, TEST-41, TEST-42, TEST-43 |
| BR-01 | F-04 | 1 | AC-23 | TEST-23 |
| BR-02 | F-04 | 1 | AC-24 | TEST-24 |
| BR-03 | F-03 | 1 | AC-17, AC-18, AC-19 | TEST-17 to TEST-19 |
| BR-04 | F-04 | 1 | AC-21, AC-22, AC-25 | TEST-21, TEST-22, TEST-25 |
| BR-05 | F-05 | 1 | AC-27 to AC-30 | TEST-27 to TEST-30 |
| BR-06 | F-02, F-07 | 1 | AC-10, AC-11, AC-35, AC-36 | TEST-10, TEST-11, TEST-35, TEST-36 |
| BR-07 | F-02 | 1 | AC-09, AC-20, AC-26, AC-31 | TEST-09, TEST-20, TEST-26, TEST-31 |
| NFR-01 | F-02 | 1 | AC-08 | TEST-08 |
| NFR-02 | F-01 | 1 | AC-05 | TEST-05 |
| NFR-03 | F-02 | 1 | AC-12 | TEST-12 |
| NFR-04 | F-07 | 1 | AC-39 | TEST-39 |
| NFR-05 | F-07 | 1 | AC-40 | TEST-40 |
| NFR-06 | F-06, X-01 | 1, Lab 5 | AC-33, AC-34 (env only) | TEST-33, TEST-34; clean-clone run |
| NFR-07 | F-02 | 1 | AC-13 | TEST-13 (SEC-01, 02, 04, 11, 12) |
| NFR-08 | F-02 | 1 | AC-14 | TEST-14 (SEC-03) |
| NFR-09 | F-01 | 1 | AC-06 | TEST-06 (SEC-07, 09, 10) |
| NFR-10 | F-01, F-02 | 1 | AC-07 | TEST-07 (SEC-08, 16) |
| NFR-11 | F-02 | 1 | AC-15 | TEST-15 (SEC-05, 06, 13, 14, 15) |
| NFR-12 | F-02, F-06 | 1 | AC-16 | TEST-16 (SEC-17, 18, 19, 20) |
| FR-08 | F-08 | 2 | Not yet written | Not yet written |
| FR-09 | F-09 | 2 | Not yet written | Not yet written |
| FR-10 | F-10 | 2 | Not yet written | Not yet written |
| FR-11 | F-11 | 3 | Not yet written | Not yet written |
| FR-12 | F-12 | 3 | Not yet written | Not yet written |

Later-sprint rows need a feature and sprint now, not elaborated AC or tests.

## End-to-end journeys

| Journey | Covers | Test |
|---|---|---|
| Supervisor logs in, creates a milestone; student logs in, submits, reloads, sees the saved submission | FR-01, FR-03, FR-04, FR-07, BR-03, BR-04, BR-06 | TEST-42 |
| Supervisor tries invalid feedback (blocked), records valid feedback; student sees it; another team does not | FR-05, FR-07, BR-05, BR-06 | TEST-43 |

## Coverage gaps

- FR-08 to FR-12 and F-08 to F-12 are proposed only; no AC or tests until a sprint is authorized.
- SRS decisions D-05 to D-08, D-10 to D-13 are proposed answers to Theme 6 ambiguities and need instructor or TA confirmation.
- NFR-05 needs its measurement environment recorded when run.

## Version note

2.1 (2026-11-07): status text updated after implementation; no requirement, rule or acceptance-criteria change.

## Approved changes

- 2026-11-06: NFR-07 to NFR-12 approved for Sprint 1.
- 2026-11-06: Domain reworked from proposal approval to Theme 6 (teams, milestones, submissions, feedback). All FR, BR, AC and TEST IDs renumbered; recorded in each document's version history.
