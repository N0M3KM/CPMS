# F-01 Authentication and current user

**Owner:** Drarun 1016 · **Reviewer:** Jinnakan 1010 · **Requirements:** FR-01, NFR-01, NFR-02, NFR-03 · **Depends on:** F-06

## Behavior and workflow

A seeded user enters email and password. The server finds the user, compares the bcrypt hash, creates an expiring session row and sets a cookie. `me` returns the session user. Logout revokes the session. An expired or revoked session gives 401 on protected routes.

Rules and failures: any wrong email or password returns the same generic 401 and creates no session. Malformed bodies return 400. No self-registration or recovery link exists.

## UI

Login screen with labeled email and password fields, inline validation, pending, error and success states, visible focus. Success routes to the Student or Supervisor dashboard by role.

## API

| Call | Request | Success | Errors |
|---|---|---|---|
| `POST /api/auth/login` | `{email, password}` | 200 `{user:{id,email,role}}`, sets cookie | 400 invalid body; 401 generic |
| `POST /api/auth/logout` | none | 200, cookie cleared | 401 |
| `GET /api/auth/me` | none | 200 `{id,email,role}` | 401 |

Cookie: `httpOnly`, `SameSite=Lax`, `Secure` in production.

## Data

Uses `User` and `Session` from the [system SDS](../../system-sds.md). Migration creates both tables (shared with F-06).

## Acceptance criteria

- **AC-01:** Valid seeded Student credentials log in, set an `httpOnly` `SameSite=Lax` cookie, and return safe identity and role.
- **AC-02:** Valid seeded Supervisor credentials behave the same with the Supervisor role.
- **AC-03:** Invalid email or password returns generic 401, creates no session, and discloses nothing.
- **AC-04:** `me` returns the session user while valid; after logout or expiry the session cannot reach protected routes (401).
- **AC-32:** The database stores only bcrypt hashes, never plaintext.

Tests: TEST-01 to TEST-04, TEST-32 in the [STS](sts.md).
