import { expect, test } from '@playwright/test';

/**
 * Analytics > 학습 분석 탭(20260708140000, get_admin_learning_analytics) 검증.
 * mock 모드(VITE_SUPABASE_DISABLED)에서 페이지가 계약과 같은 모양의 목업을
 * 렌더하고, 기간 필터(7/30/90/전체)가 URL에 유지되는지 확인한다.
 */

test('analytics learning page renders learning KPIs and tables', async ({ page }) => {
  await page.goto('/analytics/learning');

  await expect(page.getByRole('heading', { name: '학습 분석' })).toBeVisible();

  // 활성 기준(학습 이벤트)과 점수 기준(100점 환산)이 라벨에 명시된다
  await expect(page.getByText('학습 활성 사용자(학습 이벤트 기준)')).toBeVisible();
  await expect(page.getByText('평균 점수(100점 환산)')).toBeVisible();
  await expect(page.getByText('피드백 완료율')).toBeVisible();
  await expect(page.getByText('피드백 열람률')).toBeVisible();
  await expect(page.getByText('피드백 처리 시간(중앙값)')).toBeVisible();

  // 소요 시간은 수집 전이므로 "미수집"으로 표시(0분 아님)
  await expect(page.getByText('평균 소요 시간').first()).toBeVisible();
  await expect(page.getByText('미수집').first()).toBeVisible();

  // 문항별/분포/차원/태그 테이블
  await expect(page.getByText('문항별 성과 (51~54번)')).toBeVisible();
  for (const q of ['51번', '52번', '53번', '54번']) {
    await expect(
      page.getByRole('cell', { name: q, exact: true }).first()
    ).toBeVisible();
  }
  await expect(page.getByText('점수 분포(100점 환산)')).toBeVisible();
  await expect(page.getByRole('cell', { name: '80-100' })).toBeVisible();
  await expect(page.getByText('취약 평가 차원')).toBeVisible();
  await expect(page.getByRole('cell', { name: '내용', exact: true })).toBeVisible();
  await expect(page.getByText('태그별 성과 (제출 수 상위 12개)')).toBeVisible();
});

test('analytics learning period filter persists in the URL', async ({ page }) => {
  await page.goto('/analytics/learning');

  // AntD Segmented의 radio input은 시각적으로 숨겨져 있어 라벨을 클릭한다.
  await page.locator('.ant-segmented-item-label', { hasText: '최근 7일' }).click();
  await expect.poll(() => new URL(page.url()).search).toContain('period=7d');

  await page.locator('.ant-segmented-item-label', { hasText: '전체' }).click();
  await expect.poll(() => new URL(page.url()).search).toContain('period=all');

  // 새로고침 후에도 기간 유지
  await page.reload();
  await expect(page.getByRole('heading', { name: '학습 분석' })).toBeVisible();
  await expect.poll(() => new URL(page.url()).search).toContain('period=all');
});

test('analytics menu exposes overview and learning children', async ({ page }) => {
  await page.goto('/analytics/overview');

  // 통계 서브메뉴(접힘 가능)를 열고 학습 분석으로 이동
  const learningMenuItem = page.getByRole('menuitem', { name: '학습 분석' });
  if (!(await learningMenuItem.isVisible())) {
    await page.getByRole('menuitem', { name: '통계' }).click();
  }
  await expect(learningMenuItem).toBeVisible();
  await learningMenuItem.click();
  await expect.poll(() => new URL(page.url()).pathname).toBe('/analytics/learning');
  await expect(page.getByRole('heading', { name: '학습 분석' })).toBeVisible();
});
