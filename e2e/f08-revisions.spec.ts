import { expect, test, type Page } from '@playwright/test';

const SUPERVISOR_PW = process.env.SEED_SUPERVISOR_PASSWORD ?? '';
const STUDENT_PW = process.env.SEED_STUDENT_PASSWORD ?? '';
const MILESTONE = 'E2E revisions milestone';
const FEEDBACK = 'Good start. Please add measurable goals to the plan.';

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

async function fillWork(page: Page, title: string, description: string, link: string) {
  await page.getByLabel('Title').fill(title);
  await page.getByLabel('Description').fill(description);
  await page.getByLabel('Link').fill(link);
}

test('TEST-55 a student revises reviewed work and both versions stay listed after a reload', async ({ page }) => {
  // A supervisor creates a milestone for Team A.
  await login(page, 'supervisor1@example.test', SUPERVISOR_PW);
  await page.getByRole('link', { name: 'Team A' }).click();
  await page.getByLabel('Title').fill(MILESTONE);
  await page.getByLabel('Description (optional)').fill('Journey test milestone for revisions.');
  await page.getByLabel('Due date and time (local)').fill(localInputValue(new Date(Date.now() + 10 * 86_400_000)));
  await page.getByRole('button', { name: 'Create milestone' }).click();
  await expect(page.getByRole('link', { name: MILESTONE })).toBeVisible();
  await signOut(page);

  // A1 submits version 1. No revise form is offered before a first submission.
  await login(page, 'student.a1@example.test', STUDENT_PW);
  await page.getByRole('link', { name: MILESTONE }).click();
  await expect(page.getByRole('heading', { name: 'Send a new version' })).toHaveCount(0);
  await fillWork(page, 'Revision plan v1', 'The first version of the plan with its main goals.', 'https://example.test/team-a/plan-1');
  await page.getByRole('button', { name: 'Submit work' }).click();
  await expect(page.getByRole('heading', { name: 'Revision plan v1', exact: true })).toBeVisible();
  await signOut(page);

  // S1 gives feedback on version 1 (AC-27).
  await login(page, 'supervisor1@example.test', SUPERVISOR_PW);
  await page.getByRole('link', { name: 'Team A' }).click();
  await page.getByRole('link', { name: MILESTONE }).click();
  await page.getByRole('textbox', { name: 'Feedback' }).fill(FEEDBACK);
  await page.getByRole('button', { name: 'Save feedback' }).click();
  await expect(page.getByText(FEEDBACK)).toBeVisible();
  await signOut(page);

  // A1 sees the feedback, then revises (AC-44).
  await login(page, 'student.a1@example.test', STUDENT_PW);
  await page.getByRole('link', { name: MILESTONE }).click();
  await expect(page.getByText('Reviewed', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Send a new version' })).toBeVisible();
  await fillWork(page, 'Revision plan v2', 'The second version of the plan with measurable goals.', 'https://example.test/team-a/plan-2');
  await page.getByRole('button', { name: 'Send new version' }).click();
  await expect(page.getByRole('heading', { name: 'Revision plan v2', exact: true })).toBeVisible();

  // After a reload both versions are listed, the first feedback is still shown and the status is Submitted (AC-52, AC-53).
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Revision plan v2', exact: true })).toBeVisible();
  await expect(page.getByText('Submitted', { exact: true })).toBeVisible();
  const versions = page.getByRole('region', { name: 'Version history' }).getByRole('listitem');
  await expect(versions).toHaveCount(2);
  await expect(versions.nth(0)).toContainText('Version 1');
  await expect(versions.nth(0)).toContainText('Revision plan v1');
  await expect(versions.nth(0)).toContainText(FEEDBACK);
  await expect(versions.nth(1)).toContainText('Version 2');
  await expect(versions.nth(1)).toContainText('Revision plan v2');
  await expect(versions.nth(1)).toContainText('No feedback on this version.');
});
