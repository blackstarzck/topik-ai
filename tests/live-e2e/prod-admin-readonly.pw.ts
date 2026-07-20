import { expect, test, type Page, type Response } from '@playwright/test';

const REQUIRED_RPCS = [
  'get_admin_users',
  'get_admin_user',
  'admin_export_users',
  'admin_list_audit_logs'
] as const;

const adminEmail = process.env.E2E_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;
const baseUrl = process.env.ADMIN_E2E_BASE_URL ?? process.env.PROD_ADMIN_E2E_BASE_URL;
const projectRef = process.env.SUPABASE_PROJECT_REF;
const expectedProjectRef = process.env.SUPABASE_EXPECTED_PROJECT_REF;

function rpcName(response: Response): string | null {
  const match = /\/rest\/v1\/rpc\/([^?]+)/.exec(response.url());
  return match?.[1] ?? null;
}

async function loginIfNeeded(page: Page): Promise<void> {
  const password = page.locator('input[type="password"]');
  if (!(await password.isVisible())) return;

  await page.locator('input[type="email"], input#email').first().fill(adminEmail ?? '');
  await password.fill(adminPassword ?? '');
  await page.locator('button[type="submit"]').click();
  await expect(password).not.toBeVisible();
}

test.beforeAll(() => {
  if (!baseUrl || !adminEmail || !adminPassword) {
    throw new Error(
      'ADMIN_E2E_BASE_URL, E2E_ADMIN_EMAIL, and E2E_ADMIN_PASSWORD are required.'
    );
  }
  if (!projectRef || projectRef !== expectedProjectRef) {
    throw new Error('Live admin E2E requires explicit matching Supabase project refs.');
  }
});

test('검증 대상에서 Users 핵심 read-only 흐름과 내보내기 감사 경로가 동작한다', async ({
  page
}) => {
  const responses = new Map<string, Response[]>();
  page.on('response', (response) => {
    const name = rpcName(response);
    if (!name || !REQUIRED_RPCS.includes(name as (typeof REQUIRED_RPCS)[number])) return;
    const items = responses.get(name) ?? [];
    items.push(response);
    responses.set(name, items);
  });

  await page.goto('/users');
  await loginIfNeeded(page);

  await expect(page.getByRole('heading', { name: '회원 목록' })).toBeVisible();
  await expect.poll(() => responses.get('get_admin_users')?.length ?? 0).toBeGreaterThan(0);
  const rows = page.locator('.ant-table-tbody > tr.ant-table-row');
  await expect(rows.first()).toBeVisible();
  expect(await rows.count()).toBeGreaterThan(0);

  const firstRow = rows.first();
  await firstRow.locator('input[type="checkbox"]').check();
  await page.getByRole('button', { name: '회원 정보 내보내기' }).click();
  const exportModal = page.locator('.ant-modal-content', { hasText: '회원 정보 내보내기' });
  await expect(exportModal).toBeVisible();
  await exportModal.getByRole('radio', { name: /선택한 회원만/ }).check();
  await exportModal.getByRole('button', { name: '선택 해제' }).click();
  await exportModal
    .getByLabel('내보내기 사유')
    .fill(`CI staged release verification ${Date.now()}`);

  const exportResponsePromise = page.waitForResponse((response) => (
    rpcName(response) === 'admin_export_users'
  ));
  const downloadPromise = page.waitForEvent('download');
  await exportModal.getByRole('button', { name: '엑셀 다운로드' }).click();
  const [exportResponse] = await Promise.all([exportResponsePromise, downloadPromise]);
  expect(exportResponse.ok()).toBe(true);
  await expect(exportModal).not.toBeVisible();

  await firstRow.locator('td').nth(2).click();
  await expect(page).toHaveURL(/\/users\/[^/?]+\?tab=profile/);
  await expect(page.getByRole('heading', { name: /Users\s*상세/ })).toBeVisible();
  await expect.poll(() => responses.get('get_admin_user')?.length ?? 0).toBeGreaterThan(0);

  await page.getByRole('link', { name: '감사 로그 확인' }).click();
  await expect(page).toHaveURL(/\/system\/audit-logs\?/);
  await expect.poll(() => responses.get('admin_list_audit_logs')?.length ?? 0).toBeGreaterThan(0);
  await expect(page.locator('.ant-table')).toBeVisible();

  for (const name of REQUIRED_RPCS) {
    const rpcResponses = responses.get(name) ?? [];
    expect(rpcResponses.length, `${name} was not called`).toBeGreaterThan(0);
    for (const response of rpcResponses) {
      expect(response.url()).toContain(`https://${expectedProjectRef}.supabase.co/`);
      expect(response.status(), `${name} returned ${response.status()}`).toBeLessThan(400);
    }
  }
});
