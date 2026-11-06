// Manual check for NFR-05 / TEST-40: times representative API calls against a running local server.
// Usage: node --env-file=.env scripts/measure-latency.mjs   (server on PORT, database seeded)
const base = `http://localhost:${process.env.PORT ?? 3000}`;
const origin = process.env.ALLOWED_ORIGIN ?? 'http://localhost:5173';
const N = 15;
// The API allows 100 requests per minute per IP, so requests are paced to stay under it.
const PAUSE_MS = 650;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

async function login(email, password) {
  const res = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify({ email, password }) });
  if (!res.ok) throw new Error(`login failed ${res.status}`);
  return (res.headers.get('set-cookie') ?? '').split(';')[0];
}
async function time(label, fn) {
  const samples = [];
  for (let i = 0; i < N; i++) {
    const start = performance.now();
    const res = await fn(i);
    samples.push(performance.now() - start);
    if (res.status >= 500 || res.status === 429) throw new Error(`${label} returned ${res.status}`);
    await sleep(PAUSE_MS);
  }
  samples.sort((a, b) => a - b);
  const pct = (p) => samples[Math.min(samples.length - 1, Math.ceil(p * samples.length) - 1)].toFixed(1);
  console.log(`| ${label} | ${N} | ${pct(0.5)} | ${pct(0.95)} | ${samples[samples.length - 1].toFixed(1)} |`);
}

const student = await login('student.a1@example.test', process.env.SEED_STUDENT_PASSWORD);
const supervisor = await login('supervisor1@example.test', process.env.SEED_SUPERVISOR_PASSWORD);
const get = (path, cookie) => fetch(`${base}${path}`, { headers: { Cookie: cookie } });
const post = (path, cookie, body) => fetch(`${base}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin, Cookie: cookie }, body: JSON.stringify(body) });

console.log('| Call | Samples | Median ms | p95 ms | Max ms |\n|---|---:|---:|---:|---:|');
await time('GET /api/auth/me', () => get('/api/auth/me', student));
await time('GET /api/teams (student)', () => get('/api/teams', student));
await time('GET /api/teams (supervisor)', () => get('/api/teams', supervisor));
await time('GET /api/teams/:id', () => get(`/api/teams/${id(101)}`, student));
await time('GET /api/milestones/:id', () => get(`/api/milestones/${id(201)}`, student));
await time('POST /api/teams/:id/milestones', (i) => post(`/api/teams/${id(101)}/milestones`, supervisor, { title: `Latency check ${i}`, dueAt: new Date(Date.now() + 30 * 86_400_000).toISOString() }));
const c1 = await login('student.c1@example.test', process.env.SEED_STUDENT_PASSWORD);
await time('POST /api/milestones/:id/submission (first 201, then 409)', () => post(`/api/milestones/${id(205)}/submission`, c1, { title: 'Latency check', description: 'Latency check description text.', link: 'https://example.test/x' }));
