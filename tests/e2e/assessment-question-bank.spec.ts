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

test('통합 문항 화면은 모크 모드에서 탭·조회·관리 컬럼을 렌더한다', async ({
  page
}) => {
  await page.goto('/assessment/question-bank');
  await skipIfAuthRequired(page);

  await expect(
    page.getByRole('heading', { name: 'TOPIK 쓰기 문항', exact: true })
  ).toBeVisible();
  await expect(page.getByText(MOCK_BANNER)).toBeVisible();
  // 상단 툴바(검색) 제거 — 검색은 컬럼 헤더로 이동.
  await expect(page.getByLabel('문항 검색어')).toHaveCount(0);

  // route-backed 탭 2개(문항 / 가져온 문항)
  await expect(page.getByRole('tab', { name: '문항', exact: true })).toBeVisible();
  await expect(
    page.getByRole('tab', { name: '가져온 문항(인박스)', exact: true })
  ).toBeVisible();

  // 컬럼: 주제 단일·난이도·TOPIK 급수 분리, 운영 조치 컬럼은 더보기로 이동.
  await expect(page.getByRole('columnheader', { name: '문항 번호' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: '문항 ID' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: '버전' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: '주제', exact: true })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: '난이도' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'TOPIK 급수' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: /노출 상태/ })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: '운영 조치' })).toHaveCount(0);

  // 검수 표면 부재: 검수 컬럼·검수 라벨이 렌더되지 않는다.
  await expect(page.getByRole('columnheader', { name: /검수 상태/ })).toHaveCount(0);
  await expect(page.getByText('검수 완료', { exact: true })).toHaveCount(0);

  // antd measure-row 제외, 실데이터 행만 센다.
  await expect(page.locator('tbody tr.ant-table-row')).toHaveCount(4);
  await expect(page.getByText('topik-writing-51-9901')).toBeVisible();
  await expect(
    page.locator('tbody tr.ant-table-row').filter({ hasText: 'topik-writing-51-9901' }).getByText('2회')
  ).toBeVisible();
  await expect(
    page
      .locator('tbody tr.ant-table-row')
      .filter({ hasText: 'topik-writing-53-9901' })
      .getByText('버전 연결 없음')
  ).toBeVisible();
});

test('버전 컬럼에서 수정 이력 행만 확장하고 과거 상세에 키보드로 진입한다', async ({
  page
}) => {
  await page.goto('/assessment/question-bank?questionNo=51&keyword=%EA%B5%90%EC%9C%A1');
  await skipIfAuthRequired(page);

  const versionedRow = page
    .locator('tbody tr.ant-table-row')
    .filter({ hasText: 'topik-writing-51-9901' });
  await expect(versionedRow.getByText('2회', { exact: true })).toBeVisible();
  await versionedRow.getByRole('button', { name: '문항 변경 이력 펼치기' }).click();

  const historyTable = page.getByTestId('question-version-history-table');
  await expect(historyTable).toBeVisible();
  await expect(historyTable.getByText('#5102', { exact: true })).toBeVisible();
  await expect(historyTable.getByText('#5101', { exact: true })).toBeVisible();
  await expect(historyTable.getByText('#5103', { exact: true })).toHaveCount(0);
  await expect(historyTable.getByRole('columnheader', { name: '원본 생성 시각' })).toBeVisible();
  await expect(historyTable.getByRole('columnheader', { name: '원본 수정 시각' })).toBeVisible();
  await expect(historyTable.getByRole('columnheader', { name: 'content hash' })).toBeVisible();

  // 오해하기 쉬운 두 컬럼은 헤더 안내 아이콘으로 의미를 노출한다.
  await historyTable.getByRole('button', { name: '원본 수정 시각 안내' }).hover();
  await expect(
    page.getByText('실제 변경 여부는 content hash 비교로 확인하세요.')
  ).toBeVisible();
  await historyTable.getByRole('button', { name: '수신 횟수 안내' }).hover();
  await expect(
    page.getByText('내용이 달라지면 이 값이 오르지 않고 새 버전 행이 따로 쌓입니다.')
  ).toBeVisible();

  const historyRow = historyTable
    .locator('tbody tr.ant-table-row')
    .filter({ hasText: '#5102' });
  await historyRow.focus();
  await historyRow.press('Enter');

  await expect(page).toHaveURL(/questionNo=51/);
  await expect(page).toHaveURL(/keyword=%EA%B5%90%EC%9C%A1/);
  await expect(page).toHaveURL(/detailTab=history/);
  await expect(page).toHaveURL(/versionId=5102/);
  await expect(
    page.getByText('과거 버전 #5102 · 현재 노출 버전 아님')
  ).toBeVisible();
});

test('무이력·버전 연결 없음 행은 확장 아이콘을 제공하지 않는다', async ({ page }) => {
  await page.goto('/assessment/question-bank');
  await skipIfAuthRequired(page);

  const noHistoryRow = page
    .locator('tbody tr.ant-table-row')
    .filter({ hasText: 'topik-writing-52-9901' });
  await expect(noHistoryRow.getByText('0회', { exact: true })).toBeVisible();
  await expect(
    noHistoryRow.getByRole('button', { name: '문항 변경 이력 펼치기' })
  ).toHaveCount(0);

  const unlinkedRow = page
    .locator('tbody tr.ant-table-row')
    .filter({ hasText: 'topik-writing-53-9901' });
  await expect(unlinkedRow.getByText('버전 연결 없음')).toBeVisible();
  await expect(
    unlinkedRow.getByRole('button', { name: '문항 변경 이력 펼치기' })
  ).toHaveCount(0);
});

test('탭으로 가져온 문항(인박스) 화면으로 전환한다', async ({ page }) => {
  await page.goto('/assessment/question-bank');
  await skipIfAuthRequired(page);

  await page.getByRole('tab', { name: '가져온 문항(인박스)', exact: true }).click();

  await expect(page).toHaveURL(/\/assessment\/question-bank\/imported$/);
  await expect(
    page.getByRole('heading', { name: '가져온 문항(인박스)', exact: true })
  ).toBeVisible();
  // 주요 액션은 본문 카드 툴바 안에 large 크기로 배치되고, 모크 모드에서는 비활성이다.
  const importButton = page
    .locator('.admin-list-card')
    .getByRole('button', { name: '외부에서 가져오기' });
  await expect(importButton).toBeDisabled();
  await expect(importButton).toHaveClass(/ant-btn-lg/);
  await expect(page.getByRole('columnheader', { name: '최근 수신본' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: '이력 판정' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: '원본 생성 시각' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: '원본 수정 시각' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'content hash' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: '판정 사유' })).toBeVisible();
  await expect(page.getByText('메타데이터만 변경', { exact: true })).toBeVisible();
  await expect(page.getByText('과거 시각 수신', { exact: true })).toBeVisible();
  await expect(
    page.getByText('외부 공급 API에서 가져온 문항 목록입니다.')
  ).toHaveCount(0);
  await expect(
    page.getByText('승격 조건을 충족한 문항은 정식 문항으로 자동 승격합니다.')
  ).toHaveCount(0);
});

test('문항 상세는 번호별 실메타를 조회 전용으로 표시하고 잘못된 ID는 오류로 처리한다', async ({
  page
}) => {
  await page.goto('/assessment/question-bank/topik-writing-52-9901');
  await skipIfAuthRequired(page);

  await expect(
    page.getByRole('heading', { name: 'TOPIK 52번 문항 상세' })
  ).toBeVisible();
  await expect(page.getByRole('tab', { name: '버전 #5201' })).toBeVisible();
  await expect(page.getByRole('tab', { name: '변경 이력보기' })).toBeVisible();
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

test('상세 탭은 과거 버전 목록·상세·현재 버전 복귀와 목록 필터 복원을 지원한다', async ({
  page
}) => {
  await page.goto(
    '/assessment/question-bank/topik-writing-51-9901?questionNo=51&topicMain=%EA%B5%90%EC%9C%A1'
  );
  await skipIfAuthRequired(page);

  await expect(page.getByRole('tab', { name: '버전 #5103' })).toBeVisible();
  await page.getByRole('tab', { name: '변경 이력보기' }).click();
  await expect(page).toHaveURL(/detailTab=history/);
  await expect(page.getByTestId('question-version-history-table')).toBeVisible();

  await page
    .getByTestId('question-version-history-table')
    .locator('tbody tr.ant-table-row')
    .filter({ hasText: '#5102' })
    .click();
  await expect(page).toHaveURL(/versionId=5102/);
  await expect(
    page.getByText('과거 버전 #5102 · 현재 노출 버전 아님')
  ).toBeVisible();
  await expect(
    page.getByText('[이전 버전] 도서관 운영 시간 변경을 알리는 학교 공지문')
  ).toBeVisible();
  await expect(page.getByText(/과거 payload의 운영 상태는 표시하지 않습니다/)).toBeVisible();

  await page.getByRole('button', { name: '현재 버전 보기' }).click();
  await expect(page).not.toHaveURL(/detailTab=/);
  await expect(page).not.toHaveURL(/versionId=/);
  await expect(page).toHaveURL(/questionNo=51/);
  await expect(page).toHaveURL(/topicMain=%EA%B5%90%EC%9C%A1/);

  await page.getByRole('button', { name: '목록으로 돌아가기' }).click();
  await expect(page).toHaveURL(/\/assessment\/question-bank\?/);
  await expect(page).toHaveURL(/questionNo=51/);
  await expect(page).toHaveURL(/topicMain=%EA%B5%90%EC%9C%A1/);
});

test('다른 문항 또는 잘못된 버전 ID 오류를 이력 탭에 격리한다', async ({ page }) => {
  await page.goto(
    '/assessment/question-bank/topik-writing-51-9901?detailTab=history&versionId=5201'
  );
  await skipIfAuthRequired(page);

  await expect(page.getByText('과거 버전을 불러오지 못했습니다.')).toBeVisible();
  await expect(page.getByText('선택한 문항 버전을 찾을 수 없습니다.')).toBeVisible();
  await expect(page.getByRole('button', { name: '다시 시도' })).toBeVisible();

  await page.getByRole('tab', { name: '버전 #5103' }).click();
  await expect(page.getByText('문항 본문', { exact: true })).toBeVisible();
  await expect(
    page.getByText(
      '도서관에서 안내 말씀드립니다. 다음 주부터 시험 기간이라서 이용 시간을 ( ㄱ ). 책을 빌리고 싶은 학생은 ( ㄴ ).',
      { exact: true }
    )
  ).toBeVisible();
});

test('버전 이력 UI는 데스크톱과 모바일에서 본문 카드 안에 유지된다', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/assessment/question-bank/topik-writing-51-9901?detailTab=history');
  await skipIfAuthRequired(page);
  // 첫 앵커는 dev 서버 모듈 변환 + 상세 fetch + 버전 이력 fetch 체인 전체를 기다린다.
  // 병렬 배치 + 외부 부하가 겹치면 기본 10s 를 넘길 수 있어(2026-08-18 1회 관찰,
  // 단독/부하 재현 8회는 전부 통과) 이 단정에만 여유를 준다 — 요소가 아예 안 나타나는
  // 회귀는 여전히 실패한다(검출력 무손실).
  await expect(page.getByRole('tab', { name: '변경 이력보기' })).toBeVisible({
    timeout: 20_000
  });
  await expect(page.getByTestId('question-version-history-table')).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('tab', { name: '변경 이력보기' })).toBeVisible();
  const cardBox = await page.locator('.admin-list-card').boundingBox();
  expect(cardBox).not.toBeNull();
  expect(cardBox?.x ?? 0).toBeGreaterThanOrEqual(0);
  expect((cardBox?.x ?? 0) + (cardBox?.width ?? 0)).toBeLessThanOrEqual(390);
});

test('통합 문항 화면은 관리 포인트(노출 조치·태그 편집)를 개방 상태로 렌더한다', async ({
  page
}) => {
  await page.goto('/assessment/question-bank');
  await skipIfAuthRequired(page);

  await expect(
    page.getByRole('heading', { name: 'TOPIK 쓰기 문항', exact: true })
  ).toBeVisible();
  // P4 개방: 준비 중 안내는 제거됐다.
  await expect(
    page.getByText('관리 포인트(노출 상태·태그) 조치는 준비 중입니다.')
  ).toHaveCount(0);
  await expect(page.getByRole('columnheader', { name: /노출 상태/ })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: /검수 상태/ })).toHaveCount(0);
  // 상단 툴바(검색) 제거.
  await expect(page.getByLabel('문항 검색어')).toHaveCount(0);

  const firstRow = page.locator('tbody tr.ant-table-row').first();
  // 태그 편집은 직접 버튼, 운영 조치(노출 상태 전환)는 더보기 메뉴로 이동.
  await expect(firstRow.getByRole('button', { name: '태그 편집' })).toBeEnabled();
  await firstRow.getByRole('button', { name: '더보기' }).click();
  await expect(page.getByRole('menuitem', { name: '상세 보기' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: '노출 가능' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: '노출 제외' })).toBeVisible();
  // 픽스처 internal_test — 동일 상태 조치는 비활성.
  await expect(
    page.getByRole('menuitem', { name: '내부 테스트' })
  ).toHaveAttribute('aria-disabled', 'true');
});

test('노출 상태 전환은 사유 필수 확인 모달을 거쳐 화면 왕복(쓰기→재조회 반영)된다', async ({
  page
}) => {
  await page.goto('/assessment/question-bank');
  await skipIfAuthRequired(page);

  const targetRow = page
    .locator('tbody tr.ant-table-row')
    .filter({ hasText: 'topik-writing-51-9901' });
  // 첫 태그 = 노출 상태 컬럼.
  await expect(targetRow.locator('.ant-tag').first()).toHaveText('내부 테스트');

  // 운영 조치는 더보기 메뉴에서 실행.
  await targetRow.getByRole('button', { name: '더보기' }).click();
  await page.getByRole('menuitem', { name: '노출 제외' }).click();

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
  // 재조회 반영: 모크 store가 변조돼 행 상태 태그가 바뀐다(첫 태그 = 노출 상태).
  await expect(targetRow.locator('.ant-tag').first()).toHaveText('노출 제외');
  // 이미 노출 제외 상태 → 더보기 메뉴의 노출 제외 조치는 비활성.
  await targetRow.getByRole('button', { name: '더보기' }).click();
  await expect(
    page.getByRole('menuitem', { name: '노출 제외' })
  ).toHaveAttribute('aria-disabled', 'true');
});

test('운영 조치 일괄 처리: 행 선택 → 일괄 바 → 노출 제외 왕복(모크)', async ({
  page
}) => {
  await page.goto('/assessment/question-bank');
  await skipIfAuthRequired(page);

  // 선택 전에는 일괄 바가 없다.
  await expect(page.getByTestId('bulk-action-bar')).toHaveCount(0);

  // 헤더 전체 선택 체크박스로 픽스처 4건을 모두 선택.
  await page.locator('thead .ant-checkbox-wrapper').first().click();

  const bulkBar = page.getByTestId('bulk-action-bar');
  await expect(bulkBar).toBeVisible();
  await expect(bulkBar.getByText('선택 4건')).toBeVisible();
  // 노출 가능/제외/내부 테스트 일괄 버튼이 모두 활성.
  await expect(bulkBar.getByRole('button', { name: '노출 가능' })).toBeEnabled();

  await bulkBar.getByRole('button', { name: '노출 제외', exact: true }).click();

  const modal = page
    .locator('.ant-modal-content')
    .filter({ hasText: '노출 상태 일괄 전환' });
  await expect(modal).toBeVisible();
  await expect(modal.getByText('선택 4건')).toBeVisible();
  // 사유 미입력 시 확인 비활성(사유 필수).
  const confirm = modal.getByRole('button', { name: '노출 제외로 변경' });
  await expect(confirm).toBeDisabled();
  await modal
    .getByPlaceholder('노출 제외 일괄 전환 사유를 입력해 주세요.')
    .fill('e2e: 일괄 노출 제외 왕복 검증');
  await confirm.click();

  // 결과 알림(변경 4건) + 모크 store 왕복으로 행 상태 반영.
  await expect(page.getByText('노출 제외로 4건을 변경했습니다.')).toBeVisible();
  await expect(
    page.locator('tbody tr.ant-table-row .ant-tag', { hasText: '노출 제외' })
  ).toHaveCount(4);
  // 변경 후 선택이 초기화돼 일괄 바가 사라진다.
  await expect(page.getByTestId('bulk-action-bar')).toHaveCount(0);
});

test('운영 조치 일괄 처리: 노출 가능은 개수 확인 팝업으로 전환(모크)', async ({
  page
}) => {
  await page.goto('/assessment/question-bank');
  await skipIfAuthRequired(page);

  await page.locator('thead .ant-checkbox-wrapper').first().click();

  const bulkBar = page.getByTestId('bulk-action-bar');
  await bulkBar.getByRole('button', { name: '노출 가능', exact: true }).click();

  // 노출 가능은 사유 입력이 아니라 개수 확인 팝업이다.
  const modal = page
    .locator('.ant-modal-content')
    .filter({ hasText: '문항 노출 확인' });
  await expect(modal).toBeVisible();
  await expect(modal.getByText(/총 4개/).first()).toBeVisible();
  // 사유 입력란이 없다.
  await expect(modal.getByPlaceholder(/사유/)).toHaveCount(0);
  const confirm = modal.getByRole('button', { name: '노출하기' });
  await expect(confirm).toBeEnabled();
  await confirm.click();

  await expect(page.getByText('노출 가능로 4건을 변경했습니다.')).toBeVisible();
  await expect(
    page.locator('tbody tr.ant-table-row .ant-tag', { hasText: '노출 가능' })
  ).toHaveCount(4);
});

test('통합 테이블에서 상세 보기 버튼으로 문항 상세로 이동한다', async ({ page }) => {
  await page.goto('/assessment/question-bank');
  await skipIfAuthRequired(page);

  const firstRow = page.locator('tbody tr.ant-table-row').first();
  // 상세 보기는 더보기 메뉴 안에 있다.
  await firstRow.getByRole('button', { name: '더보기' }).click();
  await page.getByRole('menuitem', { name: '상세 보기' }).click();

  await expect(page).toHaveURL(/\/assessment\/question-bank\/topik-writing-\d{2}-/);
  await expect(
    page.getByRole('heading', { name: /TOPIK \d{2}번 문항 상세/ })
  ).toBeVisible();
});

test('태그 부여/제거는 사유 없이 동작하고 POL-018 ② 가드가 available 전환 모달에 표시된다', async ({
  page
}) => {
  await page.goto('/assessment/question-bank');
  await skipIfAuthRequired(page);

  const targetRow = page
    .locator('tbody tr.ant-table-row')
    .filter({ hasText: 'topik-writing-52-9901' });
  await targetRow.getByRole('button', { name: '태그 편집' }).click();

  const tagModal = page.locator('.ant-modal-content').filter({ hasText: '태그 편집' });
  await expect(tagModal).toBeVisible();
  await expect(tagModal.getByText('활성 태그가 없습니다.')).toBeVisible();

  // 부여: 변경 선택 전까지 적용(확인) 비활성, 선택 후 사유 입력 없이 실행 가능.
  const applyButton = tagModal.getByRole('button', { name: '확인' });
  await expect(applyButton).toBeDisabled();

  // 검색으로 태그를 찾아 체크 → 추가 예정 칩.
  await tagModal.getByLabel('태그 검색').fill('표현 주의');
  await tagModal.getByTestId('tag-row-ops_expression_caution').click();
  await expect(tagModal.getByText('표현 주의 · 추가 예정')).toBeVisible();
  await expect(tagModal.getByPlaceholder(/태그 부여 사유/)).toHaveCount(0);
  await expect(applyButton).toBeEnabled();
  await applyButton.click();

  // 적용 성공 시 모달이 닫히고 요약 알림 + 행 태그 수가 반영된다.
  await expect(page.getByText(/태그를 변경했습니다 \(부여 1건\)/)).toBeVisible();
  await expect(tagModal).toBeHidden();
  await expect(targetRow.getByText('1개')).toBeVisible();

  // POL-018 ②: 운영주의 태그 활성 문항의 available 전환 모달에 가드 문구.
  await targetRow.getByRole('button', { name: '더보기' }).click();
  await page.getByRole('menuitem', { name: '노출 가능' }).click();
  const availableModal = page
    .locator('.ant-modal-content')
    .filter({ hasText: '노출 가능 전환' });
  await expect(availableModal).toBeVisible();
  await expect(
    availableModal.getByText(/운영주의 태그\(표현 주의\)가 활성입니다/)
  ).toBeVisible();
  await availableModal.getByRole('button', { name: '취소' }).click();

  // 제거: 활성 태그를 체크 해제 → 제거 예정, 사유 입력 없이 실행 가능.
  await targetRow.getByRole('button', { name: '태그 편집' }).click();
  await expect(tagModal).toBeVisible();
  await expect(tagModal.getByText('표현 주의 · 활성')).toBeVisible();
  await tagModal.getByLabel('태그 검색').fill('표현 주의');
  await tagModal.getByTestId('tag-row-ops_expression_caution').click();
  await expect(tagModal.getByText('표현 주의 · 제거 예정')).toBeVisible();
  const removeApply = tagModal.getByRole('button', { name: '확인' });
  await expect(tagModal.getByPlaceholder(/태그 제거 사유/)).toHaveCount(0);
  await expect(removeApply).toBeEnabled();
  await removeApply.click();

  await expect(page.getByText(/태그를 변경했습니다 \(제거 1건\)/)).toBeVisible();
  await expect(tagModal).toBeHidden();
  await expect(targetRow.getByText('1개')).toHaveCount(0);
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

test('주제/태그 마스터는 /system/metadata 마스터 카탈로그에 조회된다', async ({
  page
}) => {
  await page.goto('/system/metadata');
  await skipIfAuthRequired(page);

  const section = page.getByTestId('assessment-master-catalog-section');
  await expect(section).toBeVisible();
  await expect(section.getByText('TOPIK 쓰기 마스터 데이터')).toBeVisible();
  await expect(section.getByText(MOCK_BANNER)).toBeVisible();

  // 주제 마스터 탭(기본): 전수 표시 — 비활성 행 포함(편집용 활성 필터와 다른 축).
  // 주제 마스터는 전면 조회 전용(스위치 없음).
  await expect(section.getByText('총 5건 · 활성 4건')).toBeVisible();
  await expect(section.getByText('학교생활')).toBeVisible();
  await expect(section.getByText('[모크] 비활성 표시 검증용')).toBeVisible();
  await expect(section.getByText('비활성', { exact: true })).toBeVisible();
  await expect(
    section.getByTestId('topic-master-catalog').getByRole('switch')
  ).toHaveCount(0);

  // 태그 마스터 탭: 값 사전 전수(코드·그룹·사용 규칙 축) + 행별 활성/비활성 스위치(P5-3).
  await section.getByRole('tab', { name: '태그 마스터' }).click();
  await expect(section.getByText('총 6건 · 활성 6건')).toBeVisible();
  await expect(section.getByText('rec_use', { exact: true })).toBeVisible();
  await expect(
    section.getByText('ops_operation_excluded', { exact: true })
  ).toBeVisible();
  await expect(
    section.getByTestId('tag-master-catalog').getByRole('switch')
  ).toHaveCount(6);

  // 값 편집 표면은 없다(조치는 상태 토글 단일 — 추가/수정/삭제 버튼 부재).
  await expect(section.getByRole('button', { name: /추가|수정|삭제/ })).toHaveCount(0);
});

test('태그 마스터 활성/비활성 토글은 사유 필수 확인 모달을 거쳐 화면 왕복된다', async ({
  page
}) => {
  await page.goto('/system/metadata');
  await skipIfAuthRequired(page);

  const section = page.getByTestId('assessment-master-catalog-section');
  await section.getByRole('tab', { name: '태그 마스터' }).click();
  const tagPane = section.getByTestId('tag-master-catalog');
  await expect(tagPane.getByText('총 6건 · 활성 6건')).toBeVisible();

  const targetRow = tagPane
    .locator('tbody tr.ant-table-row')
    .filter({ hasText: 'rec_use' });
  await expect(targetRow.getByRole('switch')).toBeChecked();
  await targetRow.getByRole('switch').click();

  // 사유 미입력 시 확인 비활성(사유 필수) — Target 계약 표기 포함.
  const modal = page
    .locator('.ant-modal-content')
    .filter({ hasText: '태그 마스터 비활성화' });
  await expect(modal).toBeVisible();
  await expect(modal.getByText('대상 ID: rec_use')).toBeVisible();
  const confirmButton = modal.getByRole('button', { name: '비활성화 실행' });
  await expect(confirmButton).toBeDisabled();
  await modal
    .getByPlaceholder('조치 사유를 입력해 주세요.')
    .fill('e2e: 태그 마스터 토글 왕복 검증');
  await confirmButton.click();

  // 재조회 반영: 성공 알림(감사 링크) + 집계·행 스위치 상태 변경.
  await expect(page.getByText('태그 마스터 비활성화 완료')).toBeVisible();
  await expect(
    page.getByRole('link', { name: '감사 로그 확인' }).first()
  ).toBeVisible();
  await expect(tagPane.getByText('총 6건 · 활성 5건')).toBeVisible();
  await expect(targetRow.getByRole('switch')).not.toBeChecked();

  // 원복(활성화) — 같은 사유 필수 흐름.
  await targetRow.getByRole('switch').click();
  const revertModal = page
    .locator('.ant-modal-content')
    .filter({ hasText: '태그 마스터 활성화' });
  await expect(revertModal).toBeVisible();
  await revertModal
    .getByPlaceholder('조치 사유를 입력해 주세요.')
    .fill('e2e: 태그 마스터 토글 원복');
  await revertModal.getByRole('button', { name: '활성화 실행' }).click();
  await expect(page.getByText('태그 마스터 활성화 완료')).toBeVisible();
  await expect(tagPane.getByText('총 6건 · 활성 6건')).toBeVisible();
  await expect(targetRow.getByRole('switch')).toBeChecked();
});

test('AssessmentQuestion 감사 로그는 삭제된 문제은행 store audit으로 역이동하지 않는다', async ({
  page
}) => {
  await page.goto('/system/audit-logs?targetType=AssessmentQuestion&targetId=AQ-53002');
  await skipIfAuthRequired(page);

  await expect(page.getByRole('heading', { name: '감사 로그' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'AQ-53002' })).toHaveCount(0);
});
