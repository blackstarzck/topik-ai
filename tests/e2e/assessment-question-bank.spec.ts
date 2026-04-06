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

test('TOPIK 쓰기 문제은행 요약 카드는 현재 탭 상태 필터로 즉시 연결된다', async ({
  page
}) => {
  await page.goto('/assessment/question-bank?questionNo=53');

  const reviewHoldCard = page.getByRole('button', { name: /보류/ }).first();
  await expect(reviewHoldCard).toHaveAttribute('aria-pressed', 'false');
  await reviewHoldCard.click();

  await expect(page).toHaveURL(/questionNo=53&reviewStatus=/);
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

  await expect(page.getByLabel('문항 검색어')).toBeVisible();
  await expect(page.getByRole('columnheader', { name: '문항 번호' })).toBeVisible();
  await expect(
    page.getByRole('columnheader', { name: '문항', exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole('columnheader', { name: '문항 주제 / 도메인' })
  ).toBeVisible();
  await expect(page.getByRole('columnheader', { name: '문항 미리보기' })).toHaveCount(0);
  await expect(page.getByRole('columnheader', { name: '자동 점검' })).toHaveCount(0);
  await expect(page.getByRole('columnheader', { name: '액션' })).toHaveCount(0);
  await page.getByRole('button', { name: '상세' }).click();

  const domainFilter = page.getByLabel('도메인 필터').first();
  const typeFilter = page.getByLabel('유형 필터').first();
  const difficultyFilter = page.getByLabel('난이도 필터').first();

  await expect(domainFilter).toBeVisible();
  await expect(typeFilter).toBeVisible();
  await expect(difficultyFilter).toBeVisible();

  await domainFilter.click();
  await page.getByRole('option', { name: '사회' }).click();

  await typeFilter.click();
  await page.getByRole('option', { name: '자료 설명' }).click();

  await difficultyFilter.click();
  await page.getByRole('option', { name: '중' }).click();

  await page.getByLabel('문항 검색어').fill('다문화');
  await page.getByRole('button', { name: '적용' }).click();

  await expect(page).toHaveURL(/questionNo=53/);
  await expect(page.locator('tbody tr').filter({ hasText: 'AQ-53002' })).toBeVisible();
  await expect(page.locator('tbody tr').filter({ hasText: 'AQ-53001' })).toHaveCount(0);

  const filteredMetaCell = page
    .locator('tbody tr')
    .filter({ hasText: 'AQ-53002' })
    .first()
    .locator('td')
    .nth(2);
  await expect(filteredMetaCell).toContainText('다문화 공존');
  await expect(filteredMetaCell).toContainText('사회');
  await expect(filteredMetaCell).not.toContainText('자료 설명');
  await expect(filteredMetaCell).not.toContainText('난이도');

  await page.locator('tbody tr').filter({ hasText: 'AQ-53002' }).first().click();

  await expect(page).toHaveURL(/\/assessment\/question-bank\/review\/AQ-53002/);
  await expect(
    page.getByRole('heading', { name: 'TOPIK 53번 문항 검수' })
  ).toBeVisible();

  await page.getByRole('button', { name: '목록으로 돌아가기' }).click();
  await expect(page).toHaveURL(/\/assessment\/question-bank\?/);
  await expect(page.getByLabel('문항 검색어')).toHaveValue('다문화');

  await page.getByRole('button', { name: '상세' }).click();
  await expect(page.getByLabel('도메인 필터').first()).toContainText('사회');
  await expect(page.getByLabel('유형 필터').first()).toContainText('자료 설명');
  await expect(page.getByLabel('난이도 필터').first()).toContainText('중');
  await expect(page.getByRole('columnheader', { name: '자동 점검' })).toHaveCount(0);
});

test('JSON 기반 mock 문항 컬럼은 prompt_text를 사용하고 셀에서는 한 줄로 노출한다', async ({
  page
}) => {
  await page.goto('/assessment/question-bank?questionNo=53');

  const firstQuestionCell = page
    .locator('tbody tr')
    .filter({ hasText: 'AQ-51001' })
    .first()
    .locator('td')
    .nth(3);
  const firstQuestionParagraph = firstQuestionCell.locator('.ant-typography');

  await expect(firstQuestionCell).toContainText(
    '다음을 주제로 하여 자신의 생각을 600~700자로 쓰시오.'
  );

  const cellBox = await firstQuestionCell.boundingBox();
  const paragraphBox = await firstQuestionParagraph.boundingBox();
  expect(cellBox?.width ?? 0).toBeLessThanOrEqual(540);
  expect(paragraphBox?.height ?? 0).toBeLessThanOrEqual(24);

  await page.goto('/assessment/question-bank?questionNo=53');

  const secondQuestionCell = page
    .locator('tbody tr')
    .filter({ hasText: 'AQ-54002' })
    .first()
    .locator('td')
    .nth(3);
  await expect(secondQuestionCell).toContainText(
    '다음을 주제로 하여 자신의 생각을 600~700자로 쓰시오.'
  );
});

test('문항 컬럼 hover 툴팁은 검수 상세 본문과 같은 줄바꿈으로 문항 전문을 보여준다', async ({
  page
}) => {
  await page.goto('/assessment/question-bank?questionNo=53');

  const questionRow = page.locator('tbody tr').filter({ hasText: 'AQ-54002' }).first();
  const questionTrigger = questionRow.getByLabel('AQ-54002 문항 전체 보기');
  await expect(questionTrigger).toBeVisible();

  await questionTrigger.hover();

  const previewPopover = page
    .locator('.ant-popover:visible')
    .filter({
      has: page.getByRole('button', { name: '검수하기' })
    })
    .last();
  const previewParagraph = previewPopover.locator(
    '.assessment-review-page__description-paragraph'
  );

  await expect(previewParagraph).toBeVisible();
  await expect(previewParagraph).toHaveCSS('white-space', 'pre-wrap');
  await expect(previewPopover).toContainText(
    '다음을 주제로 하여 자신의 생각을 600~700자로 쓰시오.'
  );
  await expect(previewParagraph).toContainText('1)');
  await expect(previewParagraph).toContainText('2)');
  await expect(previewParagraph).toContainText('3)');

  const reviewButton = previewPopover.getByRole('button', { name: '검수하기' });
  await expect(reviewButton).toBeVisible();
  await reviewButton.click();

  await expect(page).toHaveURL(/\/assessment\/question-bank\/review\/AQ-54002/);
  await expect(
    page.getByRole('heading', { name: 'TOPIK 53번 문항 검수' })
  ).toBeVisible();
});

test('2depth 검수 페이지는 문항 번호별 검수 항목을 다르게 노출한다', async ({
  page
}) => {
  await page.goto('/assessment/question-bank/review/AQ-51001?questionNo=53&tab=review');

  await expect(
    page.getByRole('heading', { name: 'TOPIK 53번 문항 검수' })
  ).toBeVisible();
  await expect(page.getByText('유연근무제 운영', { exact: true })).toBeVisible();
  await expect(
    page.getByText('다음을 주제로 하여 자신의 생각을 600~700자로 쓰시오.')
  ).toBeVisible();
  await expect(
    page.getByText('다음을 읽고 가장 알맞은 것을 고르십시오.')
  ).toHaveCount(0);
  await expect(
    page.locator('tr').filter({
      has: page.getByText('문항 지시문', { exact: true })
    })
  ).toContainText('-');
  await expect(
    page.locator('tr').filter({
      has: page.getByText('출처', { exact: true })
    }).first()
  ).toContainText('-');
  await expect(page.getByText('문항', { exact: true })).toBeVisible();
  await expect(page.getByText('출처', { exact: true })).toBeVisible();
  await expect(page.getByText('핵심 의미', { exact: true })).toBeVisible();
  await expect(page.getByText('핵심 문제', { exact: true })).toBeVisible();
  await expect(page.getByText('채점 기준', { exact: true })).toBeVisible();
  await expect(
    page.getByText('주어진 세 가지 과제를 모두 수행하고, 주제와 직접 관련된 내용을 풍부하고 구체적으로 전개하였는가.')
  ).toBeVisible();
  await expect(
    page.getByText('도서관 이용 맥락과 공공 예절을 정확히 읽었는지')
  ).toHaveCount(0);
  await expect(page.getByText('출제 기준', { exact: true })).toHaveCount(0);
  await expect(page.getByText('샘플 문항 N', { exact: true })).toHaveCount(0);
  await expect(page.getByText('문항 질문', { exact: true })).toHaveCount(0);
  await expect(page.getByText('그래프', { exact: true })).toHaveCount(0);

  await page.goto('/assessment/question-bank/review/AQ-53002?questionNo=53&tab=review');

  await expect(
    page.getByRole('heading', { name: 'TOPIK 53번 문항 검수' })
  ).toBeVisible();
  await expect(page.getByText('다문화 공존', { exact: true })).toBeVisible();
  await expect(
    page.getByText('다음을 주제로 하여 자신의 생각을 600~700자로 쓰시오.')
  ).toBeVisible();
  await expect(page.getByText('출처', { exact: true })).toBeVisible();
  await expect(page.getByText('핵심 의미', { exact: true })).toBeVisible();
  await expect(page.getByText('핵심 문제', { exact: true })).toBeVisible();
  await expect(page.getByText('채점 기준', { exact: true })).toBeVisible();
  await expect(page.getByText('문항 질문', { exact: true })).toHaveCount(0);
  await expect(page.getByText('문항', { exact: true })).toHaveCount(0);
  await expect(page.getByText('그래프', { exact: true })).toHaveCount(0);
  await expect(page.getByText('출제 기준', { exact: true })).toHaveCount(0);
  await expect(page.getByText('샘플 문항 N', { exact: true })).toHaveCount(0);

  await page.goto('/assessment/question-bank/review/AQ-54001?questionNo=53&tab=review');

  await expect(
    page.getByRole('heading', { name: 'TOPIK 53번 문항 검수' })
  ).toBeVisible();
  await expect(page.getByText('기초 금융 이해 교육', { exact: true })).toBeVisible();
  await expect(
    page.getByText('다음을 주제로 하여 자신의 생각을 600~700자로 쓰시오.')
  ).toBeVisible();
  await expect(
    page.getByText('다음 주제에 대해 자신의 생각을 600~700자로 쓰십시오.')
  ).toHaveCount(0);
  await expect(page.getByText('문항 질문', { exact: true })).toBeVisible();
  await expect(page.getByText('출처', { exact: true })).toBeVisible();
  await expect(page.getByText('핵심 의미', { exact: true })).toBeVisible();
  await expect(page.getByText('핵심 문제', { exact: true })).toBeVisible();
  await expect(page.getByText('채점 기준', { exact: true })).toBeVisible();
  await expect(page.getByText('그래프', { exact: true })).toHaveCount(0);
  await expect(page.getByText('문항', { exact: true })).toHaveCount(0);
  await expect(page.getByText('출제 기준', { exact: true })).toHaveCount(0);
  await expect(page.getByText('샘플 문항 N', { exact: true })).toHaveCount(0);
});

test('2depth 검수 페이지는 검수 상태 변경 액션과 후속 감사 로그 경로를 제공한다', async ({
  page
}) => {
  await page.goto('/assessment/question-bank/review/AQ-54001?questionNo=53&tab=review');

  await expect(
    page.getByRole('heading', { name: 'TOPIK 53번 문항 검수' })
  ).toBeVisible();
  await expect(page.getByText('문항 지시문', { exact: true })).toBeVisible();
  await expect(page.getByText('문항 질문', { exact: true })).toBeVisible();
  await expect(page.getByText('출처', { exact: true })).toBeVisible();
  await expect(page.getByText('핵심 의미', { exact: true })).toBeVisible();
  await expect(page.getByText('핵심 문제', { exact: true })).toBeVisible();
  await expect(page.getByText('모범답안', { exact: true })).toBeVisible();
  await expect(page.getByText('채점 기준', { exact: true })).toBeVisible();
  await expect(page.getByText('출제 기준', { exact: true })).toHaveCount(0);
  await expect(page.getByText('샘플 문항 N', { exact: true })).toHaveCount(0);
  await expect(page.getByText('수정 히스토리 (4건)', { exact: true })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: '요약' })).toHaveCount(0);
  await expect(page.getByRole('columnheader', { name: '반영 소스' })).toHaveCount(0);

  await page
    .locator('.assessment-review-page__history-table .ant-table-row-expand-icon')
    .first()
    .click();
  await expect(page.getByText('검수자 메모', { exact: true })).toBeVisible();
  await expect(page.getByText('반영 리뷰', { exact: true })).toBeVisible();
  await expect(page.getByText('반영 필드', { exact: true })).toBeVisible();
  await expect(page.getByText('prompt_text', { exact: true })).toBeVisible();

  const reviewMemoField = page.getByLabel('검수 메모 입력');
  const completeButton = page.getByRole('button', { name: '검수 완료' });

  await expect(page.getByRole('button', { name: '보류' })).toBeVisible();
  await expect(page.getByRole('button', { name: '수정 필요' })).toBeVisible();
  await expect(
    page
      .locator('.assessment-review-page__side')
      .getByRole('link', { name: '감사 로그 확인' })
  ).toHaveCount(0);

  await reviewMemoField.fill(
    '논제 범위는 적절하지만 최근 배치와 주제 중복 여부를 한 번 더 확인해야 합니다.'
  );
  await expect(completeButton).toBeEnabled();

  await completeButton.click();
  const modal = await getVisibleModal(page);
  await expect(modal).toContainText('검수 완료 처리');
  await confirmVisibleReasonModal(page, 'e2e 검수 완료');
  await expect(page.getByText('검수 완료 처리했습니다.')).toBeVisible();

  await page
    .locator('.ant-notification-notice:visible')
    .getByRole('link', { name: '감사 로그 확인' })
    .last()
    .click();
  await expect(page).toHaveURL(
    /\/system\/audit-logs\?targetType=AssessmentQuestion&targetId=AQ-54001/
  );
});

test('문항 관리 탭은 액션 컬럼과 상세 Drawer 없이 목록만 유지한다', async ({
  page
}) => {
  await page.goto('/assessment/question-bank?tab=manage&questionNo=53');
  await expect(page.getByRole('columnheader', { name: '문항 번호' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: '액션' })).toHaveCount(0);

  const managedRow = page.locator('tbody tr').filter({ hasText: 'AQ-54001' }).first();
  await managedRow.click();

  await expect(page).toHaveURL(/\/assessment\/question-bank\?tab=manage&questionNo=53$/);
  await expect(page.locator('.ant-drawer-content-wrapper:visible')).toHaveCount(0);
  await expect(managedRow).toContainText('미지정');
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
