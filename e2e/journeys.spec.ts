import { expect, test, type Page } from '@playwright/test';

const SHOTS = 'docs/sprints/sprint-1/evidence/screenshots';
const ORIGIN = 'http://localhost:5173';
const SUPERVISOR_PW = process.env.SEED_SUPERVISOR_PASSWORD ?? '';
const STUDENT_PW = process.env.SEED_STUDENT_PASSWORD ?? '';
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

async function signOut(page: Page) {
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
}

// Format a Date as the value a datetime-local input expects, in local time.
function localInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const shot = (page: Page, name: string) => page.screenshot({ path: `${SHOTS}/${name}.png` });

test('TEST-42 supervisor creates a milestone, a student submits it and sees it after reload', async ({ page }) => {
  await page.goto('/login');
  await shot(page, '01-login');

  // Supervisor creates a milestone for a supervised team (AC-17, AC-36).
  await login(page, 'supervisor1@example.test', SUPERVISOR_PW);
  await expect(page.getByRole('heading', { name: 'Supervisor home' })).toBeVisible();
  await shot(page, '02-supervisor-home');
  await page.getByRole('link', { name: 'Team A' }).click();
  await page.getByLabel('Title').fill('E2E design review');
  await page.getByLabel('Description (optional)').fill('Journey test milestone.');
  await page.getByLabel('Due date and time (local)').fill(localInputValue(new Date(Date.now() + 10 * 86_400_000)));
  await page.getByRole('button', { name: 'Create milestone' }).click();
  await expect(page.getByRole('link', { name: 'E2E design review' })).toBeVisible();
  await shot(page, '03-milestone-created');
  await signOut(page);

  // A member of Team A submits work for it (AC-21, AC-35).
  await login(page, 'student.a1@example.test', STUDENT_PW);
  await expect(page.getByRole('heading', { name: 'Student home' })).toBeVisible();
  // Role-inappropriate actions are hidden from a student (AC-41); the API denial is covered by the API tests.
  await expect(page.getByRole('heading', { name: 'New milestone' })).toHaveCount(0);
  await page.getByRole('link', { name: 'E2E design review' }).click();
  await page.getByLabel('Title').fill('Design report v1');
  await page.getByLabel('Description').fill('A report describing our design decisions and trade-offs.');
  await page.getByLabel('Link').fill('https://example.test/team-a/design');
  await shot(page, '04-submission-form');
  await page.getByRole('button', { name: 'Submit work' }).click();
  await expect(page.getByRole('heading', { name: 'Design report v1' })).toBeVisible();

  // Persisted retrieval: reload and read it back from the database through the API.
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Design report v1' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'https://example.test/team-a/design' })).toBeVisible();
  await expect(page.getByText('Submitted', { exact: true })).toBeVisible();
  await shot(page, '05-submission-saved-after-reload');
});

test('TEST-43 invalid feedback is blocked, valid feedback is saved and other teams cannot see it', async ({ page, browser }) => {
  const milestone = id(204); // Team B, seeded with a submission and no feedback
  const submission = id(302);
  const feedbackUrl = `/api/submissions/${submission}/feedback`;

  await login(page, 'supervisor1@example.test', SUPERVISOR_PW);
  await page.getByRole('link', { name: 'Team B' }).click();
  await page.getByRole('link', { name: 'Requirements review' }).click();
  await expect(page.getByRole('heading', { name: 'Requirements list' })).toBeVisible();

  // Rule rejection in the UI, then the same rule enforced by the backend (AC-28).
  await page.getByRole('textbox', { name: 'Feedback' }).fill('too short');
  await page.getByRole('button', { name: 'Save feedback' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Enter feedback of 10 to 2000 characters.' })).toBeVisible();
  await shot(page, '06-feedback-validation-error');
  const rejected = await page.request.post(feedbackUrl, { headers: { Origin: ORIGIN }, data: { comment: 'too short' } });
  expect(rejected.status()).toBe(400);
  expect((await (await page.request.get(`/api/milestones/${milestone}`)).json()).submission.feedback).toBeNull();

  // Valid feedback is saved and survives a reload (AC-27).
  await page.getByRole('textbox', { name: 'Feedback' }).fill('Requirements are clear. Please add acceptance criteria.');
  await page.getByRole('button', { name: 'Save feedback' }).click();
  await expect(page.getByText('Requirements are clear. Please add acceptance criteria.')).toBeVisible();
  await page.reload();
  await expect(page.getByText('Requirements are clear. Please add acceptance criteria.')).toBeVisible();
  await shot(page, '07-feedback-saved');
  await signOut(page);

  // A member of Team B sees the feedback (AC-32); the backend refuses a student review attempt (AC-31).
  await login(page, 'student.b1@example.test', STUDENT_PW);
  await page.getByRole('link', { name: 'Requirements review' }).click();
  await expect(page.getByText('Requirements are clear. Please add acceptance criteria.')).toBeVisible();
  await shot(page, '08-student-sees-feedback');
  const forbidden = await page.request.post(feedbackUrl, { headers: { Origin: ORIGIN }, data: { comment: 'A student tries to review.' } });
  expect(forbidden.status()).toBe(403);

  // Logout ends the session on the server (AC-04).
  await signOut(page);
  expect((await page.request.get('/api/auth/me')).status()).toBe(401);
  await shot(page, '10-logged-out');

  // A student of another team gets the same unavailable page as a missing milestone (AC-10, AC-35).
  const other = await browser.newContext({ viewport: { width: 1000, height: 760 } });
  const otherPage = await other.newPage();
  await login(otherPage, 'student.a1@example.test', STUDENT_PW);
  await expect(otherPage.getByRole('heading', { name: 'Student home' })).toBeVisible();
  await otherPage.goto(`/milestones/${milestone}`);
  await expect(otherPage.getByText('This page is unavailable.')).toBeVisible();
  await otherPage.screenshot({ path: `${SHOTS}/09-other-team-unavailable.png` });
  const foreign = await otherPage.request.get(`/api/milestones/${milestone}`);
  const missing = await otherPage.request.get(`/api/milestones/${id(999)}`);
  expect(foreign.status()).toBe(404);
  expect(await foreign.json()).toEqual(await missing.json());
  await other.close();
});
