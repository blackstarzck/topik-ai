import { expect, test } from '@playwright/test';

/**
 * System > 관리자 계정 성공 경로 스모크.
 *
 * 이 화면의 조회 서비스는 `{ ok, data, error: string }` 비표준 계약을 쓰다가
 * `SafeResult` 로 정규화되고, 수기 fetch 배선이 공용 훅(`useAsyncResource`)으로
 * 옮겨졌다(gap-register §3.13 ⑧). 전환 전에는 e2e 커버가 없어서 목록 로드와
 * 요약 카운트, 검색 경로를 여기서 고정한다.
 */
test('관리자 목록이 로드되고 요약 건수가 함께 그려진다', async ({ page }) => {
  await page.goto('/system/admins');

  await expect(page.getByRole('heading', { name: '관리자 계정' })).toBeVisible();

  const rows = page.locator('.ant-table-tbody tr.ant-table-row');
  await expect(rows.filter({ hasText: '박수민' })).toHaveCount(1);
  await expect(rows.filter({ hasText: '김서영' })).toHaveCount(1);
  await expect(rows.filter({ hasText: '한지우' })).toHaveCount(1);

  // 요약 건수는 목록과 같은 응답에서 파생된다 — 0 이면 로드가 안 된 것이다.
  await expect(page.locator('.ant-card').first()).toContainText(/총 [1-9]\d*건/);
});

test('키워드 검색이 목록을 좁히고 URL 에 남는다', async ({ page }) => {
  await page.goto('/system/admins');

  const rows = page.locator('.ant-table-tbody tr.ant-table-row');
  await expect(rows.filter({ hasText: '김서영' })).toHaveCount(1);

  await page.getByPlaceholder('관리자 계정 검색').fill('박수민');
  await page.getByPlaceholder('관리자 계정 검색').press('Enter');

  await expect(page).toHaveURL(/keyword=/);
  await expect(rows.filter({ hasText: '박수민' })).toHaveCount(1);
  await expect(rows.filter({ hasText: '김서영' })).toHaveCount(0);
});
