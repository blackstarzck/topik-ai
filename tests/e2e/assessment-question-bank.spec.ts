import { expect, test, type Page } from '@playwright/test';

/**
 * P3(조회)·P4(관리 포인트 write)·P5(마스터 조회 surface) spec (인바운드 모델 —
 * 결정 기록 §0, 실행계획안 §7~§9): Supabase가 구성되지 않은 실행은 D-12 모크
 * 모드로 동작한다 — 결정적 픽스처 4문항(번호별 1건) + 인메모리 태그 store로
 * 문항 목록·상세(조회 전용)·관리 페이지의 write 흐름(노출 상태 전환, 태그
 * 부여/제거, POL-018 ② 가드)과 /system/metadata 마스터 카탈로그(읽기 전용)를
 * 화면 수준에서 검증한다(실DB 왕복은 P4 RT-4 / P5 화면 확인 — 별도 프로브).
 * 검수 표면은 제거됐다(검수 시나리오 없음).
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

test('TOPIK 쓰기 문항 관리는 P4 관리 포인트(노출 조치·태그 편집)를 개방 상태로 렌더한다', async ({
  page
}) => {
  await page.goto('/assessment/question-bank/manage');
  await skipIfAuthRequired(page);

  await expect(
    page.getByRole('heading', { name: 'TOPIK 쓰기 문항 관리' })
  ).toBeVisible();
  // P4 개방: 준비 중 안내는 제거됐다.
  await expect(
    page.getByText('관리 포인트(노출 상태·태그) 조치는 준비 중입니다.')
  ).toHaveCount(0);
  await expect(page.getByRole('columnheader', { name: /노출 상태/ })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: /검수 상태/ })).toHaveCount(0);
  await expect(page.getByLabel('문항 검색어')).toBeVisible();

  const firstRow = page.locator('tbody tr.ant-table-row').first();
  // 픽스처는 internal_test — 동일 상태 버튼만 비활성, 전환 버튼은 활성.
  await expect(firstRow.getByRole('button', { name: '노출 가능' })).toBeEnabled();
  await expect(firstRow.getByRole('button', { name: '노출 제외' })).toBeEnabled();
  await expect(firstRow.getByRole('button', { name: '내부 테스트' })).toBeDisabled();
  await expect(firstRow.getByRole('button', { name: '태그 편집' })).toBeEnabled();
});

test('노출 상태 전환은 사유 필수 확인 모달을 거쳐 화면 왕복(쓰기→재조회 반영)된다', async ({
  page
}) => {
  await page.goto('/assessment/question-bank/manage');
  await skipIfAuthRequired(page);

  const targetRow = page
    .locator('tbody tr.ant-table-row')
    .filter({ hasText: 'topik-writing-51-9901' });
  await expect(targetRow.locator('.ant-tag')).toHaveText('내부 테스트');

  await targetRow.getByRole('button', { name: '노출 제외' }).click();

  const modal = page.locator('.ant-modal-content').filter({ hasText: '노출 제외 전환' });
  await expect(modal).toBeVisible();
  // 사유 미입력 시 확인 비활성(사유 필수).
  const confirmButton = modal.getByRole('button', { name: '노출 제외' });
  await expect(confirmButton).toBeDisabled();
  await modal
    .getByPlaceholder('노출 제외 사유를 입력해 주세요.')
    .fill('e2e: 노출 제외 전환 왕복 검증');
  await confirmButton.click();

  await expect(page.getByText('노출 제외로 변경했습니다.')).toBeVisible();
  await expect(
    page.getByRole('link', { name: '감사 로그 확인' }).first()
  ).toBeVisible();
  // 재조회 반영: 모크 store가 변조돼 행 상태 태그가 바뀐다.
  await expect(targetRow.locator('.ant-tag')).toHaveText('노출 제외');
  await expect(targetRow.getByRole('button', { name: '노출 제외' })).toBeDisabled();
});

test('태그 부여/제거는 사유 필수로 동작하고 POL-018 ② 가드가 available 전환 모달에 표시된다', async ({
  page
}) => {
  await page.goto('/assessment/question-bank/manage');
  await skipIfAuthRequired(page);

  const targetRow = page
    .locator('tbody tr.ant-table-row')
    .filter({ hasText: 'topik-writing-52-9901' });
  await targetRow.getByRole('button', { name: '태그 편집' }).click();

  const tagModal = page.locator('.ant-modal-content').filter({ hasText: '태그 편집' });
  await expect(tagModal).toBeVisible();
  await expect(tagModal.getByText('활성 태그가 없습니다.')).toBeVisible();

  // 부여: 태그 + 사유 입력 전까지 비활성.
  const assignButton = tagModal.getByRole('button', { name: '태그 부여' });
  await expect(assignButton).toBeDisabled();
  await tagModal.locator('.ant-select').click();
  await page.locator('.ant-select-dropdown').getByText('표현 주의 (ops_expression_caution)').click();
  await expect(assignButton).toBeDisabled();
  await tagModal
    .getByPlaceholder(/태그 부여 사유를 입력해 주세요/)
    .fill('e2e: 운영주의 태그 부여(POL-018 ② 가드 검증)');
  await assignButton.click();

  await expect(page.getByText("'표현 주의' 태그를 부여했습니다.")).toBeVisible();
  await expect(tagModal.getByText('활성 태그가 없습니다.')).toHaveCount(0);
  await tagModal.getByRole('button', { name: 'Close' }).click();

  // 행 태그 수 반영.
  await expect(targetRow.getByText('1개')).toBeVisible();

  // POL-018 ②: 운영주의 태그 활성 문항의 available 전환 모달에 가드 문구.
  await targetRow.getByRole('button', { name: '노출 가능' }).click();
  const availableModal = page
    .locator('.ant-modal-content')
    .filter({ hasText: '노출 가능 전환' });
  await expect(availableModal).toBeVisible();
  await expect(
    availableModal.getByText(/운영주의 태그\(표현 주의\)가 활성입니다/)
  ).toBeVisible();
  await availableModal.getByRole('button', { name: '취소' }).click();

  // 제거: ConfirmAction 사유 필수.
  await targetRow.getByRole('button', { name: '태그 편집' }).click();
  await tagModal.getByRole('button', { name: '태그 제거: 표현 주의' }).click();
  const removeModal = page
    .locator('.ant-modal-content')
    .filter({ hasText: '태그 제거' })
    .filter({ hasText: '사유/근거' });
  await expect(removeModal).toBeVisible();
  const removeConfirm = removeModal.getByRole('button', { name: '태그 제거' });
  await expect(removeConfirm).toBeDisabled();
  await removeModal
    .getByPlaceholder('태그 제거 사유를 입력해 주세요.')
    .fill('e2e: 태그 제거 왕복 검증');
  await removeConfirm.click();

  await expect(page.getByText("'표현 주의' 태그를 제거했습니다.")).toBeVisible();
  await expect(tagModal.getByText('활성 태그가 없습니다.')).toBeVisible();
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

test('주제/태그 마스터는 /system/metadata에 읽기 전용으로 조회된다', async ({
  page
}) => {
  await page.goto('/system/metadata');
  await skipIfAuthRequired(page);

  const section = page.getByTestId('assessment-master-catalog-section');
  await expect(section).toBeVisible();
  await expect(
    section.getByText('TOPIK 쓰기 마스터 데이터 (읽기 전용)')
  ).toBeVisible();
  await expect(section.getByText(MOCK_BANNER)).toBeVisible();

  // 주제 마스터 탭(기본): 전수 표시 — 비활성 행 포함(편집용 활성 필터와 다른 축).
  await expect(section.getByText('총 5건 · 활성 4건')).toBeVisible();
  await expect(section.getByText('학교생활')).toBeVisible();
  await expect(section.getByText('[모크] 비활성 표시 검증용')).toBeVisible();
  await expect(section.getByText('비활성', { exact: true })).toBeVisible();

  // 태그 마스터 탭: 값 사전 전수(코드·그룹·사용 규칙 축).
  await section.getByRole('tab', { name: '태그 마스터' }).click();
  await expect(section.getByText('총 6건 · 활성 6건')).toBeVisible();
  await expect(section.getByText('rec_use', { exact: true })).toBeVisible();
  await expect(
    section.getByText('ops_operation_excluded', { exact: true })
  ).toBeVisible();

  // 읽기 전용: 마스터 섹션 안에는 편집 액션(추가/수정/삭제/상태 스위치)이 없다.
  await expect(section.getByRole('switch')).toHaveCount(0);
  await expect(section.getByRole('button', { name: /추가|수정|삭제/ })).toHaveCount(0);
});

test('AssessmentQuestion 감사 로그는 삭제된 문제은행 store audit으로 역이동하지 않는다', async ({
  page
}) => {
  await page.goto('/system/audit-logs?targetType=AssessmentQuestion&targetId=AQ-53002');
  await skipIfAuthRequired(page);

  await expect(page.getByRole('heading', { name: '감사 로그' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'AQ-53002' })).toHaveCount(0);
});
