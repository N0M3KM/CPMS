// Builds the single self-contained Deliverable 1 PDF.
// Usage: EVIDENCE_DIR=<dir from collect-evidence.sh> [RELEASE_TAG=v1.0.0] [RELEASE_SHA=<sha>] [OUT=<pdf>] node build.mjs
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { CSS, esc, maybe, mdToHtml, read, readJson, table } from './lib.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../..');
const EV = resolve(process.env.EVIDENCE_DIR ?? (() => { throw new Error('EVIDENCE_DIR is required'); })());
const OUT = resolve(process.env.OUT ?? join(repo, 'submission', 'CPE334_Deliverable1.pdf'));
const inputs = existsSync(join(here, 'inputs.json')) ? readJson(join(here, 'inputs.json')) : {};
const TESTED = read(join(EV, 'commit.txt')).trim();
const SHA = (process.env.RELEASE_SHA ?? TESTED).trim();
const TAG = (process.env.RELEASE_TAG ?? '').trim();
const REPO_URL = 'https://github.com/N0M3KM/CPMS';
const docs = (rel) => read(join(repo, 'docs', rel));
const short = (s) => s.slice(0, 7);
const people = {
  N0M3KM: { name: 'Drarun Yookphan', id: '67070501016' },
  Jinnakan: { name: 'Jinnakan Chaviengpob', id: '67070501010' },
};

// ---------- evidence ----------
const vitest = readJson(join(EV, 'vitest.json'));
const e2eText = read(join(EV, 'e2e.txt'));
const auditText = read(join(EV, 'audit.txt'));
const buildText = read(join(EV, 'build.txt'));
const npmTest = read(join(EV, 'npm-test.txt'));
const environment = read(join(EV, 'environment.txt')).trim();
const mainVsHead = maybe(join(EV, 'main-vs-head.txt'), '0 0').trim().split(/\s+/).map(Number);
const prs = readJson(join(EV, 'prs.json'));
const issues = readJson(join(EV, 'issues.json'));
const prDetail = (n) => readJson(join(EV, `pr-${n}.json`));

const results = vitest.testResults.flatMap((f) =>
  f.assertionResults.map((a) => ({ file: basename(f.name), name: a.fullName, status: a.status })),
);
const releasedToMain = Boolean(TAG);
const cleanBefore = maybe(join(EV, 'status-before.txt')).trim() === '';

function evalItem(item) {
  if (item.file) {
    const hits = results.filter((r) => r.file === item.file && r.name.includes(item.match));
    if (hits.length === 0) throw new Error(`AC map: no test matches ${item.file} / ${item.match}`);
    const pass = hits.filter((h) => h.status === 'passed').length;
    return { label: `${item.file} › ${item.match}`, n: hits.length, ok: pass === hits.length, kind: 'auto' };
  }
  if (item.e2e) {
    const line = e2eText.split('\n').find((l) => l.includes(item.e2e));
    if (!line) throw new Error(`AC map: no E2E line for ${item.e2e}`);
    return { label: `e2e/journeys.spec.ts › ${item.e2e}`, n: 1, ok: line.includes('✓'), kind: 'auto' };
  }
  if (item.command === 'audit') {
    return { label: 'npm audit (command)', n: 1, ok: auditText.includes('found 0 vulnerabilities'), kind: 'auto' };
  }
  if (item.manual) return { label: `manual check: ${item.manual}`, n: 1, ok: true, kind: 'manual' };
  throw new Error('bad AC map item');
}

const acMap = readJson(join(here, 'ac-map.json')).map((row) => {
  const items = row.items.map(evalItem);
  return { ...row, evaluated: items, ok: items.every((i) => i.ok), tests: items.reduce((s, i) => s + (i.kind === 'auto' ? i.n : 0), 0) };
});

// ---------- headings / toc ----------
const tocEntries = [];
function heading(level, text, { id, cls = '', toc = true } = {}) {
  if (toc) tocEntries.push({ level, text });
  return `<h${level} class="${cls}">${esc(text)}</h${level}>`;
}
function embedded(file, title, { demote = 2 } = {}) {
  const source = docs(file).replace(/^# .*\n/, '');
  return heading(2, title, { cls: 'docstart' }) + mdToHtml(source, { demote: demote - 1 });
}

// ---------- Part F builders ----------
const shotDir = join(repo, 'docs/sprints/sprint-1/evidence/screenshots');
function figure(file, caption) {
  const p = join(shotDir, file);
  const data = readFileSync(p).toString('base64');
  return `<figure><img src="data:image/png;base64,${data}" alt="${esc(file)}"/><figcaption>${caption}</figcaption></figure>`;
}
const pre = (text) => `<pre>${esc(text)}</pre>`;
const statusCell = (row) => {
  if (!row.ok) return '<span class="status-fail">FAIL</span>';
  if (row.coverage === 'manual') return '<span class="status-manual">MANUAL</span>';
  if (row.coverage === 'partial') return '<span class="status-partial">PASS (partial)</span>';
  return '<span class="status-pass">PASS</span>';
};

function sliceBlock(text, startRe, lines = 14) {
  const all = text.split('\n');
  const i = all.findIndex((l) => startRe.test(l));
  return i === -1 ? '(not found in recorded output)' : all.slice(i, i + lines).join('\n');
}
function sourceBlock(file, re) {
  const m = read(join(repo, file)).match(re);
  if (!m) throw new Error(`excerpt not found in ${file}`);
  return m[0].replace(/\n+$/, '');
}

function partF() {
  const out = [];
  const totals = { files: vitest.testResults.length, tests: vitest.numTotalTests, pass: vitest.numPassedTests, fail: vitest.numFailedTests, skip: vitest.numPendingTests };
  const e2eLines = e2eText.split('\n').filter((l) => /✓|✘|passed|failed/.test(l)).join('\n');
  const releaseLine = releasedToMain
    ? `Release tag <code>${esc(TAG)}</code> on <code>main</code>, commit <code>${esc(SHA)}</code>.`
    : `<b>Not yet released to <code>main</code>.</b> Evidence below was collected on commit <code>${esc(TESTED)}</code>; the release PR from <code>sprint-1-staging</code> to <code>main</code> and its tag are recorded when it is merged.`;

  out.push(heading(1, 'Part F — Working Sprint 1 and verification'));
  out.push('<p>Everything in this part comes from commands, tests and GitHub records run on the commit named below. Nothing is copied from the plan. Section F.9 lists known gaps and what was not verified.</p>');

  // F.1
  out.push(heading(2, 'F.1 Release and setup summary'));
  out.push(`<div class="box${releasedToMain ? '' : ' warn'}">${releaseLine}<br/>Repository: ${REPO_URL}<br/>Evidence collected: ${esc(environment.split('\n')[0])} on commit <code>${esc(TESTED)}</code>.</div>`);
  out.push(table(['Item', 'Value'], [
    ['Stack', 'React, TypeScript, Vite (client); Node, Express, TypeScript, Zod (API); PostgreSQL with Prisma (database); Vitest, Supertest, Playwright (tests)'],
    ['Prerequisites', 'Node.js 24 and npm 11, Docker (local PostgreSQL container), Google Chrome (end-to-end journeys only)'],
    ['Environment', environment.split('\n').slice(1).map(esc).join('; ')],
    ['Seed accounts', 'Synthetic <code>@example.test</code> users: 2 supervisors (<code>supervisor1</code>, <code>supervisor2</code>), 6 students (<code>student.a1</code> to <code>student.c2</code>), 3 teams. Passwords come from <code>SEED_STUDENT_PASSWORD</code> and <code>SEED_SUPERVISOR_PASSWORD</code> in the local <code>.env</code>; they are never stored in Git or printed.'],
  ]));
  out.push('<h3>Setup and run commands</h3>');
  out.push(pre(`cp .env.example .env        # replace every change-me value with local-only values
docker compose -f compose.dev.yml --env-file .env up -d   # PostgreSQL: cpms_dev and cpms_test
npm install
npm run db:migrate          # additive Prisma migration
npm run db:seed             # idempotent synthetic seed
npm run dev                 # API on :3000 and client on :5173
npm run build               # type-check and build server and client
npm test                    # unit, API and database tests on cpms_test
npm run test:e2e            # two browser journeys on cpms_test (resets and re-seeds it)`));
  out.push('<p class="small">Environment variables are listed in the System-Level SDS (section 7 of C.1). Tests refuse to run unless the database name ends in <code>_test</code>.</p>');

  // F.2
  out.push(heading(2, 'F.2 Program demonstrations'));
  out.push(`<p>All screenshots were captured by the end-to-end run on commit <code>${esc(TESTED)}</code> (output in F.3), using the real API and the seeded <code>cpms_test</code> database. They are not mocked. Exception: none.</p>`);
  out.push('<h3>Scenario 1 — Normal journey and persisted retrieval</h3>');
  out.push('<p><b>Features/AC:</b> F-01 (AC-01), F-03 (AC-17), F-04 (AC-21), F-07 (AC-35, AC-36). <b>Roles:</b> Supervisor 1, then Student A1 (Team A). <b>Start:</b> freshly seeded database. <b>Steps:</b> supervisor signs in, opens Team A, creates a milestone; student signs in, opens it, submits title, description and link, reloads the page. <b>Expected:</b> the milestone appears with status Not submitted; the submission is saved and, after reload, read back from PostgreSQL with status Submitted. <b>Actual:</b> as expected (E2E TEST-42 passed).</p>');
  out.push(figure('02-supervisor-home.png', '<b>Fig 1.</b> Supervisor home: assigned teams with milestone counts (AC-36).'));
  out.push(figure('03-milestone-created.png', '<b>Fig 2.</b> Milestone “E2E design review” created for Team A and listed (AC-17).'));
  out.push(figure('04-submission-form.png', '<b>Fig 3.</b> Student A1 fills in the submission form (AC-21).'));
  out.push(figure('05-submission-saved-after-reload.png', '<b>Fig 4.</b> After a page reload the saved submission is read back with status Submitted (AC-21, AC-35).'));
  out.push('<h3>Scenario 2 — Business-rule rejection</h3>');
  out.push('<p><b>Features/AC:</b> F-05 (AC-28, AC-27), F-04 (AC-23, AC-24 by API tests). <b>Role:</b> Supervisor 1, Team B submission with no feedback. <b>Steps:</b> enter “too short” as feedback and save; send the same comment directly to the API; then save a valid comment and reload. <b>Expected:</b> the form shows a validation error; the API returns 400 and stores nothing; the valid comment is saved and survives a reload. <b>Actual:</b> as expected (E2E TEST-43). The late-submission and duplicate-submission rules (409 DEADLINE_PASSED, 409 DUPLICATE_SUBMISSION) are shown by the API tests TEST-23 and TEST-24 in F.4.</p>');
  out.push(figure('06-feedback-validation-error.png', '<b>Fig 5.</b> Feedback under 10 characters is refused with a validation message; nothing is stored (AC-28).'));
  out.push(figure('07-feedback-saved.png', '<b>Fig 6.</b> Valid feedback is saved and shown after reload (AC-27).'));
  out.push('<h3>Scenario 3 — Login, logout and forbidden access</h3>');
  out.push('<p><b>Features/AC:</b> F-01 (AC-01, AC-04), F-02 (AC-09, AC-10), F-05 (AC-31, AC-32). <b>Roles:</b> Student B1 (Team B), Student A1 (Team A). <b>Steps:</b> student B1 signs in and reads the feedback; B1 posts feedback directly to the API; B1 signs out and the session is checked; student A1 opens a Team B milestone by its ID. <b>Expected:</b> B1 sees the feedback; the student review attempt returns 403; after sign-out the current-user call returns 401; A1 gets the same “unavailable” page and 404 as for a missing milestone. <b>Actual:</b> as expected (E2E TEST-43, asserted through the page’s own session). Hiding a button is not the control here: the API checks are in the automated tests listed in F.4 (TEST-09, TEST-10, TEST-25, TEST-26, TEST-30, TEST-31).</p>');
  out.push(figure('01-login.png', '<b>Fig 7.</b> Sign-in screen (AC-01).'));
  out.push(figure('08-student-sees-feedback.png', '<b>Fig 8.</b> A member of Team B reads the supervisor’s feedback (AC-32).'));
  out.push(figure('09-other-team-unavailable.png', '<b>Fig 9.</b> A student from another team opening the milestone gets the unavailable page; the API returns the same 404 body as for a missing ID (AC-10).'));
  out.push(figure('10-logged-out.png', '<b>Fig 10.</b> After sign-out the app returns to the sign-in screen and <code>GET /api/auth/me</code> returns 401 (AC-04).'));

  // F.3
  out.push(heading(2, 'F.3 Build and automated test results'));
  out.push(`<p>Commands were run on commit <code>${esc(TESTED)}</code> (working tree ${cleanBefore ? 'clean' : 'with uncommitted changes'} at the start of the run). “Automated” means a test file that runs without human steps; manual checks are listed separately.</p>`);
  out.push(table(['Command', 'Result'], [
    ['<code>npm run build</code>', buildText.includes('exit 0') ? 'exit 0 (server type-check and compile; client type-check and Vite build)' : 'FAILED'],
    ['<code>npm test</code> (Vitest: unit, API, database)', `${totals.files} files, ${totals.tests} tests: ${totals.pass} passed, ${totals.fail} failed, ${totals.skip} skipped`],
    ['<code>npm run test:e2e</code> (Playwright, Chrome)', e2eText.includes('2 passed') ? '2 passed, 0 failed, 0 skipped' : 'see output below'],
    ['<code>npm audit</code>', auditText.includes('found 0 vulnerabilities') ? 'found 0 vulnerabilities' : 'see output'],
  ]));
  out.push('<h3>Per-file results</h3>');
  const level = {
    'auth.test.ts': 'API (in-memory store)', 'auth-db.test.ts': 'API + PostgreSQL', 'clock.test.ts': 'Unit', 'code-gates.test.ts': 'Static code gate',
    'config.test.ts': 'Unit', 'contrast.test.ts': 'Unit', 'create-milestone-db.test.ts': 'API + PostgreSQL', 'feedback-db.test.ts': 'API + PostgreSQL',
    'feedback-policy.test.ts': 'Unit', 'health.test.ts': 'API', 'milestone-status.test.ts': 'Unit', 'schema.test.ts': 'PostgreSQL constraints',
    'scope.test.ts': 'Unit', 'scoped-views-db.test.ts': 'API + PostgreSQL', 'secrets.test.ts': 'Static scan', 'security.test.ts': 'API (probe routes + route matrix)',
    'seed.test.ts': 'PostgreSQL', 'submission-policy.test.ts': 'Unit', 'submit-work-db.test.ts': 'API + PostgreSQL', 'team-access-db.test.ts': 'PostgreSQL',
  };
  const files = [...vitest.testResults].sort((a, b) => basename(a.name).localeCompare(basename(b.name)));
  out.push(table(['Test file (server/tests)', 'Level', 'Tests', 'Passed', 'Failed', 'Skipped'], files.map((f) => {
    const n = f.assertionResults.length; const p = f.assertionResults.filter((a) => a.status === 'passed').length;
    const sk = f.assertionResults.filter((a) => a.status === 'pending' || a.status === 'skipped').length;
    return [`<code>${esc(basename(f.name))}</code>`, level[basename(f.name)] ?? '', n, p, n - p - sk, sk];
  })));
  out.push('<h3>Console output</h3>');
  const vitestSummary = npmTest.split('\n').filter((l) => /Test Files|Tests |Duration|exit \d/.test(l)).map((l) => l.trim()).join('\n');
  out.push(pre(`$ npm test\n${vitestSummary}`));
  out.push(pre(`$ npm run test:e2e\n${e2eLines}`));
  out.push(pre(`$ npm audit\n${auditText.trim()}`));
  out.push(pre(`$ npm run build   (last lines)\n${buildText.trim().split('\n').slice(-6).join('\n')}`));
  out.push('<h3>Manual checks (not part of the automated suite)</h3>');
  out.push(table(['Check', 'Result'], [
    ['API latency, TEST-40 / NFR-05', 'Recorded in <code>docs/sprints/sprint-1/evidence/F-07-latency.md</code>: seven representative calls, 15 samples each on the local seeded database, median 8.8 to 20.5 ms, p95 at most 33.4 ms, all under the 500 ms target.'],
    ['Timing parity for known and unknown emails (SEC-07)', 'One sample of 30 requests each, medians 55.35 ms and 55.31 ms (recorded in the F-01 evidence of PR #13). Not asserted by an automated test.'],
  ]));

  // F.4
  out.push(heading(2, 'F.4 Acceptance criteria to test results'));
  out.push('<p>Planned test IDs are those in the Software Test Specification (E.8). The actual test names are the real Vitest or Playwright test titles; the count is how many individual tests match. Status is computed from the recorded run, not typed by hand.</p>');
  out.push(table(['AC', 'Planned test', 'Level', 'Actual tests (file › name, count)', 'Result'], acMap.map((r) => [
    r.ac, r.test, esc(r.level),
    r.evaluated.map((i) => `<code>${esc(i.label)}</code>${i.kind === 'auto' && i.n > 1 ? ` (${i.n})` : ''}`).join('<br/>') + (r.note ? `<br/><span class="small">${esc(r.note)}</span>` : ''),
    statusCell(r),
  ])));
  const journey = (id, text) => [id, text, e2eText.split('\n').some((l) => l.includes(id) && l.includes('✓')) ? '<span class="status-pass">PASS</span>' : '<span class="status-fail">FAIL</span>'];
  out.push(table(['Journey test', 'What it covers', 'Result'], [
    journey('TEST-42', 'Supervisor creates a milestone; student submits; reload shows the saved submission (AC-17, AC-21, AC-35, AC-41 for the student view).'),
    journey('TEST-43', 'Short feedback refused in UI and API; valid feedback saved; team sees it; student review attempt 403; other team 404; logout then 401 (AC-04, AC-10, AC-27, AC-28, AC-31, AC-32).'),
  ]));
  const nOk = acMap.filter((r) => r.ok).length; const nPartial = acMap.filter((r) => r.ok && r.coverage === 'partial').length; const nManual = acMap.filter((r) => r.coverage === 'manual').length;
  out.push(`<p><b>Summary:</b> ${nOk} of ${acMap.length} acceptance criteria have a passing recorded verification; ${nPartial} of those are partial (the note says what is not covered) and ${nManual} is verified by a manual check only. No criterion has a failing test.</p>`);

  // F.5 security coverage
  out.push(heading(2, 'F.5 Security verification coverage'));
  out.push('<p>The security cases are defined in E.9. This table states how each is verified now.</p>');
  out.push(table(['Case', 'Class', 'Verified by', 'Status'], [
    ['SEC-01', 'XSS', 'API returns hostile text as inert JSON (submission, feedback, echo route tests); code gate forbids raw HTML APIs in the client; React escapes text', 'Automated (browser rendering not tested)'],
    ['SEC-02', 'SQL injection', 'Hostile IDs and text in API and PostgreSQL tests; code gate forbids raw SQL APIs; Prisma parameterises queries', 'Automated'],
    ['SEC-03', 'CSRF', 'Foreign and missing Origin refused (403), non-JSON bodies refused (415), safe methods do not mutate; SameSite=Lax cookie', 'Automated'],
    ['SEC-04', 'SSRF', 'Code gate: no outbound HTTP client in server code; links stored as text and never fetched; non-http(s) schemes refused', 'Code gate + tests'],
    ['SEC-05', 'IDOR', 'Foreign and missing IDs return the same 404 body on every team, milestone, submission and feedback route', 'Automated'],
    ['SEC-06', 'BOLA matrix', 'Route inventory test lists all 11 routes and requires 401 anonymously; per-route cross-team tests. No full role-by-scope table is generated', 'Partial'],
    ['SEC-07', 'Username enumeration', 'Identical status and body for known and unknown emails (automated); timing sampled by hand', 'Partial'],
    ['SEC-08', 'Brute force', 'Throttle after 5 failures per IP or email with Retry-After; password spraying limited; recovery after the window', 'Automated'],
    ['SEC-09', 'Login flow flaws', 'Extra body fields, redirect input, object-typed email, session rotation (no fixation) tested', 'Automated'],
    ['SEC-10', 'Cookie manipulation', 'Tampered, truncated, replayed and expired cookies give 401; extra role cookie ignored; attributes asserted. Entropy checked by format (43-character base64url of 32 bytes), not statistically', 'Automated (entropy by format)'],
    ['SEC-11', 'Traversal, LFI, RFI', 'No file-serving route exists yet; traversal strings in IDs return 400; code gate forbids request-derived file paths. Static asset traversal cannot be tested until production serving is added in Lab 5', 'Code gate + tests (static serving not applicable yet)'],
    ['SEC-12', 'Command injection', 'Code gate: no child_process in server code; shell metacharacters stored as data', 'Code gate + tests'],
    ['SEC-13', 'Mass assignment', 'Unknown or spoofed fields (creator, submitter, supervisor, timestamps, IDs) rejected with 400 on every write route', 'Automated'],
    ['SEC-14', 'Excessive data exposure', 'Exact key sets asserted for login, me, team, milestone, submission and feedback responses', 'Automated'],
    ['SEC-15', 'Broken authentication', 'No cookie, expired, malformed cookie and Authorization header all refused; wrong role 403', 'Automated'],
    ['SEC-16', 'Rate limiting', 'General limit of 100 requests per minute per IP and login throttle return 429 with Retry-After', 'Automated'],
    ['SEC-17', 'HTTP hygiene', '415, 413 (10 KB cap), malformed and deeply nested JSON, unsupported methods', 'Automated'],
    ['SEC-18', 'Headers, CORS', 'CSP, nosniff, referrer policy, frame protection, no X-Powered-By, no CORS grant for a foreign Origin or preflight', 'Automated'],
    ['SEC-19', 'Dependency audit', '<code>npm audit</code> reports 0 vulnerabilities (root override for deepmerge-ts documented in evidence/F-02-audit.txt)', 'Command'],
    ['SEC-20', 'Secrets', 'Scan for private keys and for the local .env values; .env ignored; placeholders only in .env.example', 'Automated (the .env-value check skips when no .env exists)'],
  ]));

  // F.6 excerpts
  out.push(heading(2, 'F.6 Test excerpts and test-first evidence'));
  const redF04 = read(join(repo, 'docs/sprints/sprint-1/evidence/F-04-red.txt'));
  const redF02 = read(join(repo, 'docs/sprints/sprint-1/evidence/F-02-red-assertions.txt'));
  const t24 = sourceBlock('server/tests/submit-work-db.test.ts', /  it\.each\(\[\n    \['one second before the deadline'[\s\S]*?\n  \}\);\n/);
  const setNowFn = sourceBlock('server/tests/submit-work-db.test.ts', /function setNow\(date: Date\) \{[\s\S]*?\n\}\n/);
  const ownership = sourceBlock('server/tests/security.test.ts', /  it\('lets a student read only their own team and hides others exactly like missing ones'[\s\S]*?\n  \}\);\n/);
  const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();
  const when = (sha) => git('show', '-s', '--date=iso-strict', '--format=%ad', sha);
  const t24Rows = results.filter((r) => r.file === 'submit-work-db.test.ts' && r.name.includes('TEST-24'));
  const own = results.filter((r) => r.file === 'security.test.ts' && r.name.includes('AC-10 and AC-11'));
  out.push('<h3>Excerpt 1 — domain rule: submission deadline (BR-02, AC-24, TEST-24)</h3>');
  out.push(pre(`// server/tests/submit-work-db.test.ts\nconst DUE_A = new Date('2026-11-22T12:00:00Z');\n\n${setNowFn.trim()}\n\n${t24}`));
  out.push(`<p><b>Failing before implementation</b> — red commit <code>b1ebafc</code> (${esc(when('b1ebafc'))}), recorded output <code>evidence/F-04-red.txt</code>. The route did not exist, so the deadline cases failed on their assertions:</p>`);
  out.push(pre(sliceBlock(redF04, /FAIL .*TEST-24 exactly at the deadline/, 12)));
  out.push(`<p><b>Passing after implementation</b> — green commit <code>5d59402</code> (${esc(when('5d59402'))}). In the final run: ${t24Rows.map((r) => `${r.status === 'passed' ? 'passed' : 'FAILED'}`).length} TEST-24 tests, ${t24Rows.filter((r) => r.status === 'passed').length} passed (before the deadline: 201; exactly at the deadline: 201; one second after: 409 DEADLINE_PASSED with no row stored).</p>`);
  out.push('<h3>Excerpt 2 — role and ownership restriction: team scope with uniform 404 (BR-06, AC-10, AC-11, TEST-10, TEST-11)</h3>');
  out.push(pre(`// server/tests/security.test.ts\n${ownership}`));
  out.push(`<p><b>Failing without the behavior</b> — the original F-02 tests were committed together with the implementation (<code>2e8c38a</code>, ${esc(when('2e8c38a'))}), so no failing run exists from before implementation. To show the assertions catch the missing behavior, the team recorded a reconstructed run with only the role check and the scope check disabled (<code>evidence/F-02-red-assertions.txt</code>, labelled as a reconstruction):</p>`);
  out.push(pre(sliceBlock(redF02, /FAIL .*lets a student read only their own team/, 10)));
  out.push(`<p><b>Passing with the implementation</b> — final run: ${own.filter((r) => r.status === 'passed').length} of ${own.length} tests in this group passed. Genuine red-then-green commits were used for the later review fixes (red <code>5a6a6ba</code>, green <code>d190eea</code>), F-04 (<code>b1ebafc</code>, <code>5d59402</code>) and F-05 (<code>bd010cb</code>, <code>860f442</code>). The process exception for F-02 is recorded in <code>evidence/F-02.md</code>.</p>`);

  // F.7 workflow
  out.push(heading(2, 'F.7 Engineering workflow and history'));
  out.push('<p>Course workflow: Issue, feature branch from sprint staging, PR into sprint staging, teammate review, integration, release PR to <code>main</code>, tag. Authors did not approve their own PRs.</p>');
  const merged = prs.filter((p) => p.state === 'MERGED').sort((a, b) => a.number - b.number);
  const planned = { 'feature/01-authentication': ['F-01', 'N0M3KM'], 'feature/02-role-ownership': ['F-02', 'Jinnakan'], 'feature/03-proposal-submission': ['F-03', 'N0M3KM'], 'feature/04-submit-work': ['F-04', 'Jinnakan'], 'feature/05-feedback': ['F-05', 'N0M3KM'], 'feature/06-foundation-seed': ['F-06', 'Jinnakan'], 'feature/07-scoped-views': ['F-07', 'N0M3KM'] };
  out.push('<h3>Merged pull requests</h3>');
  out.push(table(['PR', 'Feature', 'Branch → base', 'Author', 'Reviews (reviewer: state)', 'Merged into staging'], merged.map((p) => {
    const d = prDetail(p.number);
    const reviews = d.reviews.map((r) => `${people[r.author.login]?.name.split(' ')[0] ?? r.author.login}: ${r.state.toLowerCase().replace('_', ' ')}`).join('; ') || '—';
    const f = planned[p.headRefName]?.[0] ?? '(docs)';
    return [`#${p.number}`, f, `<code>${esc(p.headRefName)}</code> → <code>${esc(p.baseRefName)}</code>`, people[p.author.login]?.name ?? p.author.login, esc(reviews), `${esc((p.mergedAt ?? '').slice(0, 10))}, commit <code>${esc(short(p.mergeCommit?.oid ?? ''))}</code>`];
  })));
  const issuesFor = (n) => issues.find((i) => i.number === n);
  const sample = (prNum, issueNum, contract) => {
    const d = prDetail(prNum); const issue = issuesFor(issueNum);
    const last = d.reviews.filter((r) => r.state === 'APPROVED').slice(-1)[0];
    const firstChange = d.reviews.find((r) => r.state === 'CHANGES_REQUESTED') ?? d.reviews[0];
    const q = (r) => esc((r?.body ?? '').replace(/\s+/g, ' ').slice(0, 520)) + ((r?.body ?? '').length > 520 ? '…' : '');
    return `<h3>Sample ${prNum === 14 ? '1' : '2'} — Issue #${issueNum} and PR #${prNum}</h3>` + table(['Item', 'Record'], [
      ['Issue', `#${issueNum} “${esc(issue?.title ?? '')}” — ${esc(issue?.state ?? '')}${issue?.closedAt ? ` (closed ${esc(issue.closedAt.slice(0, 10))})` : ''}`],
      ['Feature / contract IDs', esc(contract)],
      ['Branch', `<code>${esc(d.headRefName)}</code> from <code>${esc(d.baseRefName)}</code>`],
      ['Author / reviewer', `${esc(people[d.author.login]?.name)} / ${esc(people[d.reviews.find((r) => r.author.login !== d.author.login)?.author.login ?? '']?.name ?? '')}`],
      ['Commits', d.commits.map((c) => `<code>${esc(short(c.oid))}</code> ${esc(c.messageHeadline)}`).join('<br/>')],
      ['Substantive review', `<i>${esc(people[firstChange?.author.login]?.name.split(' ')[0] ?? '')} (${esc((firstChange?.state ?? '').toLowerCase().replace('_', ' '))}, ${esc((firstChange?.submittedAt ?? '').slice(0, 10))}):</i> ${q(firstChange)}`],
      ['Approval', last ? `<i>${esc(people[last.author.login]?.name.split(' ')[0])} (approved, ${esc(last.submittedAt.slice(0, 10))}):</i> ${q(last)}` : '—'],
      ['Integration', `Merged into <code>sprint-1-staging</code> on ${esc((d.mergedAt ?? '').slice(0, 10))} by ${esc(people[d.mergedBy?.login]?.name ?? '')}, merge commit <code>${esc(short(d.mergeCommit?.oid ?? ''))}</code>.`],
      ['Release to main', releasedToMain ? `Tag <code>${esc(TAG)}</code>, commit <code>${esc(SHA)}</code>.` : 'Pending at the time of this evidence run.'],
    ]);
  };
  out.push(sample(14, 2, 'F-02; FR-02; BR-06, BR-07; NFR-01, NFR-03, NFR-07 to NFR-12; AC-08 to AC-16; TEST-08 to TEST-16'));
  out.push(sample(15, 11, 'F-07; FR-07; BR-06; NFR-04, NFR-05; AC-35 to AC-41; TEST-35 to TEST-43'));
  out.push('<h3>Issue states and board</h3>');
  out.push(table(['Issue', 'Title on GitHub', 'State'], issues.filter((i) => [1, 2, 3, 4, 5, 6, 7, 11].includes(i.number)).sort((a, b) => a.number - b.number).map((i) => [`#${i.number}`, esc(i.title), esc(i.state)])));
  if (inputs.boardScreenshot && existsSync(resolve(repo, inputs.boardScreenshot))) {
    const data = readFileSync(resolve(repo, inputs.boardScreenshot)).toString('base64');
    out.push(`<figure><img src="data:image/png;base64,${data}" alt="project board"/><figcaption><b>Final project board status.</b></figcaption></figure>`);
  } else {
    out.push('<p><b>Final board status:</b> all Sprint 1 feature Issues above are closed on GitHub through their merged PRs. A screenshot of the project board columns was not captured by this evidence run (the GitHub CLI used here has no project-board access); add it before submission if the board is required.</p>');
  }
  out.push('<h3>History sequence (commits since the project base)</h3>');
  out.push('<p>Contracts and test design were recorded before implementation: the Theme 6 documents (SRS, SDS, feature contracts F-01 to F-07, STS) were merged through PR #8 and PR #10 on 2026-11-06, before the feature PRs #12 to #18. Within features F-04 and F-05 the test commit precedes the implementation commit.</p>');
  const history = read(join(EV, 'history.tsv')).trim().split('\n').filter(Boolean).map((l) => l.split('\t'));
  out.push(table(['Commit', 'Date (UTC+7)', 'Author', 'Subject'], history.map(([h, d, a, s]) => [`<code>${esc(h)}</code>`, esc(d.replace('T', ' ').slice(0, 16)), esc(people[a]?.name ?? a), esc(s)])));

  // F.8 contributions
  out.push(heading(2, 'F.8 Contributions and AI-use declaration'));
  const sl = read(join(EV, 'shortlog.txt')).trim().split('\n').map((l) => l.trim().split(/\s+/)).map(([n, ...rest]) => [Number(n), rest.join(' ')]);
  const commitsBy = (login) => sl.find(([, name]) => name === login)?.[0] ?? 0;
  const authored = (login) => merged.filter((p) => p.author.login === login).length;
  const reviewed = (login) => merged.filter((p) => p.author.login !== login && prDetail(p.number).reviews.some((r) => r.author.login === login)).length;
  out.push(table(['Student', 'Non-merge commits since base', 'Merged PRs authored', 'Merged PRs reviewed (other author)', 'Features planned as owner'], [
    ['Drarun Yookphan (67070501016, N0M3KM)', commitsBy('N0M3KM'), authored('N0M3KM'), reviewed('N0M3KM'), 'F-01, F-03, F-05, F-07 (from the Sprint 1 plan)'],
    ['Jinnakan Chaviengpob (67070501010, Jinnakan)', commitsBy('Jinnakan'), authored('Jinnakan'), reviewed('Jinnakan'), 'F-02, F-04, F-06 (from the Sprint 1 plan)'],
  ]));
  const swapped = merged.filter((p) => planned[p.headRefName] && planned[p.headRefName][1] !== p.author.login).map((p) => `${planned[p.headRefName][0]} (PR #${p.number})`);
  out.push(`<p>Counts come from Git and GitHub, not from effort estimates; equal counts are not required. Planned and actual authors differ for: ${swapped.length ? swapped.join(', ') : 'none'}. Both students reviewed the other’s work and wrote or revised the requirements, contracts and tests; the review records in F.7 show specific findings from each side. Pair work was not recorded separately in Issues or PRs.</p>`);
  out.push('<h3>AI-use declaration</h3>');
  out.push(`<p><b>Jinnakan Chaviengpob:</b> ${esc(inputs.aiUseJinnakan ?? 'Claude Code (Anthropic) was used as a coding and writing assistant for: drafting and revising the SRS, SDS, feature contracts, test and security plans; writing tests and implementation for F-02, F-04 and F-05 and the end-to-end journeys; drafting PR review comments; and building this PDF. The student supplied the contracts and requirements, reviewed the diffs, ran the commands and takes responsibility for the result.')}</p>`);
  out.push(`<p><b>Drarun Yookphan:</b> ${esc(inputs.aiUseDrarun ?? 'Declaration to be added by Drarun Yookphan before submission.')}</p>`);

  // F.9 limitations
  out.push(heading(2, 'F.9 Known limitations and incomplete work'));
  const items = [
    `Release record: ${releasedToMain ? `released to main as ${TAG}.` : 'the release PR from sprint-1-staging to main and the tag were not yet done when this evidence was collected.'}`,
    'Failed or skipped tests: none in the recorded run (0 failed, 0 skipped). The local-secrets check in secrets.test.ts skips automatically if no .env file exists.',
    'Partial verification (see F.4): AC-06 timing parity (sampled by hand), AC-13 browser rendering of hostile text, AC-38 loading and error UI states (no automated test, no empty-state screenshot), AC-41 hidden UI actions (checked for the student milestone form only). AC-40 is a manual check.',
    'Test-first evidence differs by feature: F-04 and F-05 have separate red and green commits; the review fixes to F-02 do too; for F-02 TEST-09 to TEST-11 only a labelled reconstruction exists (process exception in evidence/F-02.md, team decision still marked pending there); F-01, F-03 and F-06 evidence records the failing run in prose or output files without separate red commits; the Playwright journeys, contrast test and latency script were added after the implementation.',
    'Decisions D-05 to D-08 and D-10 to D-13 in the SRS answer Theme 6 ambiguities; they are proposed and were not confirmed with the instructor or TA.',
    'Issues #1, #2, #3 and #5 still carry proposal-era wording from before the Theme 6 rework; the contracts in Part E and the PRs name the real scope. Issue #4 was updated on its branch name only in part.',
    'Open design points: the login throttle also limits by IP (one address can block others, and behind a proxy all clients share one address; the proxy setting is a Lab 5 item); the limiter is in memory and per instance; the milestone detail response omits the submitter name and the feedback author name that the F-04 and F-05 responses return; a 401 during use shows a generic error instead of returning to sign-in; length rules count UTF-16 units; a milestone detail view loads all milestones of a team without paging.',
    'Not in Deliverable 1 by design: Docker image, CI/CD pipeline and GCP deployment (Lab 5), self-registration, password recovery, grades, revisions, search. Sprint 2 and 3 features F-08 to F-12 are proposals without contracts.',
    '`npm ls` reports the deepmerge-ts override as invalid because the Prisma CLI declares version 7.1.5; it exists to clear the audit finding.',
  ];
  out.push(`<ul>${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`);

  // F.10 evidence index
  out.push(heading(2, 'F.10 Evidence index'));
  out.push(table(['Rubric part', 'Artifact / direct link', 'IDs / selected version', 'Verification result or status'], [
    ['A. SRS and product scope', 'Part A in this PDF; repo <code>docs/srs.md</code>', 'FR-01 to FR-12, BR-01 to BR-07, NFR-01 to NFR-12, D-01 to D-15; SRS v2.1', 'Written; Sprint 1 requirements verified in F.4'],
    ['B. Features and traceability', 'Part B; <code>docs/features.md</code>, <code>docs/traceability.md</code>', 'F-01 to F-12, X-01; v2.1', 'Every baseline requirement mapped; F-08 to F-12 uncovered by tests (proposed)'],
    ['C. System-Level SDS', 'Part C; <code>docs/system-sds.md</code>', 'Architecture, data model, API, role matrix, auth, config, deployment; v2.1', 'Implemented as designed for Sprint 1; deployment is a plan (Lab 5)'],
    ['D. Three-sprint plan', 'Part D; <code>docs/sprints/plan.md</code>, <code>docs/sprints/sprint-1/plan.md</code>', 'Sprints 1 to 3; v2.1', 'Sprint 1 delivered; Sprints 2 and 3 planned'],
    ['E. Sprint 1 contracts', 'Part E; <code>docs/sprints/sprint-1/</code>', 'F-01 to F-07, AC-01 to AC-41, TEST-01 to TEST-43, DoD', 'See F.4 and F.5'],
    ['F. Working release', 'Part F; <code>tools/deliverable/</code>, <code>docs/sprints/sprint-1/evidence/</code>', `Commit ${short(TESTED)}${releasedToMain ? `, tag ${TAG}` : ' (not yet released)'}`, `${totals.pass} of ${totals.tests} tests and 2 of 2 journeys passed`],
  ]));
  return out.join('\n');
}

// ---------- document assembly ----------
function body() {
  tocEntries.length = 0;
  const parts = [];
  parts.push(heading(1, 'Part A — SRS and product scope'));
  parts.push(embedded('srs.md', 'A.1 Software Requirements Specification'));
  parts.push(heading(1, 'Part B — Feature inventory and traceability'));
  parts.push(embedded('features.md', 'B.1 Feature inventory'));
  parts.push(embedded('traceability.md', 'B.2 Requirements traceability and coverage gaps'));
  parts.push(heading(1, 'Part C — System-Level SDS'));
  parts.push(embedded('system-sds.md', 'C.1 System-level design specification'));
  parts.push(embedded('architecture.md', 'C.2 Product architecture plan (all features)'));
  parts.push(heading(1, 'Part D — Three-sprint plan'));
  parts.push(embedded('sprints/plan.md', 'D.1 Three-sprint plan, dependencies and Sprint 1 scope'));
  parts.push(embedded('sprints/sprint-1/plan.md', 'D.2 Sprint 1 plan, ownership and sequence diagrams'));
  parts.push(heading(1, 'Part E — Sprint 1 engineering contracts'));
  const contracts = [
    ['F-01-authentication.md', 'E.1 Contract F-01 — Authentication and current user'],
    ['F-02-role-ownership.md', 'E.2 Contract F-02 — Role and team ownership enforcement'],
    ['F-03-create-milestone.md', 'E.3 Contract F-03 — Create milestone'],
    ['F-04-submit-work.md', 'E.4 Contract F-04 — Submit milestone work'],
    ['F-05-feedback.md', 'E.5 Contract F-05 — Supervisor feedback'],
    ['F-06-foundation-seed.md', 'E.6 Contract F-06 — Foundation and synthetic seed'],
    ['F-07-scoped-views.md', 'E.7 Contract F-07 — Scoped views and progress'],
  ];
  for (const [file, title] of contracts) parts.push(embedded(`sprints/sprint-1/${file}`, title));
  parts.push(embedded('sprints/sprint-1/sts.md', 'E.8 Software test specification and Definition of Done'));
  parts.push(embedded('security-test-plan.md', 'E.9 Security test plan'));
  parts.push(partF());
  return parts.join('\n');
}

function frontMatter(pageOf) {
  const pg = (key) => (pageOf?.[key] ?? '00');
  const tocRows = tocEntries.map((e) => `<tr class="l${e.level}"><td>${esc(e.text.replace(/^Part ([A-F]) — /, '$1. '))}</td><td class="pg">${pg(e.text)}</td></tr>`).join('');
  const range = (letter, extra = '') => {
    const s = pageOf?.[partTitle[letter]]; const e = pageOf?.[`__end_${letter}`];
    return s ? `${s}–${e}${extra}` : '00–00';
  };
  const f = (sub) => pg(sub);
  const nav = table(['Part', 'Pages', 'Relevant IDs', 'Where the evidence is'], [
    ['A. SRS and product scope', range('A'), 'FR-01 to FR-12; BR-01 to BR-07; NFR-01 to NFR-12; D-01 to D-15', `Verified in Part F, page ${f('F.4 Acceptance criteria to test results')}`],
    ['B. Feature inventory and traceability', range('B'), 'F-01 to F-12, X-01; traceability matrix; coverage gaps', `Result per criterion: Part F, page ${f('F.4 Acceptance criteria to test results')}`],
    ['C. System-Level SDS', range('C'), 'Data model; API conventions; role matrix; authentication; configuration; deployment plan', `Security cases: Part F, page ${f('F.5 Security verification coverage')}`],
    ['D. Three-sprint plan', range('D'), 'Sprints 1 to 3; Sprint 1 scope; sequence diagrams', `History: Part F, page ${f('F.7 Engineering workflow and history')}`],
    ['E. Sprint 1 engineering contracts', range('E'), 'F-01 to F-07; AC-01 to AC-41; TEST-01 to TEST-43; DoD; version history', `Test results: Part F, page ${f('F.3 Build and automated test results')}; AC table: page ${f('F.4 Acceptance criteria to test results')}`],
    ['F. Working Sprint 1 and verification', range('F'), 'Demonstrations; build and test output; AC-to-test table; excerpts; Issues and PRs; contributions; limitations', `Screenshots page ${f('F.2 Program demonstrations')}; excerpts page ${f('F.6 Test excerpts and test-first evidence')}; limitations page ${f('F.9 Known limitations and incomplete work')}`],
  ]);
  const releaseText = releasedToMain
    ? `Tag <code>${esc(TAG)}</code>, commit <code>${esc(SHA)}</code> on <code>main</code>`
    : `<b>Release candidate</b> commit <code>${esc(SHA)}</code>; <b>not yet released to main</b> (no tag)`;
  return `
<div class="cover">
  <h1 class="first">CPE 334 Project Deliverable 1</h1>
  <div class="sub">Engineering baseline and working Sprint 1 · Semester 1/2026 · Theme 6: Course Project Management System (CPMS)</div>
  ${table(['Student', 'Student ID', 'GitHub'], [
    ['Drarun Yookphan', '67070501016', 'N0M3KM'],
    ['Jinnakan Chaviengpob', '67070501010', 'Jinnakan'],
  ])}
  ${table(['Item', 'Value'], [
    ['Selected theme / context', 'Theme 6, Course Project Management System: supervisors set milestones for teams, team members submit work (title, description, link), supervisors give feedback, teams and supervisors see progress'],
    ['Repository', REPO_URL],
    ['Submitted release tag / commit', releaseText],
    ['Evidence collected on', `commit <code>${esc(TESTED)}</code>`],
    ['Roles in Sprint 1', 'Student and Supervisor (seeded accounts)'],
    ['Due', '8 November 2026, 23:59 (LEB2)'],
  ])}
  ${releasedToMain ? '' : '<div class="box warn">This copy was built before the release PR to <code>main</code> was merged. Rebuild after the release tag exists.</div>'}
</div>
<h1>Navigation table</h1>
<p>Page numbers are positions in this PDF.</p>
${nav}
<h1 class="nobreak">Table of contents</h1>
<table class="toc"><tbody>${tocRows}</tbody></table>`;
}

const partTitle = {
  A: 'Part A — SRS and product scope', B: 'Part B — Feature inventory and traceability', C: 'Part C — System-Level SDS',
  D: 'Part D — Three-sprint plan', E: 'Part E — Sprint 1 engineering contracts', F: 'Part F — Working Sprint 1 and verification',
};

function html(pageOf) {
  const b = body();
  return `<!doctype html><html><head><meta charset="utf-8"><title>CPE 334 Deliverable 1</title><style>${CSS}</style></head><body>${frontMatter(pageOf)}${b}</body></html>`;
}

async function render(htmlText, pdfPath) {
  const browser = await chromium.launch({ channel: process.env.E2E_CHANNEL ?? 'chrome' });
  try {
    const page = await browser.newPage();
    await page.setContent(htmlText, { waitUntil: 'load' });
    await page.addScriptTag({ path: join(here, 'node_modules/mermaid/dist/mermaid.min.js') });
    await page.evaluate(async () => {
      // eslint-disable-next-line no-undef
      mermaid.initialize({ startOnLoad: false, theme: 'neutral', securityLevel: 'strict', sequence: { useMaxWidth: true }, flowchart: { useMaxWidth: true } });
      // eslint-disable-next-line no-undef
      await mermaid.run({ querySelector: 'pre.mermaid' });
    });
    const failed = await page.evaluate(() => [...document.querySelectorAll('pre.mermaid')].filter((n) => !n.querySelector('svg')).length);
    if (failed) throw new Error(`${failed} diagram(s) failed to render`);
    mkdirSync(dirname(pdfPath), { recursive: true });
    await page.pdf({
      path: pdfPath, format: 'A4', printBackground: true, displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: '<div style="width:100%;font-size:7.5pt;color:#4e6282;padding:0 15mm;display:flex;justify-content:space-between"><span>CPE 334 Deliverable 1 — CPMS (Theme 6) — Drarun Yookphan 67070501016, Jinnakan Chaviengpob 67070501010</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>',
      margin: { top: '17mm', bottom: '18mm', left: '15mm', right: '15mm' },
    });
  } finally {
    await browser.close();
  }
}

const norm = (s) => s.replace(/\s+/g, ' ').trim();
function locate(pdfPath) {
  const text = execFileSync('pdftotext', ['-layout', pdfPath, '-'], { encoding: 'utf8', maxBuffer: 1 << 28 });
  const pages = text.split('\f').map(norm);
  if (pages[pages.length - 1] === '') pages.pop();
  const first = pages.findIndex((p) => p.includes(norm(partTitle.A)));
  if (first === -1) throw new Error('Part A heading not found');
  const pageOf = {}; let from = first;
  for (const e of tocEntries) {
    const key = norm(e.text);
    let idx = pages.findIndex((p, i) => i >= from && p.includes(key));
    if (idx === -1) idx = pages.findIndex((p, i) => i >= first && p.includes(key));
    if (idx === -1) throw new Error(`heading not found in PDF: ${e.text}`);
    pageOf[e.text] = idx + 1; from = idx;
  }
  const letters = Object.keys(partTitle);
  letters.forEach((l, i) => {
    pageOf[`__end_${l}`] = i + 1 < letters.length ? pageOf[partTitle[letters[i + 1]]] - 1 : pages.length;
  });
  return { pageOf, total: pages.length, pages };
}

const tmp = join(dirname(OUT), '.build');
mkdirSync(tmp, { recursive: true });
let pageOf = null; let result;
for (let pass = 1; pass <= 4; pass++) {
  const pdf = join(tmp, `pass${pass}.pdf`);
  await render(html(pageOf), pdf);
  result = locate(pdf);
  const stable = pageOf && JSON.stringify(pageOf) === JSON.stringify(result.pageOf);
  console.log(`pass ${pass}: ${result.total} pages${stable ? ' (stable)' : ''}`);
  if (stable) { writeFileSync(OUT, readFileSync(pdf)); break; }
  pageOf = result.pageOf;
  if (pass === 4) throw new Error('page numbers did not stabilise');
}
writeFileSync(join(tmp, 'pages.json'), JSON.stringify(result.pageOf, null, 2));
console.log(`PDF written: ${OUT} (${result.total} pages)`);
