import { expect, test } from '@playwright/test';

// 회원 상세 > 학습 현황 탭 (mock 모드). Supabase 미설정 시 getMockUserLearningOverview
// 가 집계 계약을 그대로 채우므로, 탭 선택과 각 섹션 렌더만 검증한다.
// writing 중심 재정의(20260708130000) 이후의 섹션 구성 기준 — 상세 검증은
// users-learning-tab.spec.ts 가 담당한다.
test('회원 상세 학습 현황 탭이 mock 데이터로 렌더된다', async ({ page }) => {
  await page.goto('/users/U00001?tab=learning');

  const learningTab = page.getByRole('tab', { name: '학습 현황' });
  await expect(learningTab).toBeVisible();
  await expect(learningTab).toHaveAttribute('aria-selected', 'true');

  // 요약 KPI (writing 중심)
  await expect(page.getByText('TOPIK 쓰기 요약')).toBeVisible();
  await expect(page.getByText('총 제출 수')).toBeVisible();
  // 섹션 헤더
  await expect(page.getByText('문항별 성과 (51~54번)')).toBeVisible();
  await expect(page.getByText('태그별 성과')).toBeVisible();
  await expect(page.getByText('약점 영역', { exact: true })).toBeVisible();
  await expect(page.getByText('최근 작문 채점')).toBeVisible();
  await expect(page.getByText('객관식 학습(별도 원천)')).toBeVisible();
});
