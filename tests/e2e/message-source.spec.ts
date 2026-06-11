import { expect, test } from '@playwright/test';

import {
  confirmVisibleAction,
  expectAuditHref,
  expectNotificationAuditHref,
  expectQueryParam,
  expectRowVisible,
  openRowOverlay
} from './source-flow-helpers';

test('message templates and histories render from service facade and keep actions live', async ({
  page
}) => {
  await page.goto('/messages/mail?tab=auto&searchField=id&keyword=MAIL-AUTO-001');

  await expectQueryParam(page, 'tab', 'auto');
  await expectQueryParam(page, 'keyword', 'MAIL-AUTO-001');
  const templateRow = await expectRowVisible(page, 'MAIL-AUTO-001');
  await templateRow.locator('.ant-switch').click();
  await confirmVisibleAction(page, 'e2e message template source transition');
  await expectNotificationAuditHref(page, 'Message', 'MAIL-AUTO-001');

  const previewModal = await openRowOverlay(page, 'MAIL-AUTO-001');
  await expect(previewModal).toContainText('MAIL-AUTO-001');
  await page.keyboard.press('Escape');

  await page.goto('/messages/history?channel=mail&searchField=id&keyword=MSG-HIS-0001');
  await expectQueryParam(page, 'channel', 'mail');
  await expectQueryParam(page, 'keyword', 'MSG-HIS-0001');

  const historyDrawer = await openRowOverlay(page, 'MSG-HIS-0001');
  await expect(historyDrawer).toContainText('MSG-HIS-0001');
  await expectAuditHref(historyDrawer, 'Message', 'MSG-HIS-0001');

  await historyDrawer.locator('button:has(.anticon-reload)').click();
  await confirmVisibleAction(page, 'e2e message retry source transition');
  await expectNotificationAuditHref(page, 'Message', 'MSG-HIS-0006');
});
