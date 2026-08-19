import { expect, test } from '@playwright/test';

import { expectQueryParam, openRowOverlay } from './source-flow-helpers';

test('message groups row opens the editor drawer with derived summary values', async ({
  page
}) => {
  await page.goto('/messages/groups');

  const drawer = await openRowOverlay(page, 'GRP-001');
  await expectQueryParam(page, 'selected', 'GRP-001');
  await expect(drawer).toContainText('그룹 ID: GRP-001');
  await expect(drawer).toContainText('예상 발송 인원');
  await expect(drawer).toContainText('5,172명');
});

test('query-builder group renders detail conditions and switches preview modes', async ({
  page
}) => {
  await page.goto('/messages/groups');

  const drawer = await openRowOverlay(page, 'GRP-002');
  await expect(drawer).toContainText('상세 조건');
  await expect(drawer).toContainText('변환된 쿼리');

  await drawer.getByRole('button', { name: 'JSON으로 변환' }).click();
  await expect(drawer.locator('textarea[readonly]')).toHaveValue(/"combinator"/);
});

test('create drawer switches to a static group and shows the member list input', async ({
  page
}) => {
  await page.goto('/messages/groups');

  await page.getByRole('button', { name: '그룹 추가' }).click();
  await expectQueryParam(page, 'editor', 'create');
  const drawer = page.locator('.ant-drawer-content');
  await expect(drawer).toContainText('설정 유형');

  await drawer
    .locator('.message-groups-editor-row', { hasText: '정의 방식' })
    .locator('.ant-select')
    .first()
    .click();
  await page.locator('.ant-select-item-option', { hasText: '정적 그룹' }).click();

  await expect(
    drawer.getByPlaceholder('한 줄에 하나씩 이메일 또는 사용자 식별자를 입력하세요.')
  ).toBeVisible();
});
