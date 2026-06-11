import { expect, type Locator, type Page } from '@playwright/test';

export function rowById(page: Page, id: string): Locator {
  const escapedId = id.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return page
    .locator(`tr[data-row-key="${escapedId}"]`)
    .or(page.locator('tr').filter({ hasText: id }))
    .first();
}

export async function expectRowVisible(page: Page, id: string): Promise<Locator> {
  const row = rowById(page, id);
  await expect(row).toBeVisible();
  return row;
}

export async function expectQueryParam(
  page: Page,
  key: string,
  value: string
): Promise<void> {
  await expect.poll(() => new URL(page.url()).searchParams.get(key)).toBe(value);
}

export async function openRowOverlay(page: Page, id: string): Promise<Locator> {
  const row = await expectRowVisible(page, id);
  await row.click();
  const overlay = page.locator('.ant-drawer-content-wrapper:visible, .ant-modal:visible').last();
  await expect(overlay).toBeVisible();
  return overlay;
}

export async function confirmVisibleAction(
  page: Page,
  reason: string,
  options: { selectFirstPolicy?: boolean } = {}
): Promise<void> {
  const modal = page.locator('.ant-modal:visible').last();
  await expect(modal).toBeVisible();

  if (options.selectFirstPolicy) {
    const policySelect = modal.locator('.ant-select').first();
    await expect(policySelect).toBeVisible();
    await policySelect.click();
    await page.locator('.ant-select-dropdown:visible .ant-select-item-option').first().click();
  }

  await modal.getByRole('textbox').fill(reason);
  await modal.locator('.ant-modal-footer .ant-btn-primary').click();
  await expect(modal).not.toBeVisible();
}

export async function expectAuditHref(
  scope: Page | Locator,
  targetType: string,
  targetId: string
): Promise<void> {
  const targetTypeParam = encodeURIComponent(targetType);
  const targetIdParam = encodeURIComponent(targetId);
  const auditLink = scope.locator(
    `a[href*="/system/audit-logs"][href*="targetType=${targetTypeParam}"][href*="targetId=${targetIdParam}"]`
  );

  await expect(auditLink.first()).toBeVisible();
}

export async function expectNotificationAuditHref(
  page: Page,
  targetType: string,
  targetId: string
): Promise<void> {
  await expectAuditHref(page.locator('.ant-notification-notice'), targetType, targetId);
}
