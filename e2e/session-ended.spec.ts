import { expect, test } from '@playwright/test';

const STUDENT_PW = process.env.SEED_STUDENT_PASSWORD ?? '';

// Lab 6 finding CF-01: the session ends in another tab, then this tab opens a page that needs data.
// The server answers 401. The page must send the user back to Sign in, not show a "Could not load
// this view." message whose Try again button can never work.
test('CF-01 a page that loads after the session ended returns to Sign in', async ({ page, context }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('student.a1@example.test');
  await page.getByLabel('Password').fill(STUDENT_PW);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Student home' })).toBeVisible();

  // Tab B in the same browser signs out, which revokes the server session.
  const otherTab = await context.newPage();
  await otherTab.goto('/');
  await otherTab.getByRole('button', { name: 'Sign out' }).click();
  await expect(otherTab.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  expect((await otherTab.request.get('/api/auth/me')).status()).toBe(401);

  // Tab A still shows the old signed-in page. Opening a milestone now needs data and gets a 401.
  await page.getByRole('link', { name: 'Prototype demo' }).click();

  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await expect(page.getByText('Could not load this view.')).toHaveCount(0);
});
