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
  await expect(page.getByRole('heading', { name: MILESTONE })).toBeVisible();   // the milestone page, not the team list
  await expect(page.locator('.status-badge', { hasText: 'Reviewed' })).toBeVisible();
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
  // The earlier version's own description and link stay readable from the history (review finding on #59).
  await expect(versions.nth(0)).toContainText('The first version of the plan with its main goals.');
  await expect(versions.nth(0).getByRole('link', { name: 'https://example.test/team-a/plan-1' })).toBeVisible();
  await expect(versions.nth(1)).toContainText('The second version of the plan with measurable goals.');
  await expect(versions.nth(1).getByRole('link', { name: 'https://example.test/team-a/plan-2' })).toBeVisible();
  await expect(versions.nth(1)).toContainText('Version 2');
  await expect(versions.nth(1)).toContainText('Revision plan v2');
  await expect(versions.nth(1)).toContainText('No feedback on this version.');
});

test('TEST-54c a supervisor drafting feedback while the student sends a new version keeps the draft and is told to review the new version', async ({ browser }) => {
  const TITLE = 'E2E stale feedback milestone';
  const DRAFT = 'Draft feedback written against version one.';
  const supervisorCtx = await browser.newContext({ viewport: { width: 1000, height: 760 } });
  const studentCtx = await browser.newContext({ viewport: { width: 1000, height: 760 } });
  const supervisor = await supervisorCtx.newPage();
  const student = await studentCtx.newPage();

  // The supervisor creates a milestone; the student submits version 1.
  await login(supervisor, 'supervisor1@example.test', SUPERVISOR_PW);
  await supervisor.getByRole('link', { name: 'Team A' }).click();
  await supervisor.getByLabel('Title').fill(TITLE);
  await supervisor.getByLabel('Description (optional)').fill('Journey test milestone for stale feedback.');
  await supervisor.getByLabel('Due date and time (local)').fill(localInputValue(new Date(Date.now() + 10 * 86_400_000)));
  await supervisor.getByRole('button', { name: 'Create milestone' }).click();
  await expect(supervisor.getByRole('link', { name: TITLE })).toBeVisible();

  await login(student, 'student.a1@example.test', STUDENT_PW);
  await student.getByRole('link', { name: TITLE }).click();
  await fillWork(student, 'Stale plan v1', 'The first version of the plan with its main goals.', 'https://example.test/team-a/stale-1');
  await student.getByRole('button', { name: 'Submit work' }).click();
  await expect(student.getByRole('heading', { name: 'Stale plan v1', exact: true })).toBeVisible();

  // The supervisor opens version 1 and starts a feedback draft, without saving it.
  await supervisor.getByRole('link', { name: TITLE }).click();
  await expect(supervisor.getByRole('heading', { name: 'Stale plan v1', exact: true })).toBeVisible();
  await supervisor.getByRole('textbox', { name: 'Feedback' }).fill(DRAFT);

  // Meanwhile the student sends version 2.
  await fillWork(student, 'Stale plan v2', 'The second version of the plan with measurable goals.', 'https://example.test/team-a/stale-2');
  await student.getByRole('button', { name: 'Send new version' }).click();
  await expect(student.getByRole('heading', { name: 'Stale plan v2', exact: true })).toBeVisible();

  // Saving now targets the old version: the supervisor is told about the new version, not "already has feedback",
  // the draft is kept, and the page shows version 2.
  await supervisor.getByRole('button', { name: 'Save feedback' }).click();
  await expect(supervisor.getByRole('alert').filter({ hasText: /newer version/i })).toBeVisible();
  await expect(supervisor.getByText('already has feedback')).toHaveCount(0);
  await expect(supervisor.getByRole('textbox', { name: 'Feedback' })).toHaveValue(DRAFT);
  await expect(supervisor.getByRole('heading', { name: 'Stale plan v2', exact: true })).toBeVisible();

  // Saving again now goes to version 2 and succeeds.
  await supervisor.getByRole('button', { name: 'Save feedback' }).click();
  await expect(supervisor.getByText(DRAFT).first()).toBeVisible();
  await supervisor.reload();
  const versions = supervisor.getByRole('region', { name: 'Version history' }).getByRole('listitem');
  await expect(versions.nth(0)).toContainText('No feedback on this version.');
  await expect(versions.nth(1)).toContainText(DRAFT);

  await supervisorCtx.close();
  await studentCtx.close();
});
