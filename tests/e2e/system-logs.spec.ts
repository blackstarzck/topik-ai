import { expect, test } from '@playwright/test';

import {
  expectQueryParam,
  expectRowVisible,
  openRowOverlay
} from './source-flow-helpers';

test('system logs read mock-system-logs through service and keep audit-log navigation available', async ({
  page
}) => {
  await page.goto('/system/logs?searchField=id&keyword=SYS-001');

  await expectQueryParam(page, 'searchField', 'id');
  await expectQueryParam(page, 'keyword', 'SYS-001');
  await expectRowVisible(page, 'SYS-001');
  await expect(page.locator('a[href="/system/audit-logs"]')).toBeVisible();

  const modal = await openRowOverlay(page, 'SYS-001');
  await expect(modal).toContainText('SYS-001');
  await expect(modal).toContainText('notification-worker');
});
