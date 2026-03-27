import { expect, test } from '@playwright/test';

test('권한 관리 관리자 테이블의 더보기 컬럼은 우측 고정된다', async ({ page }) => {
  await page.goto('/system/permissions');

  await expect(page.getByRole('heading', { name: '권한 관리' })).toBeVisible();

  const adminTable = page.locator('.admin-data-table').first();
  await expect(adminTable).toBeVisible();

  const actionHeader = adminTable.getByRole('columnheader', { name: '액션' });
  await expect(actionHeader).toHaveClass(/ant-table-cell-fix-right/);

  const firstActionCell = adminTable.getByRole('row').nth(1).getByRole('cell', { name: /더보기/ });
  await expect(firstActionCell).toHaveClass(/ant-table-cell-fix-right/);
  await expect(firstActionCell.getByRole('button', { name: '더보기' })).toBeVisible();
});
