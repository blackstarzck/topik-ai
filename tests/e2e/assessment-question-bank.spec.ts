import { expect, test, type Locator, type Page } from '@playwright/test';

async function getVisibleDrawer(page: Page): Promise<Locator> {
  const drawer = page.locator('.ant-drawer-content-wrapper:visible').last();
  await expect(drawer).toBeVisible();
  return drawer;
}

async function getVisibleModal(page: Page): Promise<Locator> {
  const modal = page.locator('.ant-modal:visible').last();
  await expect(modal).toBeVisible();
  return modal;
}

async function confirmVisibleReasonModal(page: Page, reason: string) {
  const modal = await getVisibleModal(page);
  await modal.getByRole('textbox').fill(reason);
  await modal.locator('.ant-modal-footer .ant-btn-primary').click();
}

test('TOPIK 쓰기 문제은행 요약 카드는 현재 탭 상태 필터로 즉시 연결된다', async ({
  page
}) => {
  await page.goto('/assessment/question-bank?questionNo=51');

  const reviewHoldCard = page.getByRole('button', { name: /보류/ }).first();
  await expect(reviewHoldCard).toHaveAttribute('aria-pressed', 'false');
  await reviewHoldCard.click();

  await expect(page).toHaveURL(/questionNo=51&reviewStatus=/);
  await expect(reviewHoldCard).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('현재 결과 1문항')).toBeVisible();
  await expect(page.locator('tbody tr').filter({ hasText: 'AQ-51002' })).toBeVisible();
  await expect(page.locator('tbody tr').filter({ hasText: 'AQ-51001' })).toHaveCount(0);

  await page.goto('/assessment/question-bank?tab=manage&questionNo=53');

  const manageHideCard = page.getByRole('button', { name: /숨김 후보/ }).first();
  await manageHideCard.click();

  await expect(page).toHaveURL(/tab=manage&questionNo=53&operationStatus=/);
  await expect(page.getByText('현재 결과 1문항')).toBeVisible();
  await expect(page.locator('tbody tr').filter({ hasText: 'AQ-53002' })).toBeVisible();
  await expect(page.locator('tbody tr').filter({ hasText: 'AQ-53001' })).toHaveCount(0);
});

test('검수 큐 검색바는 도메인 유형 난이도 키워드 조건으로 재구성되어 2depth 검수 페이지로 이어진다', async ({
  page
}) => {
  await page.goto('/assessment/question-bank?questionNo=53');

  await expect(page.getByLabel('도메인 필터')).toBeVisible();
  await expect(page.getByLabel('유형 필터')).toBeVisible();
  await expect(page.getByLabel('난이도 필터')).toBeVisible();
  await expect(page.getByLabel('문항 검색어')).toBeVisible();

  await page.getByLabel('도메인 필터').selectOption('학습');
  await page.getByLabel('유형 필터').selectOption('자료 설명');
  await page.getByLabel('난이도 필터').selectOption('중');
  await page.getByLabel('문항 검색어').fill('온라인');

  await expect(page).toHaveURL(/questionNo=53/);
  await expect(page.locator('tbody tr').filter({ hasText: 'AQ-53002' })).toBeVisible();
  await expect(page.locator('tbody tr').filter({ hasText: 'AQ-53001' })).toHaveCount(0);

  await page.locator('tbody tr').filter({ hasText: 'AQ-53002' }).first().click();

  await expect(page).toHaveURL(/\/assessment\/question-bank\/review\/AQ-53002/);
  await expect(
    page.getByRole('heading', { name: 'TOPIK 53번 문항 검수' })
  ).toBeVisible();

  await page.getByRole('button', { name: '목록으로 돌아가기' }).click();
  await expect(page).toHaveURL(/\/assessment\/question-bank\?/);
  await expect(page.getByLabel('도메인 필터')).toHaveValue('학습');
  await expect(page.getByLabel('유형 필터')).toHaveValue('자료 설명');
  await expect(page.getByLabel('난이도 필터')).toHaveValue('중');
  await expect(page.getByLabel('문항 검색어')).toHaveValue('온라인');
});

test('2depth 검수 페이지는 카드형 검수 UI와 검수 메모 저장 게이트를 제공한다', async ({
  page
}) => {
  await page.goto('/assessment/question-bank/review/AQ-54001?questionNo=54&tab=review');

  await expect(
    page.getByRole('heading', { name: 'TOPIK 54번 문항 검수' })
  ).toBeVisible();
  await expect(page.getByText('지시문', { exact: true })).toBeVisible();
  await expect(page.getByText('출처', { exact: true })).toBeVisible();
  await expect(page.getByText('핵심 의미', { exact: true })).toBeVisible();
  await expect(page.getByText('핵심 문제', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '모범답안 보기' })).toBeVisible();
  await expect(page.getByRole('button', { name: '채점 기준' })).toBeVisible();
  await expect(page.getByRole('button', { name: '수정 히스토리' })).toBeVisible();

  const reviewMemoField = page.getByLabel('검수 메모 입력');
  const completeButton = page.getByRole('button', { name: '검수 완료' });

  await reviewMemoField.fill(
    '논제 범위는 적절하지만 최근 배치와 주제 중복 여부를 한 번 더 확인해야 합니다.'
  );
  await expect(completeButton).toBeDisabled();
  await expect(page.getByText('저장되지 않은 변경사항이 있습니다.')).toBeVisible();

  await page.getByRole('button', { name: '검수 메모 저장' }).click();
  await expect(page.getByText('검수 메모를 저장했습니다.')).toBeVisible();
  await expect(completeButton).toBeEnabled();

  await completeButton.click();
  const modal = await getVisibleModal(page);
  await expect(modal).toContainText('검수 완료 처리');
  await modal.locator('.ant-modal-close').click();

  await page.getByRole('link', { name: '감사 로그 확인' }).click();
  await expect(page).toHaveURL(
    /\/system\/audit-logs\?targetType=AssessmentQuestion&targetId=AQ-54001/
  );
});

test('문항 관리 탭은 행 클릭 Drawer에서 빠른 상세와 운영 상태 변경을 지원한다', async ({
  page
}) => {
  await page.goto('/assessment/question-bank?tab=manage&questionNo=54');

  await page.locator('tbody tr').filter({ hasText: 'AQ-54001' }).first().click();

  const drawer = await getVisibleDrawer(page);
  await expect(drawer).toContainText('TOPIK 54번 문항 · AQ-54001');
  await expect(drawer).toContainText('기본 정보');
  await expect(drawer).toContainText('출처 / 상태');
  await expect(drawer).toContainText('문항 핵심 요약');
  await expect(drawer).toContainText('모범답안 · 메모 · 사용 현황');
  await expect(drawer).toContainText('핵심 의미');
  await expect(drawer).toContainText('핵심 문제');
  await expect(drawer).toContainText('논제');
  await expect(drawer).toContainText('조건 줄');

  await drawer.getByRole('button', { name: '노출 후보' }).click();
  await confirmVisibleReasonModal(page, 'e2e 노출 후보 지정');

  await expect(page.getByText('노출 후보로 지정되었습니다.')).toBeVisible();
  await expect(drawer).toContainText('노출 후보');

  await drawer.locator('.ant-drawer-close').click();
  await expect(drawer).toBeHidden();
  await expect(page).toHaveURL(/\/assessment\/question-bank\?tab=manage&questionNo=54$/);

  const managedRow = page.locator('tbody tr').filter({ hasText: 'AQ-54001' }).first();
  await expect(managedRow).toContainText('노출 후보');
});

test('감사 로그 대상 링크는 TOPIK 쓰기 문항 2depth 검수 페이지로 역이동한다', async ({
  page
}) => {
  await page.goto(
    '/system/audit-logs?targetType=AssessmentQuestion&targetId=AQ-53002'
  );

  const targetLink = page.getByRole('link', { name: 'AQ-53002' }).first();
  await expect(targetLink).toBeVisible();
  await targetLink.click();

  await expect(page).toHaveURL(/\/assessment\/question-bank\/review\/AQ-53002/);
  await expect(
    page.getByRole('heading', { name: 'TOPIK 53번 문항 검수' })
  ).toBeVisible();
});
