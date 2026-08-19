import { expect, test } from '@playwright/test';

// Phase 3b 확산 2차: 권한 관리 목록 로더(loadRows)가 useAsyncResource
// (keepDataOnError: false)로 전환된 뒤에도 mock 모드 성공 경로가 유지되는지 고정한다.
test('system permissions page renders admin role rows in mock mode', async ({
  page
}) => {
  await page.goto('/system/permissions');

  await expect(page.getByRole('heading', { name: '권한 관리' })).toBeVisible();
  await expect(page.locator('tbody tr.ant-table-row').first()).toBeVisible();
});
