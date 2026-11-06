# F-01 Authentication and current user

**Owner:** Drarun 1016 · **Reviewer:** Jinnakan 1010 · **Requirements:** FR-01, NFR-01, NFR-02, NFR-03, NFR-09, NFR-10 · **Depends on:** F-06

## Behavior and workflow

A seeded user enters email and password. The server lowercases the email, finds the user, compares the bcrypt hash, creates an expiring session and sets a cookie. `me` returns the session user. Logout revokes the session. An expired or revoked session gives 401 on protected routes.

Rules and failures:
- Wrong email or wrong password return the same generic 401 and create no session. An unknown email still runs a dummy bcrypt compare so timing matches.
- Malformed bodies, non-string email or password, and unknown fields return 400.
- Redirect and `next` query parameters are ignored. Redirect fields in the JSON body are unknown fields and return 400. The UI routes by the returned role.
- A new session ID is issued on every login; a session cookie sent with the login request is revoked, never reused (no fixation).
- After 5 failed attempts from the same IP or for the same normalized email within 15 minutes, return 429 with `Retry-After`. The same rule applies to unknown emails. The API limits each IP to 100 requests per minute, excluding health and readiness probes.
- No self-registration, recovery or "user exists" endpoint.

## UI

Login screen with labeled email and password fields, inline validation, pending, error and success states, visible focus. Success routes to the Student or Supervisor home by role.

## API

| Call | Request | Success | Errors |
|---|---|---|---|
| `POST /api/auth/login` | JSON `{email, password}` | 200 `{user:{id,email,name,role}}`, sets cookie | 400, 401 generic, 403 foreign origin, 413 oversized body, 415 unsupported media type, 429 |
| `POST /api/auth/logout` | none | 200, cookie cleared | 401, 403 foreign origin, 429 |
| `GET /api/auth/me` | none | 200 `{id,email,name,role}` | 401, 429 |

Cookie: `httpOnly`, `SameSite=Lax`, `Path=/`, `Secure` in production.

## Data

Uses `User` and `Session` ([system SDS](../../system-sds.md)). The migration for both is shared with F-06.

## Acceptance criteria

- **AC-01:** Valid seeded Student credentials log in, set an `httpOnly` `SameSite=Lax` cookie, and return safe identity and role.
- **AC-02:** Valid seeded Supervisor credentials behave the same with the Supervisor role.
- **AC-03:** Invalid email or password returns generic 401, creates no session, and discloses nothing.
- **AC-04:** `me` returns the session user while valid; after logout or expiry the session cannot reach protected routes (401).
- **AC-05:** The database stores only bcrypt hashes, never plaintext (NFR-02).
- **AC-06:** Login does not reveal registered emails (same status and body with comparable timing), rejects unknown body fields, ignores redirect query parameters, issues a fresh session ID, and rejects tampered cookies (NFR-09).
- **AC-07:** Repeated failed logins and request bursts are throttled with 429 and `Retry-After` (NFR-10).

Tests: TEST-01 to TEST-07 in the [STS](sts.md).
