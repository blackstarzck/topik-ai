import { expect, type Locator, type Page } from '@playwright/test';

export async function getVisibleModal(page: Page): Promise<Locator> {
  const modal = page.locator('.ant-modal:visible').last();
  await expect(modal).toBeVisible();
  return modal;
}

export async function getVisibleDrawer(page: Page): Promise<Locator> {
  const drawer = page.locator('.ant-drawer-content-wrapper:visible').last();
  await expect(drawer).toBeVisible();
  return drawer;
}

export async function fillTextboxAt(
  container: Locator,
  index: number,
  value: string
): Promise<void> {
  await container.getByRole('textbox').nth(index).fill(value);
}

export async function submitVisibleModal(
  page: Page,
  testId: string
): Promise<void> {
  const modal = await getVisibleModal(page);
  await modal.getByTestId(testId).click();
}

export async function confirmVisibleReasonModal(
  page: Page,
  reason: string
): Promise<void> {
  const modal = await getVisibleModal(page);
  await modal.getByRole('textbox').fill(reason);
  await modal.locator('.ant-modal-footer .ant-btn-primary').click();
}

export async function closeNamedDialog(
  page: Page,
  titlePattern: RegExp,
  buttonName = '닫기'
): Promise<void> {
  await page
    .getByRole('dialog', { name: titlePattern })
    .getByRole('button', { name: buttonName })
    .click();
}
