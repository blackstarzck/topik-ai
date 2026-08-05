import { expect, test } from '@playwright/test';

// analytics.read 없는 관리자(fixture)로 직접 URL 진입 시 403 안내를 확인한다.
// 이 스펙은 playwright.analytics-permission.config.ts 로만 실행된다
// (기본 config 의 mock 세션은 전 권한이라 403 분기가 발화하지 않는다).

test('학습 분석 직접 URL 은 권한 안내를 표시하고 통계를 렌더하지 않는다', async ({ page }) => {
  await page.goto('/analytics/learning');

  // 공통 셸(테마 래퍼·루트 testid·PageTitle)은 유지된 채 403 결과만 노출된다.
  const root = page.getByTestId('analytics-learning-page');
  await expect(root).toBeVisible();
  await expect(root.locator('.ant-result-403')).toHaveCount(1);
  await expect(root.getByText('통계 조회 권한이 없습니다.')).toBeVisible();
  await expect(root.getByRole('button', { name: '이전 화면' })).toBeVisible();

  // 통계 본문(액션 버튼·데이터 갱신 meta)은 렌더되지 않아야 한다.
  await expect(root.getByRole('button', { name: /CSV 내보내기/ })).toHaveCount(0);
  await expect(root.getByText(/데이터 갱신/)).toHaveCount(0);
});

test('분석 개요 직접 URL 도 같은 권한 안내를 표시한다', async ({ page }) => {
  await page.goto('/analytics/overview');

  await expect(page.locator('.ant-result-403')).toHaveCount(1);
  await expect(page.getByText('통계 조회 권한이 없습니다.')).toBeVisible();
  // 전체 렌더의 기간 선택 카드가 없어야 한다.
  await expect(page.getByText('조회 기간')).toHaveCount(0);
});

test('사이드바 메뉴에서 분석 항목이 숨겨진다', async ({ page }) => {
  await page.goto('/analytics/learning');
  await expect(page.locator('.ant-result-403')).toHaveCount(1);

  // 메뉴 게이팅(analytics.read)이 같은 판정을 내야 한다 — 사이드바에 분석 하위
  // 항목이 없어야 한다. 본문(403 PageTitle)의 "학습 분석" 텍스트와 구분하기 위해
  // 사이드바 컨테이너로 스코프를 좁힌다.
  const sider = page.locator('.ant-layout-sider');
  await expect(sider).toBeVisible();
  await expect(sider.getByText('학습 분석')).toHaveCount(0);
});
