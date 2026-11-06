# CPMS Traceability (Part B)

**Version:** 1.0 (draft for review)
**Related:** [SRS](srs.md) · [Features](features.md) · [Sprint 1 STS](sprints/sprint-1/sts.md)

Test IDs are planned identifiers. No test file exists or has run yet.

## Requirement to feature to sprint and verification

| Requirement | Feature | Sprint | AC | Test |
|---|---|---:|---|---|
| FR-01 | F-01 | 1 | AC-01 to AC-04 | TEST-01 to TEST-04 |
| FR-02 | F-02 | 1 | AC-05 to AC-08 | TEST-05 to TEST-08 |
| FR-03 | F-03 | 1 | AC-09, AC-10, AC-14 | TEST-09, TEST-10, TEST-14 |
| FR-04 | F-04 | 1 | AC-15, AC-16, AC-18, AC-20 to AC-22 | TEST-15, TEST-16, TEST-18, TEST-20 to TEST-22 |
| FR-05 | F-05 | 1 | AC-23 to AC-28 | TEST-23 to TEST-28 |
| FR-06 | F-06 | 1 | AC-29, AC-30 | TEST-29, TEST-30 |
| BR-01 | F-03 | 1 | AC-11 to AC-13 | TEST-11 to TEST-13 |
| BR-02 | F-04 | 1 | AC-19 | TEST-19 |
| BR-03 | F-04 | 1 | AC-16, AC-17, AC-18 | TEST-16 to TEST-18 |
| BR-04 | F-04 | 1 | AC-20, AC-21 | TEST-20, TEST-21 |
| BR-05 | F-02, F-05 | 1 | AC-07, AC-08, AC-25 | TEST-07, TEST-08, TEST-25 |
| BR-06 | F-02 | 1 | AC-06, AC-14, AC-22 | TEST-06, TEST-14, TEST-22 |
| NFR-01 | F-02 | 1 | AC-05, AC-31 | TEST-05, TEST-31 |
| NFR-02 | F-01, F-06 | 1 | AC-32 | TEST-32 |
| NFR-03 | F-02 | 1 | AC-33 | TEST-33 |
| NFR-04 | F-05 | 1 | AC-34 | TEST-34 |
| NFR-05 | F-05 | 1 | AC-35 | TEST-35 |
| NFR-06 | F-06, X-01 | 1, Lab 5 | AC-29, AC-30 (env only) | TEST-29, TEST-30; clean-clone run |
| NFR-07 | F-02, F-03, F-04 | 1 | AC-36 | TEST-36 (SEC cases in the [security plan](security-test-plan.md)) |
| NFR-08 | F-02 | 1 | AC-37 | TEST-37 (SEC cases in the [security plan](security-test-plan.md)) |
| NFR-09 | F-01 | 1 | AC-38 | TEST-38 (SEC cases in the [security plan](security-test-plan.md)) |
| NFR-10 | F-01, F-02 | 1 | AC-39 | TEST-39 (SEC cases in the [security plan](security-test-plan.md)) |
| NFR-11 | F-02, F-05 | 1 | AC-40 | TEST-40 (SEC cases in the [security plan](security-test-plan.md)) |
| NFR-12 | F-06, F-02 | 1 | AC-41 | TEST-41 (SEC cases in the [security plan](security-test-plan.md)) |
| FR-07 | F-07 | 2 | Not yet written | Not yet written |
| FR-08 | F-08 | 2 | Not yet written | Not yet written |
| FR-09 | F-09 | 3 | Not yet written | Not yet written |
| FR-10 | F-10 | 3 | Not yet written | Not yet written |

Later-sprint rows need a feature and sprint now, not elaborated AC or tests.

## End-to-end journeys

| Journey | Covers | Test |
|---|---|---|
| Student logs in, submits, reloads, sees saved proposal | FR-01, FR-03, FR-05, BR-01, BR-05 | TEST-23 |
| Supervisor logs in, invalid reject blocked, then approves, sees workload | FR-01, FR-04, FR-05, BR-03 | TEST-24 |

## Coverage gaps

- FR-07 to FR-10 and F-07 to F-10 are proposed only; no AC or tests until a sprint is authorized.
- `group_work_specs.docx` was not available; theme requirements may add rows (SRS D-07).
- NFR-05 needs its measurement environment recorded when run.

## Approved changes

Approved 2026-11-06: NFR-07 to NFR-12 (security) in Sprint 1, and uniform 404 for inaccessible proposals (SRS D-05). Renaming `A01..A35` / `T01..T35` to `AC-01..AC-35` / `TEST-01..TEST-35` is an editorial change, noted in the [Sprint 1 version history](sprints/sprint-1/sts.md#version-history).
