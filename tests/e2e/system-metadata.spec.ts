import { expect, test, type Locator, type Page } from '@playwright/test';

async function getVisibleModal(page: Page): Promise<Locator> {
  const modal = page.locator('.ant-modal:visible').last();
  await expect(modal).toBeVisible();
  return modal;
}

async function getVisibleDrawer(page: Page): Promise<Locator> {
  const drawer = page.locator('.ant-drawer-content-wrapper:visible').last();
  await expect(drawer).toBeVisible();
  return drawer;
}

async function fillTextboxAt(container: Locator, index: number, value: string) {
  await container.getByRole('textbox').nth(index).fill(value);
}

async function submitVisibleModal(page: Page, testId: string) {
  const modal = await getVisibleModal(page);
  await modal.getByTestId(testId).click();
}

async function confirmVisibleReasonModal(page: Page, reason: string) {
  const modal = await getVisibleModal(page);
  await modal.getByRole('textbox').fill(reason);
  await modal.locator('.ant-modal-footer .ant-btn-primary').click();
}

test('metadata catalog create/detail/audit flow works', async ({ page }) => {
  const uniqueSuffix = Date.now().toString().slice(-6);
  const groupName = `e2e metadata group ${uniqueSuffix}`;
  const codePrefix = `E2E_META_${uniqueSuffix}`;

  await page.goto('/system/metadata');
  await expect(page.locator('h3').first()).toBeVisible();

  await page.getByTestId('create-group-button').click();

  const groupModal = await getVisibleModal(page);
  await expect(groupModal.locator('.admin-form-descriptions')).toBeVisible();

  await fillTextboxAt(groupModal, 0, groupName);
  await fillTextboxAt(groupModal, 1, 'OPS_ADMIN');
  await fillTextboxAt(groupModal, 2, codePrefix);
  await fillTextboxAt(
    groupModal,
    3,
    'e2e validation group for operational metadata self-service management'
  );
  await fillTextboxAt(groupModal, 4, '/system/metadata');
  await fillTextboxAt(groupModal, 5, '마이페이지 > 배지');
  await fillTextboxAt(groupModal, 6, 'system_metadata_groups');

  await submitVisibleModal(page, 'group-submit-button');

  const createdDrawer = await getVisibleDrawer(page);
  await expect(createdDrawer).toContainText(groupName);

  await createdDrawer.getByTestId('create-item-button').click();

  const itemModal = await getVisibleModal(page);
  await expect(itemModal.locator('.admin-form-descriptions')).toBeVisible();
  await itemModal.locator('.ant-modal-close').click();
  await expect(itemModal).toBeHidden();

  await createdDrawer.locator('.ant-drawer-close').click();
  await expect(createdDrawer).toBeHidden();

  const searchInput = page.getByRole('textbox').first();
  await searchInput.fill(groupName);
  await expect.poll(() => new URL(page.url()).searchParams.get('keyword')).toBe(groupName);

  const row = page.locator('tbody tr').filter({ hasText: groupName }).first();
  await expect(row).toBeVisible();
  await row.locator('td').first().click();

  const selectedDrawer = await getVisibleDrawer(page);
  await expect(selectedDrawer).toContainText(groupName);
  const groupId = (await selectedDrawer.getByText(/META-GRP-/).first().innerText()).trim();

  await selectedDrawer.locator('.ant-drawer-footer .ant-btn').last().click();
  await confirmVisibleReasonModal(page, 'e2e deactivation');

  await selectedDrawer.getByRole('link').first().click();
  await expect(page).toHaveURL(
    new RegExp(`/system/audit-logs\\?targetType=SystemMetadataGroup&targetId=${groupId}`)
  );

  const auditRow = page
    .locator('tbody tr')
    .filter({ hasText: groupId })
    .filter({ hasText: 'group_deactivated' })
    .first();
  await expect(auditRow).toBeVisible();
});

test('item reorder updates table and audit log', async ({ page }) => {
  await page.goto('/system/metadata?selected=META-GRP-004');

  const drawer = await getVisibleDrawer(page);
  const itemTable = drawer.locator('.ant-table-wrapper').first();
  const itemRows = itemTable.locator('tbody tr').filter({
    has: page.getByRole('button', { name: '운영 값 순서 변경' })
  });
  const dragHandles = itemTable.getByRole('button', { name: '운영 값 순서 변경' });
  await expect(itemRows).toHaveCount(2);
  await expect(dragHandles).toHaveCount(2);

  const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
  await dragHandles.nth(1).dispatchEvent('dragstart', { dataTransfer });
  await itemRows.first().dispatchEvent('dragover', { dataTransfer });
  await itemRows.first().dispatchEvent('drop', { dataTransfer });
  await dragHandles.nth(1).dispatchEvent('dragend', { dataTransfer });

  await expect(itemRows.first()).toContainText('SPECIFIC_CATEGORY');
  await expect(itemRows.nth(1)).toContainText('ALL_PRODUCTS');

  await drawer.getByRole('link').first().click();
  await expect(page).toHaveURL(
    /\/system\/audit-logs\?targetType=SystemMetadataGroup&targetId=META-GRP-004/
  );

  const auditRow = page
    .locator('tbody tr')
    .filter({ hasText: 'META-GRP-004' })
    .filter({ hasText: 'item_reordered' })
    .first();
  await expect(auditRow).toBeVisible();
});

test('duplicate item code and label are blocked in modal validation', async ({ page }) => {
  await page.goto('/system/metadata?selected=META-GRP-004');

  const drawer = await getVisibleDrawer(page);
  await drawer.getByTestId('create-item-button').click();

  const itemModal = await getVisibleModal(page);
  await fillTextboxAt(itemModal, 0, 'ALL_PRODUCTS');
  await fillTextboxAt(itemModal, 1, '전체 상품');
  await fillTextboxAt(itemModal, 2, '중복 검증용 설명');

  await submitVisibleModal(page, 'item-submit-button');
  await expect(itemModal.locator('.ant-form-item-explain-error')).toHaveCount(2);
});

test('tree hover delete and edit modal delete both work', async ({ page }) => {
  await page.goto('/system/metadata?selected=META-GRP-004');

  const drawer = await getVisibleDrawer(page);

  const firstTreeItem = drawer.getByTestId('metadata-tree-item-META-ITEM-008');
  await firstTreeItem.hover();
  await expect(drawer.getByTestId('metadata-tree-delete-button-META-ITEM-008')).toBeVisible();
  await drawer.getByTestId('metadata-tree-delete-button-META-ITEM-008').click();

  await confirmVisibleReasonModal(page, 'tree hover delete');
  await expect(drawer.getByTestId('metadata-tree-item-META-ITEM-008')).toHaveCount(0);

  await drawer.getByTestId('metadata-tree-item-META-ITEM-009').click();
  const editModal = await getVisibleModal(page);
  await expect(editModal.getByTestId('metadata-item-delete-button')).toBeVisible();
  await editModal.getByTestId('metadata-item-delete-button').click();

  await confirmVisibleReasonModal(page, 'modal delete');
  await expect(drawer.locator('[data-testid^="metadata-tree-item-"]')).toHaveCount(0);

  await drawer.getByRole('link').first().click();
  await expect(page).toHaveURL(
    /\/system\/audit-logs\?targetType=SystemMetadataGroup&targetId=META-GRP-004/
  );

  const deleteRows = page
    .locator('tbody tr')
    .filter({ hasText: 'META-GRP-004' })
    .filter({ hasText: 'item_deleted' });
  await expect(deleteRows).toHaveCount(2);
});
