import { expect, test } from '@playwright/test';

/**
 * Users > 회원 상세 > 학습 현황 탭 — writing 중심 재정의(20260708130000) 검증.
 * mock 모드(VITE_SUPABASE_DISABLED)에서 getMockUserLearningOverview 계약이
 * 새 화면 블록(TOPIK 쓰기 요약/문항별/태그별/약점/최근 작문/객관식 분리)을
 * 렌더하는지 확인한다. "미수집" 라벨(소요 시간 0분과 구분)도 함께 검증한다.
 */

test('user detail learning tab renders writing-first blocks', async ({ page }) => {
  await page.goto('/users/U00001?tab=learning');

  // 온보딩 카드 + writing 중심 요약
  await expect(page.getByText('온보딩 현황')).toBeVisible();
  await expect(page.getByText('TOPIK 쓰기 요약')).toBeVisible();
  await expect(page.getByText('총 제출 수')).toBeVisible();
  await expect(page.getByText('피드백(완료/대기/실패)')).toBeVisible();
  await expect(page.getByText('평균 점수(100점 환산)')).toBeVisible();
  await expect(page.getByText('피드백 열람률')).toBeVisible();
  await expect(page.getByText('연속 학습일(학습 이벤트 기준)')).toBeVisible();

  // 문항별 성과: 51~54 전 행 노출 + 53/54 소요 시간 미수집 라벨
  // (문항 번호 셀은 최근 작문 표에도 있어 first()로 존재만 검증)
  await expect(page.getByText('문항별 성과 (51~54번)')).toBeVisible();
  for (const q of ['51번', '52번', '53번', '54번']) {
    await expect(
      page.getByRole('cell', { name: q, exact: true }).first()
    ).toBeVisible();
  }
  await expect(page.getByRole('cell', { name: '미수집' }).first()).toBeVisible();

  // 태그별 성과 + 약점 + 최근 작문
  await expect(page.getByText('태그별 성과')).toBeVisible();
  await expect(page.getByRole('cell', { name: '주거와 환경' })).toBeVisible();
  await expect(page.getByText('약점 영역', { exact: true })).toBeVisible();
  await expect(page.getByText('최근 작문 채점')).toBeVisible();
  await expect(
    page.getByRole('cell', { name: '열람', exact: true }).first()
  ).toBeVisible();
  await expect(
    page.getByRole('cell', { name: '미열람', exact: true }).first()
  ).toBeVisible();

  // 작문 차원 슬러그는 한글 라벨로 렌더된다(structure → 구성)
  await expect(
    page.getByRole('cell', { name: '구성', exact: true }).first()
  ).toBeVisible();

  // 객관식(problem_attempts) 블록은 라벨로 분리 표시
  await expect(page.getByText('객관식 학습(별도 원천)')).toBeVisible();
  await expect(
    page.getByText('객관식 기능 도입 전까지는 수집 전 상태로 0이 표시됩니다', {
      exact: false
    })
  ).toBeVisible();

  // 구 problem_attempts 중심 KPI 라벨은 더 이상 없다
  await expect(page.getByText('영역별 정답률')).toHaveCount(0);
  await expect(page.getByText('최근 풀이 이력')).toHaveCount(0);
});

test('learning tab keeps tab state in the URL', async ({ page }) => {
  await page.goto('/users/U00003?tab=learning');
  await expect(page.getByText('TOPIK 쓰기 요약')).toBeVisible();

  // 다른 탭으로 이동해도 URL 파라미터로 복원 가능
  await page.getByRole('tab', { name: '프로필' }).click();
  await expect.poll(() => new URL(page.url()).search).toContain('tab=profile');
});
