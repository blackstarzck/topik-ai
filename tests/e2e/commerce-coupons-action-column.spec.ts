import { expect, test } from '@playwright/test';

test('쿠폰 목록 액션 컬럼은 우측 고정 클래스가 적용된다', async ({ page }) => {
  await page.goto('/commerce/coupons');

  await expect(page.getByRole('heading', { name: '쿠폰' })).toBeVisible();

  const couponTable = page.locator('.admin-data-table').first();
  await expect(couponTable).toBeVisible();

  const actionHeader = couponTable.getByRole('columnheader', { name: '액션' });
  await expect(actionHeader).toHaveClass(/ant-table-cell-fix-right/);

  const fixedActionCells = couponTable.locator('.ant-table-tbody .ant-table-cell-fix-right');
  await expect(fixedActionCells.first()).toBeVisible();
  await expect(
    fixedActionCells.first().getByRole('button', { name: '더보기' })
  ).toBeVisible();
});
