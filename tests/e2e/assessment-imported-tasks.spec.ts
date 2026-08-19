import { expect, test } from '@playwright/test';

import { expectRowVisible } from './source-flow-helpers';

// Phase 3b 확산: 인박스 로더(useImportedTasks)가 useAsyncResource 위임으로
// 바뀐 뒤에도 mock 픽스처 행이 서비스 경로로 렌더되는 성공 경로를 고정한다.
test('imported tasks inbox lists mock fixture rows through the service path', async ({
  page
}) => {
  await page.goto('/assessment/question-bank/imported');

  await expect(
    page.getByRole('heading', { name: '가져온 문항(인박스)' })
  ).toBeVisible();
  await expectRowVisible(page, 'mock-task-51-0001');
});
