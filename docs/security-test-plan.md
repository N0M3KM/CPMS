# CPMS Security Test Plan

**Version:** 1.0 (draft for review)
**Related:** [SRS NFR-07 to NFR-12](srs.md) · [Architecture](architecture.md) · [Sprint 1 STS](sprints/sprint-1/sts.md)

Plan only. No security test exists or has run. `SEC-nn` are planned identifiers, grouped into TEST-06, 07, 13 to 16 in the STS.

## Version history

| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-11-06 | Reworked for Theme 6 endpoints, fields and users. |
| 0.2 | 2026-11-06 | NFR-07 to NFR-12 approved (proposal domain, superseded). |

## 1. Rules of engagement

- Targets are the team's own CPMS on `localhost` with the separate test database and synthetic seeded users only.
- No third-party host, no real credentials, no real data. Brute-force and rate-limit tests run only against the local test instance.
- Automated tests live in `server/tests/security/` (Vitest and Supertest) and run with `npm test`. Manual and tool checks (browser, OWASP ZAP baseline) are recorded with command, commit and result.
- A failing security test is a defect, never weakened or skipped to pass.
- Results are recorded only from real runs.

## 2. Applicability

CPMS has no server-side URL fetch, no file upload or download, no template includes and no shell calls. The submission `link` is stored as text and never fetched. For SSRF, file inclusion and command injection the plan adds negative tests and code-review gates that prove the hole cannot appear, re-run whenever a feature adds such a capability.

Seed users: Students A1, A2 (Team A), B1 (Team B), C1 (Team C); Supervisors S1 (Teams A and B), S2 (Team C).

## 3. Test catalog

| ID | Vulnerability | Method and inputs | Expected safe result | Level |
|---|---|---|---|---|
| SEC-01 | XSS (stored and reflected) | Put `<script>alert(1)</script>`, `<img src=x onerror=alert(1)>`, `"><svg onload=...>` in milestone title and description, submission title and description, and feedback comment. Read back through API and UI. Put payloads in params to trigger 400 and 404. | API returns JSON as data with `application/json`. UI shows text inert (E2E asserts no dialog or injected node). Error messages do not echo raw input. Code gate: no `dangerouslySetInnerHTML`. | API + E2E |
| SEC-02 | SQL injection | `' OR 1=1--`, `"; DROP TABLE "User";--`, `1 UNION SELECT ...` in login fields, every body field, every `:id` and query param. | 400, 401 or 404 only. No DB error text, no data, row counts unchanged. Code gate: no `$queryRawUnsafe` or string-built SQL. | API + review |
| SEC-03 | CSRF | `POST` milestone, submission, feedback and logout with a valid cookie and `Origin: https://evil.example`, no Origin, and form-encoded or text/plain bodies. | 403 on bad or missing Origin for state-changing methods; 415 for non-JSON. `GET` never mutates. Cookie has `SameSite=Lax`. | API |
| SEC-04 | SSRF and dangerous links | No server code fetches URLs. Submit `link` values `http://127.0.0.1`, `http://169.254.169.254`, `file:///etc/passwd`, `javascript:alert(1)`, `data:text/html,...`, `ftp://x`. | Only valid `http` and `https` links are stored, as text. Other schemes return 400. HTTP client mocked and asserted never called. Code gate: no `fetch`, `axios` or `http.request` in `server/src` outside health checks. UI renders non-http(s) values as text, never as an anchor. | API + review |
| SEC-05 | IDOR | A1 reads, submits to and reads feedback on Team B IDs by valid UUIDs; S2 creates milestone and feedback on Team A IDs. | Same status and body as a nonexistent ID (uniform 404). No private field. State unchanged. | API |
| SEC-06 | BOLA across all endpoints | Table-driven matrix: every endpoint with an object ID x every role x in-scope and out-of-scope team, generated from the route list. | Only in-scope allowed roles succeed; every other cell is 401, 403 or uniform 404 with no data. A new route without a matrix row fails the test. | API |
| SEC-07 | Username enumeration | Login with a registered email and wrong password, then an unregistered email; compare status, body, headers and timing over 30 runs each. | Identical status and body. Timing difference within tolerance (dummy bcrypt for unknown users). No registration, recovery or "user exists" endpoint. | API |
| SEC-08 | Credential brute force | Repeated wrong passwords for one email and one wrong password across many emails. | After 5 failures in 15 minutes from the same IP or for the same normalized email, respond 429 with `Retry-After`. The same rule applies to known and unknown emails. Valid login works after the window. | API |
| SEC-09 | Login flow flaws | Valid credentials with unanticipated input: extra `role` or `isAdmin`; `next` or `redirect` in query or body; array or object `email` (`{"$ne":null}`); duplicate JSON keys; email case and whitespace variants; login while already logged in; a pre-set session cookie sent with login. | Extras rejected (400); no redirect to supplied URL; non-string values 400; response role equals DB role; new session ID differs from any supplied one; prior session revoked. | API |
| SEC-10 | Cookie manipulation | Tamper with or truncate the session ID, add a `role=SUPERVISOR` or `teamId` cookie, replay after logout, or send an expired cookie. Inspect attributes and entropy. | Invalid, revoked and expired session IDs return 401. The server ignores extra cookies and derives identity from the live session, which is a bearer credential. Attributes `httpOnly`, `SameSite=Lax`, `Path=/`, `Secure` in production. Session ID at least 128 bits. | API |
| SEC-11 | Directory traversal, LFI, RFI | `/../../.env`, `/%2e%2e/%2e%2e/etc/passwd`, `/..%2f..%2fserver/prisma/seed`, `/static/..%5c`, double-encoded forms against the static asset route; `../` and `http://evil/x.php` in `:id` and string fields. | 400 or 404, never file content. Static serving confined to the built client dir, dotfiles denied. Code gate: no `require`, `import()`, `readFile` or `sendFile` with request-derived paths. | API + review |
| SEC-12 | Command injection | `; ls`, `$(id)`, backticks, `\| cat /etc/passwd`, `&& whoami` in all string fields and params. | Stored verbatim or rejected; no command runs. Code gate: no `child_process`, `exec`, `spawn` in `server/src` or seed. | API + review |
| SEC-13 | API: mass assignment | `POST` milestone with `createdById`, `teamId`, `id`, `status`; submission with `submittedById`, `submittedAt`, `milestoneId`, `id`; feedback with `supervisorId`, `submissionId`, `createdAt`; login with `role`. | Strict schemas reject unknown keys (400). Stored creator, submitter and supervisor come from the session; team and milestone IDs come from the path. | API |
| SEC-14 | API: excessive data exposure | Snapshot of top-level and nested keys for every endpoint response, success and error. | Only whitelisted fields. Never `passwordHash`, session ID, other users' emails, other teams' members, stack, SQL. Member and supervisor objects are only `{id, name}`. | API |
| SEC-15 | API: broken authentication | Every protected endpoint with no cookie, expired cookie, revoked session, malformed `Authorization` header, and a valid cookie of the wrong role. | 401 for missing or invalid sessions, 403 for wrong role, no private data. `Authorization` headers are not a credential. | API |
| SEC-16 | API: rate limiting | Burst requests on the general API and write endpoints. | 429 with `Retry-After` after 100 requests per minute per IP, excluding health and readiness probes. Limits do not block the E2E journeys. | API |
| SEC-17 | HTTP hygiene | Unsupported methods, wrong `Content-Type`, body over the cap (placeholder 10 KB), malformed and deeply nested JSON. | 405 or 404, 415, 413, 400 respectively, with the safe error envelope. | API |
| SEC-18 | Headers, CORS, error leakage | Inspect headers on `/`, `/api/*`, errors. Send another site's `Origin` with credentials. Force a 500. | Security headers present (CSP, `X-Content-Type-Options`, `Referrer-Policy`, frame protection), no `X-Powered-By`. CORS allows only the app origin, never `*` with credentials. 500 body generic. | API |
| SEC-19 | Dependency vulnerabilities | `npm audit` for client and server. | No unresolved high or critical findings, or each documented with a decision. | Command |
| SEC-20 | Secrets exposure | Scan repo history and built client bundle for keys, passwords, `.env` values; confirm `.env` is ignored. | No real secret; `.env.example` has placeholders only. | Command + review |

## 4. Manual and tool checks

- OWASP ZAP baseline scan against the local app with seeded users; record alerts, accepted risks and fixes.
- Browser dev-tools check of cookies and headers for SEC-10 and SEC-18.
- Outputs recorded with command, tested commit and date.

## 5. Mapping to the requested classes

| Requested | Covered by |
|---|---|
| XSS | SEC-01 |
| CSRF | SEC-03 |
| SSRF | SEC-04 |
| IDOR and BOLA | SEC-05, SEC-06 |
| SQL injection | SEC-02 |
| Broken authentication, username enumeration, brute force, login flaws, cookie manipulation | SEC-07 to SEC-10, SEC-15 |
| File inclusion, LFI, RFI, directory traversal | SEC-11 |
| Command injection | SEC-12 |
| API: mass assignment, excessive data exposure, rate limiting | SEC-13, SEC-14, SEC-16 |

## 6. Scope decision

NFR-07 to NFR-12 are approved for Sprint 1 (2026-11-06). F-01 implements the rate limit and enumeration defense; F-02 implements the Origin check, headers, schemas, uniform 404 and DTO whitelist. SEC cases are grouped in the STS as AC-06, AC-07 and AC-13 to AC-16.
