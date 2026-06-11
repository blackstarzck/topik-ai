import { expect, test } from '@playwright/test';

import {
  confirmVisibleAction,
  expectNotificationAuditHref,
  expectQueryParam,
  expectRowVisible
} from './source-flow-helpers';

test('operation notices read seed through service and keep preview URL plus status action', async ({
  page
}) => {
  await page.goto('/operation/notices?preview=NOTICE-001');

  await expectQueryParam(page, 'preview', 'NOTICE-001');
  const noticeRow = await expectRowVisible(page, 'NOTICE-001');
  const previewModal = page.locator('.ant-modal:visible').last();
  await expect(previewModal).toContainText('NOTICE-001');
  await previewModal.getByRole('button', { name: '닫기' }).click();
  await expect(previewModal).not.toBeVisible();
  await expect.poll(() => new URL(page.url()).searchParams.get('preview')).toBeNull();

  await noticeRow.locator('.ant-switch').click();
  await confirmVisibleAction(page, 'e2e operation notice source transition');
  await expectNotificationAuditHref(page, 'Operation', 'NOTICE-001');
});
