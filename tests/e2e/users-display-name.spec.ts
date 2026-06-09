import { expect, test } from '@playwright/test';

test('Users list and detail show member name without duplicated ID', async ({
  page
}) => {
  await page.goto('/users');

  await expect(page.getByRole('heading', { name: '회원 목록' })).toBeVisible();

  const firstMemberLink = page
    .locator('main a.table-navigation-link[href^="/users/"][href*="?tab=profile"]')
    .first();
  await expect(firstMemberLink).toBeVisible();

  const memberName = (await firstMemberLink.innerText()).trim();
  expect(memberName).not.toContain('(');
  expect(memberName).not.toContain(')');

  const firstMemberRow = firstMemberLink.locator('xpath=ancestor::tr');
  const nicknameCell = firstMemberRow.locator('td').nth(2);
  await expect(nicknameCell).toBeVisible();
  await expect(nicknameCell).not.toHaveText(memberName);

  await firstMemberLink.click();

  await expect(page.getByRole('heading', { name: 'Users 상세' })).toBeVisible();
  await expect(page.getByText('사용자 ID', { exact: true })).toBeVisible();

  const nameCell = page
    .locator('.ant-descriptions-item-label', { hasText: /^이름$/ })
    .first()
    .locator('xpath=following-sibling::*[contains(@class, "ant-descriptions-item-content")]');

  await expect(nameCell).toHaveText(memberName);
  await expect(nameCell).not.toContainText(/\(.+\)/);
});
