import { expect, test, type Page } from '@playwright/test';

const ORIGIN = 'http://localhost:5173';
const SUPERVISOR_PW = process.env.SEED_SUPERVISOR_PASSWORD ?? '';
const STUDENT_PW = process.env.SEED_STUDENT_PASSWORD ?? '';
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const MILESTONE = id(202); // Team A "Prototype demo": open, no submission in the seed
const FEEDBACK = 'Good prototype. Please add a short usage guide.';
const SCORE = 85;

async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

// TEST-90 (AC-65, AC-69): the supervisor records feedback and a grade, the team's student reads the grade on the
// milestone page (and through revisions[] on GET /api/milestones/:id), and a student of another team sees nothing.
test('TEST-90 supervisor gives feedback and a grade, the team sees both, another team sees nothing', async ({ browser }) => {
  // Team A student submits work for the open milestone.
  const studentCtx = await browser.newContext({ viewport: { width: 1000, height: 760 } });
  const student = await studentCtx.newPage();
  await login(student, 'student.a1@example.test', STUDENT_PW);
  await expect(student.getByRole('heading', { name: 'Student home' })).toBeVisible();
  await student.getByRole('link', { name: 'Prototype demo' }).click();
  await student.getByLabel('Title').fill('Prototype v1');
  await student.getByLabel('Description').fill('A working prototype with a short description.');
  await student.getByLabel('Link').fill('https://example.test/team-a/prototype');
  await student.getByRole('button', { name: 'Submit work' }).click();
  await expect(student.getByRole('heading', { name: 'Prototype v1' })).toBeVisible();

  // Supervisor records feedback, then a grade (AC-65). The grade form appears only after feedback.
  const supervisorCtx = await browser.newContext({ viewport: { width: 1000, height: 760 } });
  const supervisor = await supervisorCtx.newPage();
  await login(supervisor, 'supervisor1@example.test', SUPERVISOR_PW);
  await supervisor.getByRole('link', { name: 'Team A' }).click();
  await supervisor.getByRole('link', { name: 'Prototype demo' }).click();
  await expect(supervisor.getByRole('heading', { name: 'Prototype v1' })).toBeVisible();
  await expect(supervisor.getByRole('heading', { name: 'Give a grade' })).toHaveCount(0);
  await supervisor.getByRole('textbox', { name: 'Feedback' }).fill(FEEDBACK);
  await supervisor.getByRole('button', { name: 'Save feedback' }).click();
  await expect(supervisor.getByText(FEEDBACK)).toBeVisible();

  // Out-of-range scores are blocked in the UI, and the backend enforces the same rule (AC-68).
  await supervisor.getByLabel('Score (0 to 100)').fill('101');
  await supervisor.getByRole('button', { name: 'Save grade' }).click();
  await expect(supervisor.getByRole('alert').filter({ hasText: 'Enter a whole number from 0 to 100.' })).toBeVisible();
  const rejected = await supervisor.request.post(`/api/submissions/${await submissionIdOf(supervisor)}/grade`, {
    headers: { Origin: ORIGIN }, data: { score: 101 },
  });
  expect(rejected.status()).toBe(400);

  await supervisor.getByLabel('Score (0 to 100)').fill(String(SCORE));
  await supervisor.getByRole('button', { name: 'Save grade' }).click();
  await expect(supervisor.getByText(`Grade: ${SCORE} by`)).toBeVisible();

  // The student cannot grade (AC-70), even by calling the API directly.
  const forbidden = await student.request.post(`/api/submissions/${await submissionIdOf(student)}/grade`, {
    headers: { Origin: ORIGIN }, data: { score: 100 },
  });
  expect(forbidden.status()).toBe(403);

  // Team A student reloads and sees feedback and grade (AC-69). Needs F-08: the read-only grade comes from revisions[].
  await student.reload();
  await expect(student.getByText(FEEDBACK)).toBeVisible();
  await expect(student.getByText(`Grade: ${SCORE} by`)).toBeVisible();
  const own = await student.request.get(`/api/milestones/${MILESTONE}`);
  expect(own.status()).toBe(200);
  expect((await own.json()).revisions.at(-1).grade).toMatchObject({ score: SCORE });

  // A student of another team sees no grade and no data (AC-69).
  const otherCtx = await browser.newContext({ viewport: { width: 1000, height: 760 } });
  const other = await otherCtx.newPage();
  await login(other, 'student.b1@example.test', STUDENT_PW);
  await expect(other.getByRole('heading', { name: 'Student home' })).toBeVisible();
  await other.goto(`/milestones/${MILESTONE}`);
  await expect(other.getByText('This page is unavailable.')).toBeVisible();
  await expect(other.getByText(`Grade: ${SCORE} by`)).toHaveCount(0);
  const foreign = await other.request.get(`/api/milestones/${MILESTONE}`);
  const missing = await other.request.get(`/api/milestones/${id(999)}`);
  expect(foreign.status()).toBe(404);
  expect(await foreign.json()).toEqual(await missing.json());

  await Promise.all([studentCtx.close(), supervisorCtx.close(), otherCtx.close()]);
});

// The submission id is read through the signed-in session; the Sprint 1 response carries it as submission.id.
async function submissionIdOf(page: Page): Promise<string> {
  const response = await page.request.get(`/api/milestones/${MILESTONE}`);
  const body = await response.json();
  return body.submission.id as string;
}
