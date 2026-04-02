import { expect, test, type Locator, type Page } from '@playwright/test';

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

test('TOPIK 쓰기 문제은행은 초기 로딩에서 테이블 스켈레톤만 보여 준다', async ({
  page
}) => {
  await page.addInitScript(() => {
    const originalSetTimeout = window.setTimeout;
    window.setTimeout = ((handler, timeout, ...args) =>
      originalSetTimeout(handler, timeout === 220 ? 1200 : timeout, ...args)) as
      typeof window.setTimeout;
  });

  await page.goto('/assessment/question-bank');

  await expect(
    page.locator('.admin-data-table--loading .ant-spin-spinning')
  ).toBeVisible();
  await expect(
    page.locator('.admin-data-table--loading .ant-empty-description')
  ).toContainText('데이터 없음');
  await expect(
    page.getByText('문항 목록을 불러오는 중입니다.')
  ).toHaveCount(0);
});

test('문제은행은 review_passed 기준 요약 카드와 필터를 URL에 반영한다', async ({
  page
}) => {
  await page.goto('/assessment/question-bank');

  await expect(page.getByText('문항 관리')).toHaveCount(0);
  await expect(page.getByText('검수 큐')).toHaveCount(0);
  await expect(page.getByText('자동 점검')).toHaveCount(0);

  const passedCard = page.getByRole('button', { name: /검수 통과/ }).first();
  await passedCard.click();

  await expect(page).toHaveURL(/reviewPassed=true/);
  await expect(
    page.getByText('조건에 맞는 문항이 없습니다.')
  ).toBeVisible();

  const notPassedCard = page.getByRole('button', { name: /검수 미통과/ }).first();
  await notPassedCard.click();

  await expect(page).toHaveURL(/reviewPassed=false/);
  await expect(page.getByText('현재 결과 97문항')).toBeVisible();
  await expect(page.locator('.ant-table-tbody > tr.ant-table-row')).toHaveCount(10);
});

test('문제은행은 JSON 필드 기반 필터와 prompt_text 미리보기로 상세 페이지에 진입한다', async ({
  page
}) => {
  await page.goto(
    '/assessment/question-bank?domain=%EC%82%AC%ED%9A%8C&questionType=background_problem_response&difficulty=5&keyword=%EC%A0%95%EC%8B%A0%20%EA%B1%B4%EA%B0%95'
  );

  await expect(page).toHaveURL(/domain=%EC%82%AC%ED%9A%8C/);
  await expect(page).toHaveURL(/questionType=background_problem_response/);
  await expect(page).toHaveURL(/difficulty=5/);
  await expect(page.locator('.ant-table-tbody > tr.ant-table-row')).toHaveCount(1);
  await expect(page.locator('.ant-table-tbody')).not.toContainText('AQ-');
  await expect(
    page
      .locator('.ant-table-tbody > tr.ant-table-row')
      .filter({ hasText: '956aee70-5f36-4786-af3c-e7b73dafa8a1' })
  ).toBeVisible();

  const previewButton = page.getByRole('button', {
    name: '956aee70-5f36-4786-af3c-e7b73dafa8a1 문항 전체 미리 보기'
  });
  await previewButton.hover();

  const previewPopover = page.locator('.ant-popover:visible').last();
  await expect(previewPopover).toContainText('prompt_text');
  await expect(previewPopover).toContainText('정신 건강 상담');
  await expect(previewPopover).toContainText('필요한 도움을 더 이른 시기에 연결');
  await previewPopover.getByRole('button', { name: '검토하기' }).click();

  await expect(page).toHaveURL(
    /\/assessment\/question-bank\/review\/956aee70-5f36-4786-af3c-e7b73dafa8a1/
  );
  await expect(
    page.getByRole('heading', {
      name: '956aee70-5f36-4786-af3c-e7b73dafa8a1 문항 검토'
    })
  ).toBeVisible();

  await page.getByRole('button', { name: '목록으로 돌아가기' }).click();
  await expect(page).toHaveURL(/\/assessment\/question-bank\?/);
  await expect(page.getByLabel('문항 검색어')).toHaveValue('정신 건강');
});

test('상세 페이지는 review_memo와 review_passed만 수정하고 감사 로그로 연결한다', async ({
  page
}) => {
  await page.goto(
    '/assessment/question-bank/review/d04cf277-a178-4810-8720-dbef5c781ea7'
  );

  await expect(
    page.getByRole('heading', {
      name: 'd04cf277-a178-4810-8720-dbef5c781ea7 문항 검토'
    })
  ).toBeVisible();
  await expect(page.getByText('meta.question_type', { exact: true })).toBeVisible();
  await expect(page.getByText('review_workflow', { exact: true })).toBeVisible();
  await expect(page.getByText('prompt_text', { exact: true })).toBeVisible();
  await expect(page.getByText('edit_history (4건)', { exact: true })).toBeVisible();

  const reviewMemoField = page.getByLabel('review_memo 입력');
  await reviewMemoField.fill(
    'JSON 기반 문항 구조는 유지하되 review_passed 토글 흐름을 점검했습니다.'
  );

  await page.getByRole('button', { name: 'review_memo 저장' }).click();
  await expect(page.getByText('review_memo를 저장했습니다.')).toBeVisible();

  await page.getByRole('button', { name: '검수 통과' }).click();
  const modal = await getVisibleModal(page);
  await expect(modal).toContainText('검수 통과 처리');
  await confirmVisibleReasonModal(page, 'e2e review_passed true');

  await expect(
    page.getByText('review_passed 값을 true로 변경했습니다.')
  ).toBeVisible();
  await expect(
    page
      .locator('.assessment-review-page__memo-card .ant-tag')
      .filter({ hasText: '검수 통과' })
  ).toBeVisible();

  await page
    .locator('.ant-notification-notice:visible')
    .getByRole('link', { name: '감사 로그 확인' })
    .last()
    .click();

  await expect(page).toHaveURL(
    /\/system\/audit-logs\?targetType=AssessmentQuestion&targetId=d04cf277-a178-4810-8720-dbef5c781ea7/
  );
  await expect(
    page.locator('tbody tr').filter({ hasText: '검수 통과' })
  ).toBeVisible();

  await page
    .locator('.ant-table-tbody > tr.ant-table-row')
    .first()
    .getByRole('link', { name: 'd04cf277-a178-4810-8720-dbef5c781ea7' })
    .click();
  await expect(page).toHaveURL(
    /\/assessment\/question-bank\/review\/d04cf277-a178-4810-8720-dbef5c781ea7/
  );
});
