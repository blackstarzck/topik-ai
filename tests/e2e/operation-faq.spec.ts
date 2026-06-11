import { expect, test } from '@playwright/test';

import {
  confirmVisibleAction,
  expectAuditHref,
  expectNotificationAuditHref,
  expectQueryParam,
  expectRowVisible
} from './source-flow-helpers';

test('operation FAQ seed opens from URL and toggles through service facade', async ({
  page
}) => {
  await page.goto('/operation/faq?selected=FAQ-001');

  await expectQueryParam(page, 'selected', 'FAQ-001');
  await expectRowVisible(page, 'FAQ-001');
  const drawer = page.locator('.ant-drawer-content-wrapper:visible').last();
  await expect(drawer).toBeVisible();
  await expect(drawer).toContainText('FAQ-001');
  await expectAuditHref(drawer, 'OperationFaq', 'FAQ-001');

  await drawer.locator('.ant-drawer-footer button').nth(2).click();
  await confirmVisibleAction(page, 'e2e operation faq source transition');
  await expectNotificationAuditHref(page, 'OperationFaq', 'FAQ-001');
});
