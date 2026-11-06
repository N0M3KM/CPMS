# CPMS Security Test Plan

**Version:** 0.1 (draft for review)
**Related:** [SRS NFR-07 to NFR-12](srs.md) · [Architecture](architecture.md) · [Sprint 1 STS](sprints/sprint-1/sts.md)

Plan only. No security test exists or has run. IDs `SEC-nn` are planned identifiers.

## 1. Rules of engagement

- Targets are the team's own CPMS on `localhost` with the separate test database and synthetic seeded users only.
- No third-party host, no real credentials, no real data. Brute-force and rate-limit tests run only against the local test instance.
- Automated tests live in `server/tests/security/` (Vitest and Supertest) and run with `npm test`. Manual and tool checks (browser, OWASP ZAP baseline) are recorded separately with command, commit and result.
- A failing security test is reported as a defect, never weakened or skipped to pass.
- Each test states expected safe behavior. Results are recorded only from real runs.

## 2. Applicability

CPMS has no URL-fetching feature, no file upload or download, no template includes and no shell calls. For those classes the plan adds negative tests and code-review gates to prove the hole cannot appear, and re-runs them whenever a feature adds such a capability.

## 3. Test catalog

| ID | Vulnerability | Method and inputs | Expected safe result | Level | Req |
|---|---|---|---|---|---|
| SEC-01 | XSS (stored and reflected) | Submit title, description, review comment with `<script>alert(1)</script>`, `<img src=x onerror=alert(1)>`, `"><svg onload=...>`. Read back through API and UI. Trigger validation and 404 errors with payloads in params. | API returns JSON as data with `application/json`. UI shows the text inert (E2E asserts no dialog or injected node). Error messages do not echo raw input. Code gate: no `dangerouslySetInnerHTML`. | API + E2E | NFR-07 |
| SEC-02 | SQL injection | Payloads (`' OR 1=1--`, `"; DROP TABLE "User";--`, `1 UNION SELECT ...`) in login email and password, proposal fields, `:id`, review comment, query params. | 400, 401 or 404 only. No DB error text, no data returned, tables intact (row counts unchanged). Code gate: no `$queryRawUnsafe` or string-built SQL. | API + review | NFR-07 |
| SEC-03 | CSRF | Send `POST /api/proposals`, `/review`, `/auth/logout` with a valid session cookie and `Origin: https://evil.example`, no Origin, and form-encoded or text/plain bodies. | 403 on bad or missing Origin for state-changing methods; 415 for non-JSON bodies. `GET` never changes state. Cookie has `SameSite=Lax`. | API | NFR-08 |
| SEC-04 | SSRF | No server code fetches user-supplied URLs. Submit URLs (`http://127.0.0.1`, `http://169.254.169.254`, `file:///etc/passwd`) in every text field. | Stored as plain text; no outbound request is made (HTTP client mocked and asserted never called). Code gate: no `fetch`, `axios`, `http.request` in `server/src` outside health checks. | API + review | NFR-07 |
| SEC-05 | IDOR | Student A requests Student B's proposal by ID (GET, review). Supervisor B reviews Supervisor A's proposal. Use valid existing UUIDs. | Same status and body shape as a nonexistent ID (uniform 404 planned; 403 acceptable if uniform). No private field returned. State unchanged. | API | BR-05, AC-08 |
| SEC-06 | BOLA across all endpoints | Table-driven matrix: every endpoint with an object ID x every role x owner and non-owner. | Only owner or assigned supervisor succeeds; every other cell is denied with no data. Matrix is generated from the route list so new routes cannot be forgotten. | API | BR-05 |
| SEC-07 | Username enumeration | Log in with a registered email and wrong password, then an unregistered email. Compare status, body, headers and timing over 30 runs each. | Identical status and body. Timing difference within a set tolerance (unknown users still run a dummy bcrypt compare). No registration, recovery or "user exists" endpoint exists. | API | NFR-09 |
| SEC-08 | Credential brute force | Send repeated wrong passwords for one email, and one wrong password across many emails, from one client. | After the threshold (proposed 5 failures per 15 minutes per IP and email) respond 429 with `Retry-After`. Throttling behaves the same for known and unknown emails. Valid login works after the window. | API | NFR-10 |
| SEC-09 | Login flow flaws | Valid credentials with unanticipated input: extra `role` or `isAdmin` fields; `next` or `redirect` param in query or body; array or object `email` (`{"$ne":null}`); duplicate JSON keys; case and whitespace email variants; login while already logged in; a pre-set session cookie sent with the login request. | Extra fields ignored or 400; no redirect to a supplied URL; non-string values 400; role in response equals DB role; session ID after login differs from any supplied one (no fixation); prior session of that browser revoked or replaced. | API | NFR-09 |
| SEC-10 | Cookie manipulation | Tamper, truncate, swap with another user's ID, add `role=SUPERVISOR` cookie, replay after logout, send expired cookie. Inspect attributes and entropy. | All return 401. Role cookie ignored. Attributes: `httpOnly`, `SameSite=Lax`, `Path=/`, `Secure` when `NODE_ENV=production`. Session ID at least 128 bits of randomness. | API | NFR-09, AC-04 |
| SEC-11 | Directory traversal and file inclusion (LFI, RFI) | Request `/../../.env`, `/%2e%2e/%2e%2e/etc/passwd`, `/..%2f..%2fserver/prisma/seed`, `/static/..%5c`, double-encoded forms against the static asset route. Send `../` and `http://evil/x.php` in `:id` and every string field. | 400 or 404, never file content. Static serving confined to the built client directory, dotfiles denied. Code gate: no `require`, `import()`, `readFile`, `sendFile` with request-derived paths. | API + review | NFR-07 |
| SEC-12 | Command injection | Put `; ls`, `$(id)`, backticks, `\| cat /etc/passwd`, `&& whoami` in all string fields and params. | Stored verbatim or rejected; no command runs, no timing or output change. Code gate: no `child_process`, `exec`, `spawn` in `server/src` or seed. | API + review | NFR-07 |
| SEC-13 | API: mass assignment | `POST /api/proposals` with `status:"APPROVED"`, `id`, `studentId`, `reviewedAt`, `reviewComment`. `POST /review` with extra `supervisorId` or `status`. `POST /auth/login` with `role`. | Strict Zod schemas reject unknown keys with 400 (or ignore them). Stored status is `SUBMITTED`; student ID is from the session; protected fields unchanged. | API | NFR-11 |
| SEC-14 | API: excessive data exposure | Snapshot of top-level and nested keys for every endpoint response, success and error. | Only whitelisted fields. Never `passwordHash`, session ID, other users' emails, internal IDs of unrelated users, stack, SQL. `GET /api/supervisors` returns only `id`, `name`, `remainingCapacity`. | API | NFR-11, AC-26 |
| SEC-15 | API: broken authentication | Call every protected endpoint with no cookie, expired cookie, revoked session, malformed `Authorization` header, and a valid cookie of the wrong role. | 401 for missing or invalid sessions, 403 for wrong role, no private data. `Authorization` headers are not an accepted credential. | API | NFR-01, AC-05 |
| SEC-16 | API: rate limiting | Burst requests on the general API and on write endpoints. | 429 with `Retry-After` after the limit (proposed 100 per minute per IP general; login stricter per SEC-08). Limits do not block normal use in the E2E journeys. | API | NFR-10 |
| SEC-17 | HTTP hygiene | Unsupported methods, wrong `Content-Type`, body over the cap (proposed 10 KB), malformed JSON, deeply nested JSON, oversized query. | 405 or 404, 415, 413, 400 respectively, with the safe error envelope. | API | NFR-03, NFR-12 |
| SEC-18 | Headers, CORS, error leakage | Inspect headers on `/`, `/api/*`, and error responses. Send `Origin` of another site with credentials. Force a 500. | Security headers present (CSP, `X-Content-Type-Options`, `Referrer-Policy`, frame protection), no `X-Powered-By`. CORS allows only the app origin, never `*` with credentials. 500 body is generic (extends TEST-33). | API | NFR-03, NFR-12 |
| SEC-19 | Dependency vulnerabilities | Run `npm audit` for client and server. | No high or critical findings unresolved, or each is documented with a decision. | Command | NFR-12 |
| SEC-20 | Secrets exposure | Scan repo and built client bundle for keys, passwords and `.env` values; confirm `.env` is ignored. | No real secret in Git history or bundle; `.env.example` has placeholders only. | Command + review | NFR-06 |

## 4. Manual and tool checks

- OWASP ZAP baseline scan against the local app with seeded users; record alerts, accepted risks and fixes.
- Browser check of cookies and headers in dev tools for SEC-10 and SEC-18.
- All outputs recorded with command, tested commit and date.

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

Approved 2026-11-06: NFR-07 to NFR-12 are in Sprint 1. Previous note retained for context:

Most baseline protections (generic 401, role checks, ownership, safe errors, no stack or SQL) are already in the Sprint 1 requirements. Rate limiting, Origin checks, strict schemas, security headers and the uniform-404 policy are new and are approved as NFR-07 to NFR-12 in the SRS. They are implemented in F-01 (rate limit, enumeration defense) and F-02 (Origin check, headers, schemas, uniform denial), and `SEC-01` to `SEC-20` are grouped as TEST-36 to TEST-41 in the Sprint 1 test specification.

## Version history

| Version | Date | Change |
|---|---|---|
| 0.2 | 2026-11-06 | NFR-07 to NFR-12 approved; SEC cases grouped as TEST-36 to TEST-41. |
| 0.1 | 2026-11-06 | Initial security test catalog SEC-01 to SEC-20. |
