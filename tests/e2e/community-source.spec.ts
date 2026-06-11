import { expect, test } from '@playwright/test';

import {
  confirmVisibleAction,
  expectAuditHref,
  expectNotificationAuditHref,
  expectQueryParam,
  expectRowVisible,
  openRowOverlay,
  rowById
} from './source-flow-helpers';

test('community posts use service-backed seed for list, URL restore, action, detail, and audit link', async ({
  page
}) => {
  await page.goto('/community/posts?searchField=id&keyword=POST-001');

  await expectQueryParam(page, 'searchField', 'id');
  await expectQueryParam(page, 'keyword', 'POST-001');
  const postRow = await expectRowVisible(page, 'POST-001');

  await postRow.locator('.ant-switch').click();
  await confirmVisibleAction(page, 'e2e community source transition', {
    selectFirstPolicy: true
  });
  await expect(postRow.locator('.ant-switch')).not.toHaveClass(/ant-switch-checked/);
  await expectNotificationAuditHref(page, 'Community', 'POST-001');

  const drawer = await openRowOverlay(page, 'POST-001');
  await expect(drawer).toContainText('POST-001');
  await expectAuditHref(drawer, 'Community', 'POST-001');
});

test('community reports keep report seed behind service and resolve through action facade', async ({
  page
}) => {
  await page.goto('/community/reports?searchField=id&keyword=RP-001');

  await expectQueryParam(page, 'searchField', 'id');
  await expectQueryParam(page, 'keyword', 'RP-001');
  const reportRow = await expectRowVisible(page, 'RP-001');
  await expect(reportRow.locator('a[href*="/community/posts?keyword=POST-002"]')).toBeVisible();

  await reportRow.locator('button').first().click();
  await page.locator('.ant-dropdown:visible .table-action-menu__footer-button').first().click();
  await confirmVisibleAction(page, 'e2e community report source transition');
  await expectNotificationAuditHref(page, 'Community', 'POST-002');

  const rowAfterAction = rowById(page, 'RP-001');
  await expect(rowAfterAction).toContainText('RP-001');
});
