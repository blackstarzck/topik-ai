import { expect, test, type Page } from '@playwright/test';

/**
 * P3 컷오버 spec (실행계획안 §7.2): Supabase가 구성되지 않은 실행은 D-12 모크
 * 모드로 동작한다 — 결정적 픽스처 4문항(번호별 1건)으로 목록·상세·검수 write
 * 흐름을 검증한다. Supabase가 구성된 실행은 로그인 자격증명이 없으므로 skip한다
 * (실DB 대사는 RT-3/RT-4 게이트에서 별도 수행).
 */

async function skipIfAuthRequired(page: Page): Promise<void> {
  const loginHeading = page.getByRole('heading', { name: 'TOPIK 관리자 로그인' });

  if (await loginHeading.isVisible().catch(() => false)) {
    test.skip(true, 'Supabase auth is configured for this run; login credentials are not part of this e2e.');
  }
}

const MOCK_BANNER = '모크 모드로 동작 중입니다.';

test('TOPIK 쓰기 문제 검수 목록은 모크 모드에서 신규 스키마 축으로 렌더된다', async ({
  page
}) => {
  await page.goto('/assessment/question-bank');
  await skipIfAuthRequired(page);

  await expect(
    page.getByRole('heading', { name: 'TOPIK 쓰기 문제 검수' })
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

  // antd measure-row 제외, 실데이터 행만 센다.
  await expect(page.locator('tbody tr.ant-table-row')).toHaveCount(4);
  await expect(page.getByText('topik-writing-51-9901')).toBeVisible();

  // 구 JSON mock ID 체계는 복구되지 않는다.
  await expect(page.getByText('AQ-51001')).toHaveCount(0);
});

test('검수 상세는 번호별 실메타를 표시하고 잘못된 ID는 오류로 처리한다', async ({
  page
}) => {
  await page.goto('/assessment/question-bank/review/topik-writing-52-9901');
  await skipIfAuthRequired(page);

  await expect(
    page.getByRole('heading', { name: 'TOPIK 52번 문항 검수' })
  ).toBeVisible();
  await expect(page.getByText('문항 본문', { exact: true })).toBeVisible();
  await expect(
    page.getByText('연결 기능(ㄱ) / 요구 표현 기능(ㄴ)', { exact: true })
  ).toBeVisible();
  await expect(page.getByText('조건 제시 / 이유 설명')).toBeVisible();

  await page.goto('/assessment/question-bank/review/AQ-51001');
  await expect(page.getByText('검수 대상 문항을 불러오지 못했습니다.')).toBeVisible();
  await expect(page.getByRole('button', { name: '다시 시도' })).toBeVisible();
});

test('검수 메모 저장과 검수 완료 write 흐름이 화면 왕복으로 반영된다 (D-12 모크)', async ({
  page
}) => {
  await page.goto('/assessment/question-bank/review/topik-writing-51-9901');
  await skipIfAuthRequired(page);

  await expect(
    page.getByRole('heading', { name: 'TOPIK 51번 문항 검수' })
  ).toBeVisible();

  await page.getByLabel('검수 메모 입력').fill('빈칸 기능·정답 적합성 확인 완료');
  await page.getByRole('button', { name: '메모 저장' }).click();
  // 저장 완료 신호(영속 안내 문구로 전환)를 기다린 뒤 다음 단계로 진행한다.
  await expect(
    page.getByText('검수 메모는 content_team_memo로 영속 저장되며', { exact: false })
  ).toBeVisible();
  await expect(page.getByRole('button', { name: '메모 저장' })).toBeDisabled();

  await page.getByRole('button', { name: '검수 완료', exact: true }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('검수 완료 처리')).toBeVisible();
  await dialog
    .getByPlaceholder('검수 완료 사유를 입력해 주세요.')
    .fill('모크 모드 검수 write 흐름 검증');
  await dialog.getByRole('button', { name: '검수 완료' }).click();

  await expect(page.getByText('검수 완료 처리했습니다.')).toBeVisible();
  await expect(
    page
      .locator('.assessment-review-page__description-meta')
      .getByText('검수 완료', { exact: true })
  ).toBeVisible();
});

test('TOPIK 쓰기 문항 관리는 service_status 축과 P4 대기 안내를 노출한다', async ({
  page
}) => {
  await page.goto('/assessment/question-bank/manage');
  await skipIfAuthRequired(page);

  await expect(
    page.getByRole('heading', { name: 'TOPIK 쓰기 문항 관리' })
  ).toBeVisible();
  await expect(page.getByText('운영 상태 관리는 준비 중입니다.')).toBeVisible();
  await expect(
    page.getByText('P4(운영 쓰기 개방)에서 활성화됩니다.', { exact: false })
  ).toBeVisible();
  await expect(page.getByRole('columnheader', { name: /노출 상태/ })).toBeVisible();
  await expect(page.getByLabel('문항 검색어')).toBeVisible();

  const firstActionButton = page
    .locator('tbody tr.ant-table-row')
    .first()
    .getByRole('button', { name: '노출 가능' });
  await expect(firstActionButton).toBeDisabled();
});

test('AssessmentQuestion 감사 로그는 삭제된 문제은행 store audit으로 역이동하지 않는다', async ({
  page
}) => {
  await page.goto('/system/audit-logs?targetType=AssessmentQuestion&targetId=AQ-53002');
  await skipIfAuthRequired(page);

  await expect(page.getByRole('heading', { name: '감사 로그' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'AQ-53002' })).toHaveCount(0);
});
