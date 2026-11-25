import { expect, test, type Page } from '@playwright/test';

async function signIn(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('link', { name: 'Search milestones' })).toBeVisible();
}

test('TEST-97 a student filters scoped results, opens a milestone and sees the empty state', async ({ page }) => {
  await signIn(page, 'student.a1@example.test', process.env.SEED_STUDENT_PASSWORD ?? '');
  await page.getByRole('link', { name: 'Search milestones' }).click();
  const query = page.getByLabel('Milestone title');
  const status = page.getByLabel('Status');
  const search = page.getByRole('button', { name: 'Search', exact: true });
  await query.fill('PROPOSAL');
  await status.selectOption('REVIEWED');
  await search.click();
  await expect(page.getByRole('status')).toHaveText('1 result · Page 1 of 1');
  await expect(page.getByRole('link', { name: 'Project proposal draft' })).toHaveCount(1);
  await status.selectOption('OVERDUE');
  await search.click();
  await expect(page.getByText('No milestones match your search.')).toBeVisible();
  await status.selectOption('REVIEWED');
  await search.click();
  await page.getByRole('link', { name: 'Project proposal draft' }).click();
  await expect(page.getByRole('heading', { name: 'Project proposal draft' })).toBeVisible();
});

test('TEST-97 a supervisor pages and can retry a failed search before session expiry', async ({ page }) => {
  await signIn(page, 'supervisor1@example.test', process.env.SEED_SUPERVISOR_PASSWORD ?? '');
  const teams = await page.request.get('/api/teams');
  const { teams: [{ id }] } = await teams.json();
  for (let n = 0; n < 21; n++) {
    const response = await page.request.post('/api/teams/' + id + '/milestones', {
      headers: { Origin: 'http://localhost:5173' },
      data: { title: 'Search paging ' + n, dueAt: new Date(Date.now() + (n + 1) * 86_400_000).toISOString() },
    });
    expect(response.status()).toBe(201);
  }
  await page.getByRole('link', { name: 'Search milestones' }).click();
  await page.route('**/api/search?*', route => route.fulfill({ status: 503 }), { times: 1 });
  await page.getByLabel('Milestone title').fill('Search paging');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Could not load search results.');
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('status')).toHaveText('21 results · Page 1 of 2');
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByRole('status')).toHaveText('21 results · Page 2 of 2');
  await expect(page.getByRole('link', { name: 'Search paging 20', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Search paging 19', exact: true })).toHaveCount(0);
  await page.route('**/api/search?*', route => route.fulfill({ status: 401 }), { times: 1 });
  await page.getByRole('button', { name: 'Previous' }).click();
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
});
