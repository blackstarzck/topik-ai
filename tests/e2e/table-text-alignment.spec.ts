import { expect, test } from '@playwright/test';

test('shared AdminDataTable keeps header and body text left-aligned', async ({
  page
}) => {
  await page.goto('/commerce/points');

  const firstHeaderCell = page.locator('.admin-data-table .ant-table-thead > tr > th').first();
  const firstBodyCell = page.locator('.admin-data-table .ant-table-tbody > tr > td').first();

  await expect
    .poll(() => firstHeaderCell.evaluate((element) => window.getComputedStyle(element).textAlign))
    .toBe('left');
  await expect
    .poll(() => firstBodyCell.evaluate((element) => window.getComputedStyle(element).textAlign))
    .toBe('left');
});

test('raw Ant Design tables also keep header and body text left-aligned', async ({
  page
}) => {
  await page.goto('/notification/history');

  const firstHeaderCell = page.locator('.ant-table-thead > tr > th').first();
  const firstBodyCell = page.locator('.ant-table-tbody > tr > td').first();

  await expect
    .poll(() => firstHeaderCell.evaluate((element) => window.getComputedStyle(element).textAlign))
    .toBe('left');
  await expect
    .poll(() => firstBodyCell.evaluate((element) => window.getComputedStyle(element).textAlign))
    .toBe('left');
});
