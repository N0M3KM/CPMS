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
| FR-08 | F-08 | 2 | AC-44 to AC-54 | TEST-44 to TEST-55 (planned) |
| FR-09 | F-09 | 2 | AC-56 to AC-63, AC-88, AC-89 | TEST-56 to TEST-64, TEST-88, TEST-89 (planned) |
| FR-10 | F-10 | 2 | AC-65 to AC-72, AC-87 | TEST-65 to TEST-72, TEST-87, TEST-90 (planned) |
| FR-11 | F-11 | 3 | AC-73 to AC-78 | TEST-73 to TEST-78 (planned, no code in Deliverable 2) |
| FR-12 | F-12 | 3 | AC-79 to AC-86 | TEST-79 to TEST-86 (planned) |
| BR-08 | F-08 | 2 | AC-44 to AC-50, AC-53, AC-54 | TEST-44 to TEST-50, TEST-53, TEST-54 (planned) |
| BR-09 | F-09 | 2 | AC-56 to AC-63, AC-88, AC-89 | TEST-56 to TEST-63, TEST-88, TEST-89 (planned) |
| BR-10 | F-10 | 2 | AC-65 to AC-72, AC-87 | TEST-65 to TEST-72, TEST-87 (planned) |
| BR-11 | F-12 | 3 | AC-79 to AC-86 | TEST-79 to TEST-86 (planned) |
| Cross-feature | F-08, F-09, F-10 | 2 | none (cross-feature checks) | TEST-91 to TEST-95 (planned) |

BR-01 is revised in SRS 3.0 (unique revision numbers); AC-23 and TEST-23 stay valid because the first-submission route is unchanged. Status columns here say planned until a result exists. The full matrix with actual test names, results and tested commit is built for Deliverable 2 (Part D) from the evidence run.

## End-to-end journeys

| Journey | Covers | Test |
|---|---|---|
| Supervisor logs in, creates a milestone; student logs in, submits, reloads, sees the saved submission | FR-01, FR-03, FR-04, FR-07, BR-03, BR-04, BR-06 | TEST-42 |
| Supervisor tries invalid feedback (blocked), records valid feedback; student sees it; another team does not | FR-05, FR-07, BR-05, BR-06 | TEST-43 |

## Coverage gaps

- FR-08 to FR-12 have AC and planned tests (2026-11-25), but no test has run yet. Nothing is verified until the evidence run records a result.
- F-11 (AC-73 to AC-78) has a contract only and no planned implementation in Deliverable 2.
- SRS decisions D-05 to D-08, D-10 to D-13 and D-16 to D-23 are proposed answers to ambiguities and need instructor or TA confirmation (D-16 to D-23 also need Drarun's confirmation).
- NFR-05 needs its measurement environment recorded when run; F-12 adds a timing check to the remaining work.

## Version note

3.0 (2026-11-25): added FR-08 to FR-12 AC and planned tests, BR-08 to BR-11, cross-feature checks. BR-01 revised. 2.1 (2026-11-07): status text updated after implementation; no requirement, rule or acceptance-criteria change.

## Approved changes

- Pending, not yet approved (proposed 2026-11-25): Sprint 2 and Sprint 3 requirements FR-08 to FR-12, BR-08 to BR-11 and decisions D-16 to D-23; BR-01 revised; milestone status gains CLOSED; team progress gains `closed`. Recorded in the [change register](sprints/sprint-2/change-register.md) (BASE-01 to BASE-06).
- 2026-11-06: NFR-07 to NFR-12 approved for Sprint 1.
- 2026-11-06: Domain reworked from proposal approval to Theme 6 (teams, milestones, submissions, feedback). All FR, BR, AC and TEST IDs renumbered; recorded in each document's version history.
