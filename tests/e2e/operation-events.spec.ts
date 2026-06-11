import { expect, test } from '@playwright/test';

import {
  confirmVisibleAction,
  expectAuditHref,
  expectNotificationAuditHref,
  expectQueryParam,
  expectRowVisible
} from './source-flow-helpers';

test('operation events read service-backed seed and publish action updates live state', async ({
  page
}) => {
  await page.goto('/operation/events?selected=EVT-002');

  await expectQueryParam(page, 'selected', 'EVT-002');
  await expectRowVisible(page, 'EVT-002');
  const drawer = page.locator('.ant-drawer-content-wrapper:visible').last();
  await expect(drawer).toBeVisible();
  await expect(drawer).toContainText('EVT-002');
  await expectAuditHref(drawer, 'Operation', 'EVT-002');

  await drawer.locator('.ant-drawer-footer button').nth(3).click();
  await confirmVisibleAction(page, 'e2e operation event source transition');
  await expectNotificationAuditHref(page, 'Operation', 'EVT-002');
});
