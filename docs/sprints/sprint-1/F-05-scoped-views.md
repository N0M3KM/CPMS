# F-05 Scoped views and workload

**Owner:** Drarun 1016 · **Reviewer:** Jinnakan 1010 · **Requirements:** FR-05, BR-05, NFR-04, NFR-05 · **Depends on:** F-01, F-02

## Behavior and workflow

Students list and open their own proposals, rejected history included. Supervisors list assigned proposals (pending and decided), open details, and see their approved count and capacity. Students also get a safe supervisor picker with remaining capacity. List queries filter by the session user ID in the database query itself.

Boundary cases: empty list shows an empty state; remaining capacity is never negative; a student's picker response contains no credentials or session data.

## UI

- Student dashboard: current proposal and status, submit form (F-03), history with rejected entries.
- Proposal detail: permitted data only, explicit status, review result and comment.
- Supervisor dashboard: approved count and capacity, pending queue, decided list.
- Every data view has loading, empty, error and success states.

## API

| Call | Access | Response |
|---|---|---|
| `GET /api/supervisors` | Student | `[{id, name, remainingCapacity}]` |
| `GET /api/proposals` | Authenticated | Student: `{proposals:[...]}`. Supervisor: `{proposals:[...], workload:{approved, capacity}}` |
| `GET /api/proposals/:id` | Owner or assigned Supervisor | Proposal object; 403 or 404 otherwise, no private body |

`name` is a display name derived from the seeded user data; if `User` has no name field, the picker shows email local part. Decide in the F-05 PR and update the data model if a `name` column is added.

## Data

No new entities. Read queries only.

## Acceptance criteria

- **AC-23:** Student list returns only own proposals including rejected history; Student can open own detail.
- **AC-24:** Supervisor list returns only assigned pending and decided proposals plus workload count and capacity; Supervisor can open assigned detail.
- **AC-25:** Supervisor list excludes proposals assigned to others; Student list excludes other students' records.
- **AC-26:** The supervisor picker lists safe names and non-negative remaining capacity, with no credentials or session data.
- **AC-27:** Empty list shows an empty state; loading, error and success states exist on every data view.
- **AC-28:** Role-inappropriate actions are hidden in the UI and direct API calls remain denied.
- **AC-34:** Palette token contrasts are documented and body and button text meet 4.5:1.
- **AC-35:** Local seeded response timing is recorded and typical responses are under 500 ms.

Tests: TEST-23 to TEST-28, TEST-34, TEST-35 in the [STS](sts.md).
