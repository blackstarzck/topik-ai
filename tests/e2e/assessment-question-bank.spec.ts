import { expect, test, type Page } from '@playwright/test';

/**
 * 재정의 P3 spec (인바운드 모델 — 결정 기록 §0, 실행계획안 2026-06-11 개정 §7):
 * Supabase가 구성되지 않은 실행은 D-12 모크 모드로 동작한다 — 결정적 픽스처
 * 4문항(번호별 1건)으로 문항 목록·상세(조회 전용)·관리 페이지를 검증한다.
 * 검수 표면은 제거됐다(검수 시나리오 없음 — 관리 쓰기 왕복은 P4 RT-4).
 * Supabase가 구성된 실행은 로그인 자격증명이 없으므로 skip한다.
 */

async function skipIfAuthRequired(page: Page): Promise<void> {
  const loginHeading = page.getByRole('heading', { name: 'TOPIK 관리자 로그인' });

  if (await loginHeading.isVisible().catch(() => false)) {
    test.skip(true, 'Supabase auth is configured for this run; login credentials are not part of this e2e.');
  }
}

const MOCK_BANNER = '모크 모드로 동작 중입니다.';

test('TOPIK 쓰기 문항 목록은 모크 모드에서 조회 전용으로 렌더된다', async ({
  page
}) => {
  await page.goto('/assessment/question-bank');
  await skipIfAuthRequired(page);

  await expect(
    page.getByRole('heading', { name: 'TOPIK 쓰기 문항 목록' })
  ).toBeVisible();
  await expect(page.getByText(MOCK_BANNER)).toBeVisible();
  await expect(page.getByLabel('문항 검색어')).toBeVisible();

  await expect(page.getByRole('columnheader', { name: '문항 번호' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: '문항 ID' })).toBeVisible();
  await expect(
    page.getByRole('columnheader', { name: '주제(종합/세부)' })
  ).toBeVisible();
  await expect(
    page.getByRole('columnheader', { name: '상황 요약' })
  ).toBeVisible();
  await expect(page.getByRole('columnheader', { name: /노출 상태/ })).toBeVisible();

  // 검수 표면 부재: 검수 컬럼·검수 카드가 렌더되지 않는다.
  await expect(page.getByRole('columnheader', { name: /검수 상태/ })).toHaveCount(0);
  await expect(page.getByText('검수 완료', { exact: true })).toHaveCount(0);

  // antd measure-row 제외, 실데이터 행만 센다.
  await expect(page.locator('tbody tr.ant-table-row')).toHaveCount(4);
  await expect(page.getByText('topik-writing-51-9901')).toBeVisible();

  // 구 JSON mock ID 체계는 복구되지 않는다.
  await expect(page.getByText('AQ-51001')).toHaveCount(0);
});

test('문항 상세는 번호별 실메타를 조회 전용으로 표시하고 잘못된 ID는 오류로 처리한다', async ({
  page
}) => {
  await page.goto('/assessment/question-bank/topik-writing-52-9901');
  await skipIfAuthRequired(page);

  await expect(
    page.getByRole('heading', { name: 'TOPIK 52번 문항 상세' })
  ).toBeVisible();
  await expect(page.getByText('문항 본문', { exact: true })).toBeVisible();
  await expect(
    page.getByText('연결 기능(ㄱ) / 요구 표현 기능(ㄴ)', { exact: true })
  ).toBeVisible();
  await expect(page.getByText('조건 제시 / 이유 설명')).toBeVisible();

  // 조회 전용: 검수 메모·검수 액션 표면이 없다.
  await expect(page.getByText('문항 상태', { exact: true })).toBeVisible();
  await expect(page.getByLabel('검수 메모 입력')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '검수 완료', exact: true })).toHaveCount(0);
  await expect(
    page.getByText('이 페이지는 조회 전용입니다.', { exact: false })
  ).toBeVisible();

  await page.goto('/assessment/question-bank/AQ-51001');
  await expect(page.getByText('문항을 불러오지 못했습니다.')).toBeVisible();
  await expect(page.getByRole('button', { name: '다시 시도' })).toBeVisible();
});

test('TOPIK 쓰기 문항 관리는 service_status 축과 P4 대기 안내를 노출한다', async ({
  page
}) => {
  await page.goto('/assessment/question-bank/manage');
  await skipIfAuthRequired(page);

  await expect(
    page.getByRole('heading', { name: 'TOPIK 쓰기 문항 관리' })
  ).toBeVisible();
  await expect(
    page.getByText('관리 포인트(노출 상태·태그) 조치는 준비 중입니다.')
  ).toBeVisible();
  await expect(
    page.getByText('P4(관리 포인트 개방)에서 활성화됩니다.', { exact: false })
  ).toBeVisible();
  await expect(page.getByRole('columnheader', { name: /노출 상태/ })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: /검수 상태/ })).toHaveCount(0);
  await expect(page.getByLabel('문항 검색어')).toBeVisible();

  const firstActionButton = page
    .locator('tbody tr.ant-table-row')
    .first()
    .getByRole('button', { name: '노출 가능' });
  await expect(firstActionButton).toBeDisabled();
});

test('구 검수 상세 라우트는 더 이상 검수 화면을 렌더하지 않는다', async ({
  page
}) => {
  // 구 /review/:questionId 경로는 라우터에서 제거됐다 — 동적 상세 라우트가
  // 'review'를 questionId로 해석해 조회 실패 오류를 표시한다(검수 표면 없음).
  await page.goto('/assessment/question-bank/review/topik-writing-51-9901');
  await skipIfAuthRequired(page);

  await expect(page.getByLabel('검수 메모 입력')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: /문항 검수/ })).toHaveCount(0);
});

test('AssessmentQuestion 감사 로그는 삭제된 문제은행 store audit으로 역이동하지 않는다', async ({
  page
}) => {
  await page.goto('/system/audit-logs?targetType=AssessmentQuestion&targetId=AQ-53002');
  await skipIfAuthRequired(page);

  await expect(page.getByRole('heading', { name: '감사 로그' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'AQ-53002' })).toHaveCount(0);
});
