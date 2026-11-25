import { expect, test, type Page } from '@playwright/test';

const SUPERVISOR_PW = process.env.SEED_SUPERVISOR_PASSWORD ?? '';
const STUDENT_PW = process.env.SEED_STUDENT_PASSWORD ?? '';
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
// Seed: milestone 203 "Project proposal draft" belongs to Team B, is overdue (due 7 days ago) and has no submission.
const OVERDUE_B = id(203);

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

test('TEST-64 supervisor extends a deadline, a student submits, the supervisor closes it and the student sees Closed with no submit form', async ({ page }) => {
  // The supervisor opens an overdue milestone of Team B and extends its deadline (AC-56, AC-63).
  await login(page, 'supervisor1@example.test', SUPERVISOR_PW);
  await page.getByRole('link', { name: 'Team B' }).click();
  await page.getByRole('link', { name: 'Project proposal draft' }).click();
  await expect(page.getByRole('heading', { name: 'Project proposal draft' })).toBeVisible();
  await expect(page.getByText('Overdue', { exact: true })).toBeVisible();
  const edit = page.getByRole('form', { name: 'Edit milestone' });
  await edit.getByLabel('Due date and time').fill(localInputValue(new Date(Date.now() + 10 * 86_400_000)));
  await edit.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Not submitted', { exact: true })).toBeVisible();
  await signOut(page);

  // A member of Team B can submit again (AC-63).
  await login(page, 'student.b1@example.test', STUDENT_PW);
  await page.getByRole('link', { name: 'Project proposal draft' }).click();
  await expect(page.getByRole('heading', { name: 'Edit milestone' })).toHaveCount(0);   // never shown to a student
  await expect(page.getByRole('button', { name: 'Close milestone' })).toHaveCount(0);
  await page.getByLabel('Title').fill('Proposal after extension');
  await page.getByLabel('Description').fill('Our proposal, submitted after the supervisor extended the deadline.');
  await page.getByLabel('Link').fill('https://example.test/team-b/proposal');
  await page.getByRole('button', { name: 'Submit work' }).click();
  await expect(page.getByRole('heading', { name: 'Proposal after extension' })).toBeVisible();
  await signOut(page);

  // The supervisor closes the milestone after a confirm step that says it cannot be undone (AC-59).
  await login(page, 'supervisor1@example.test', SUPERVISOR_PW);
  await page.getByRole('link', { name: 'Team B' }).click();
  await page.getByRole('link', { name: 'Project proposal draft' }).click();
  await page.getByRole('button', { name: 'Close milestone' }).click();
  await expect(page.getByText('Closing cannot be undone.')).toBeVisible();
  await page.getByRole('button', { name: 'Yes, close this milestone' }).click();
  await expect(page.getByText(/Closed on/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Edit milestone' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Close milestone' })).toHaveCount(0);
  await signOut(page);

  // The student reloads and sees Closed, the existing submission, and no submit form (AC-60).
  await login(page, 'student.b1@example.test', STUDENT_PW);
  await page.getByRole('link', { name: 'Project proposal draft' }).click();
  await page.reload();
  await expect(page.getByText('Closed', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Proposal after extension' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Submit your work' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Submit work' })).toHaveCount(0);
  const read = await (await page.request.get(`/api/milestones/${OVERDUE_B}`)).json();
  expect(read.closedAt).not.toBeNull();
});
