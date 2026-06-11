import { expect, test } from '@playwright/test';

import {
  confirmVisibleAction,
  expectQueryParam,
  expectRowVisible,
  openRowOverlay
} from './source-flow-helpers';

test('commerce billing pages read billing mock seed through service and keep refund actions live', async ({
  page
}) => {
  await page.goto('/commerce/payments?searchField=id&keyword=PAY-1001');

  await expectQueryParam(page, 'searchField', 'id');
  await expectQueryParam(page, 'keyword', 'PAY-1001');
  const paymentModal = await openRowOverlay(page, 'PAY-1001');
  await expect(paymentModal).toContainText('PAY-1001');
  await paymentModal.locator('.ant-modal-close, .ant-drawer-close').click();
  await expect(paymentModal).not.toBeVisible();

  await page.goto('/commerce/refunds?searchField=id&keyword=RF-001');
  await expectQueryParam(page, 'searchField', 'id');
  await expectQueryParam(page, 'keyword', 'RF-001');
  const refundRow = await expectRowVisible(page, 'RF-001');
  const refundDrawer = await openRowOverlay(page, 'RF-001');
  await expect(refundDrawer).toContainText('RF-001');
  await refundDrawer.locator('.ant-modal-close, .ant-drawer-close').click();
  await expect(refundDrawer).not.toBeVisible();

  await refundRow.locator('button').first().click();
  await confirmVisibleAction(page, 'e2e billing refund source transition');
  await expect(
    refundRow.locator('a[href*="/system/audit-logs"][href*="targetType=Commerce"][href*="targetId=RF-001"]')
  ).toBeVisible();
});
