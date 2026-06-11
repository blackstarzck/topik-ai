import { expect, test } from '@playwright/test';

import {
  expectQueryParam,
  expectRowVisible,
  openRowOverlay
} from './source-flow-helpers';

test('system audit logs merge mock and store audits in service and preserve target routing', async ({
  page
}) => {
  await page.goto('/system/audit-logs?targetType=Commerce&targetId=RF-002');

  await expectQueryParam(page, 'targetType', 'Commerce');
  await expectQueryParam(page, 'targetId', 'RF-002');
  const row = await expectRowVisible(page, 'AL-10002');
  await expect(row.locator('a[href*="/commerce/refunds?keyword=RF-002"]')).toBeVisible();

  const modal = await openRowOverlay(page, 'AL-10002');
  await expect(modal).toContainText('AL-10002');
  await expect(modal).toContainText('RF-002');
});
