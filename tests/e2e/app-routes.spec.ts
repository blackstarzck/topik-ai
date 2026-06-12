import { expect, test, type Page } from '@playwright/test';

function currentPathAndSearch(page: Page): string {
  const currentUrl = new URL(page.url());
  return `${currentUrl.pathname}${currentUrl.search}`;
}

async function expectPathAndSearch(
  page: Page,
  expectedPathAndSearch: string
): Promise<void> {
  await expect
    .poll(() => currentPathAndSearch(page))
    .toBe(expectedPathAndSearch);
}

async function expectAdminShell(page: Page): Promise<void> {
  await expect(page.locator('.ant-layout-has-sider')).toBeVisible();
}

async function expectNotFoundAbsent(page: Page): Promise<void> {
  await expect(page.locator('.ant-result-404')).toHaveCount(0);
}

test('root route redirects to dashboard inside the admin shell', async ({
  page
}) => {
  await page.goto('/');

  await expectPathAndSearch(page, '/dashboard');
  await expectAdminShell(page);
  await expectNotFoundAbsent(page);
});

test('legacy route aliases keep their redirect targets', async ({ page }) => {
  const aliases = [
    ['/notification/history', '/messages/history?channel=mail'],
    ['/billing/payments', '/commerce/payments'],
    ['/commerce', '/commerce/payments'],
    ['/assessment', '/assessment/question-bank'],
    ['/content', '/content/library']
  ] as const;

  for (const [sourcePath, targetPath] of aliases) {
    await page.goto(sourcePath);
    await expectPathAndSearch(page, targetPath);
    await expectAdminShell(page);
    await expectNotFoundAbsent(page);
  }
});

test('message template routes keep channel-specific elements reachable', async ({
  page
}) => {
  await page.goto('/messages/mail/create');
  await expectPathAndSearch(page, '/messages/mail/create');
  await expectAdminShell(page);
  await expectNotFoundAbsent(page);

  await page.goto('/messages/push/create');
  await expectPathAndSearch(page, '/messages/push/create');
  await expectAdminShell(page);
  await expectNotFoundAbsent(page);
});

test('assessment static and dynamic siblings remain routable', async ({
  page
}) => {
  await page.goto('/assessment/question-bank/manage');
  await expectPathAndSearch(page, '/assessment/question-bank/manage');
  await expectAdminShell(page);
  await expectNotFoundAbsent(page);

  await page.goto('/assessment/question-bank/eps-topik');
  await expectPathAndSearch(page, '/assessment/question-bank/eps-topik');
  await expectAdminShell(page);
  await expect(page.getByRole('heading', { name: 'EPS TOPIK' })).toBeVisible();

  await page.goto('/assessment/question-bank/AQ-51001');
  await expectPathAndSearch(page, '/assessment/question-bank/AQ-51001');
  await expectAdminShell(page);
  await expectNotFoundAbsent(page);
});

test('unknown shell child routes render the admin not-found page', async ({
  page
}) => {
  await page.goto('/unknown-admin-route');

  await expectPathAndSearch(page, '/unknown-admin-route');
  await expectAdminShell(page);
  await expect(page.locator('.ant-result-404')).toBeVisible();
});
