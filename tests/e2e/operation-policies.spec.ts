import { expect, test, type Page } from 'playwright/test';

const policyType = '이용약관';

async function fillPolicyForm(
  page: Page,
  input: {
    title: string;
    version: string;
    effectiveDate: string;
    summary: string;
    body: string;
  }
) {
  await page.getByPlaceholder('문서명을 입력하세요.').fill(input.title);
  await page.getByPlaceholder('예: v2026.03').fill(input.version);

  await page.getByLabel('정책 등록 단계').getByText('노출 및 동의').click();
  await page.locator('.ant-picker input').fill(input.effectiveDate);
  await page.locator('.ant-picker input').press('Enter');
  await page.getByRole('row', { name: /노출 위치/ }).getByRole('combobox').click();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');

  await page.getByLabel('정책 등록 단계').getByText('추적 근거').click();
  await expect(page.getByRole('row', { name: /연관 관리자 화면/ })).toBeVisible();
  await expect(page.getByRole('row', { name: /연관 사용자 화면/ })).toBeVisible();
  await page
    .getByPlaceholder(
      '한 줄에 하나씩 입력하세요. 예: docs/specs/page-ia/operation-policies-page-ia.md'
    )
    .fill('docs/specs/page-ia/operation-policies-page-ia.md');

  await page.getByLabel('정책 등록 단계').getByText('법령 및 요약').click();
  await page
    .getByPlaceholder('운영자가 먼저 확인해야 할 핵심 요약을 입력하세요.')
    .fill(input.summary);
  await page
    .getByPlaceholder('한 줄에 하나씩 입력하세요. 예: 개인정보 보호법')
    .fill('전자상거래법\n전자금융거래법');

  await page.getByLabel('정책 등록 단계').getByText('정책 본문').click();
  const editorBody = page.frameLocator('iframe').locator('body');
  await editorBody.waitFor();
  await editorBody.click();
  await editorBody.fill(input.body);
}

async function fillOpenConfirmReason(page: Page, reason: string) {
  await page.locator('.ant-modal textarea').last().fill(reason);
}

async function closePreviewModal(page: Page, titlePattern: RegExp) {
  await page
    .getByRole('dialog', { name: titlePattern })
    .getByRole('button', { name: '닫기' })
    .click();
}

test('정책 등록 후 요약 카드 필터, 미리보기, 게시, 삭제까지 수행할 수 있다', async ({
  page
}) => {
  const uniqueSuffix = Date.now().toString().slice(-6);
  const policyVersion = `v2026.04-${uniqueSuffix}`;
  const policyTitle = `테스트 이용약관 정책 ${uniqueSuffix}`;
  const policySummary =
    '서비스 이용 조건과 계정 운영 기준을 검수용으로 정리한 테스트 정책 요약입니다.';
  const policyBodyText = '결제 및 환불 기준\n테스트 본문\n결제 후 7일 이내';

  await page.goto(`/operation/policies?policyType=${encodeURIComponent(policyType)}`);

  await expect(page.getByRole('heading', { name: '정책 관리' })).toBeVisible();

  await page.getByRole('button', { name: '새 정책 등록' }).click();
  await expect(page).toHaveURL(/\/operation\/policies\/create/);
  await expect
    .poll(() => new URL(page.url()).searchParams.get('policyType'))
    .toBe(policyType);

  await fillPolicyForm(page, {
    title: policyTitle,
    version: policyVersion,
    effectiveDate: '2026-04-01',
    summary: policySummary,
    body: policyBodyText
  });

  await page.getByRole('button', { name: '저장' }).click();

  await expect(page).toHaveURL(/\/operation\/policies/);
  await expect
    .poll(() => new URL(page.url()).searchParams.get('policyType'))
    .toBe(policyType);
  await expect(page.getByText(policyTitle, { exact: true })).toBeVisible();

  await page.getByRole('button', { name: /^게시 중/ }).click();
  await expect
    .poll(() => new URL(page.url()).searchParams.get('summaryFilter'))
    .toBe('published');
  await expect(page.getByText(policyTitle, { exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: /^전체 정책/ }).click();
  await expect
    .poll(() =>
      new URL(page.url()).searchParams.has('summaryFilter') ? 'present' : 'absent'
    )
    .toBe('absent');
  await expect(page.getByText(policyTitle, { exact: true })).toBeVisible();

  await page.getByText(policyTitle, { exact: true }).click();
  await expect(page.getByText(/정책 상세 · POL-/)).toBeVisible();
  const detailDrawer = page.getByRole('dialog').filter({ has: page.getByText(/정책 상세 · POL-/) });

  await page.getByRole('button', { name: '본문 미리보기' }).click();
  await expect(page.getByText('결제 및 환불 기준')).toBeVisible();
  await expect(page.getByText('결제 후 7일 이내')).toBeVisible();
  await closePreviewModal(page, /정책 본문 미리보기 · POL-/);

  const historySection = page
    .locator('.detail-drawer__section')
    .filter({ has: page.getByText('정책 히스토리', { exact: true }) });
  const historyRows = historySection.locator('tbody tr.ant-table-row-level-0');
  const historyExpandedRows = historySection.locator('tbody tr.ant-table-expanded-row');

  await expect(historySection).toBeVisible();
  await expect(historyRows).toHaveCount(1);
  await expect(historySection.getByRole('cell', { name: policyVersion })).toBeVisible();
  await historyRows.first().click();
  await expect(historyExpandedRows.first()).toBeVisible();
  await expect(historyExpandedRows.first()).toContainText(
    'docs/specs/page-ia/operation-policies-page-ia.md'
  );

  await detailDrawer.getByRole('button', { name: '게시', exact: true }).click();
  await fillOpenConfirmReason(page, '정책 검토 완료 후 게시');
  await page.locator('.ant-modal').getByRole('button', { name: '게시 실행' }).click();

  await expect(historyRows).toHaveCount(2);
  await expect(detailDrawer.getByRole('button', { name: '숨김', exact: true })).toBeVisible();

  await detailDrawer.getByRole('button', { name: '정책 삭제', exact: true }).click();
  await fillOpenConfirmReason(page, '검토 완료 후 테스트 데이터 정리');
  await page.locator('.ant-modal').getByRole('button', { name: '삭제 실행' }).click();

  await expect(page.getByText(policyTitle, { exact: true })).toHaveCount(0);
});

test('내용 수정, 새 버전 등록, 히스토리 본문 보기와 이 버전 게시를 수행할 수 있다', async ({
  page
}) => {
  const uniqueSuffix = Date.now().toString().slice(-6);
  const policyTitle = `버전 관리 테스트 정책 ${uniqueSuffix}`;
  const initialVersion = `v2026.05-${uniqueSuffix}`;
  const nextVersion = `v2026.06-${uniqueSuffix}`;
  const initialSummary = '초기 운영 요약';
  const updatedSummary = '입력 오류를 바로잡은 운영 요약';
  const initialBody = '초기 정책 본문\n첫 번째 문장';
  const updatedBody = '수정된 정책 본문\n두 번째 문장';

  await page.goto(`/operation/policies?policyType=${encodeURIComponent(policyType)}`);
  await page.getByRole('button', { name: '새 정책 등록' }).click();

  await fillPolicyForm(page, {
    title: policyTitle,
    version: initialVersion,
    effectiveDate: '2026-05-01',
    summary: initialSummary,
    body: initialBody
  });

  await page.getByRole('button', { name: '저장' }).click();
  await expect(page.getByText(policyTitle, { exact: true })).toBeVisible();

  await page.getByText(policyTitle, { exact: true }).click();
  await expect(page.getByText(/정책 상세 · POL-/)).toBeVisible();
  const detailDrawer = page.getByRole('dialog').filter({ has: page.getByText(/정책 상세 · POL-/) });

  await detailDrawer.getByRole('button', { name: '내용 수정', exact: true }).click();
  await expect(page.getByRole('heading', { name: '정책 내용 수정 상세' })).toBeVisible();

  await page.getByLabel('정책 등록 단계').getByText('법령 및 요약').click();
  await page
    .getByPlaceholder('운영자가 먼저 확인해야 할 핵심 요약을 입력하세요.')
    .fill(updatedSummary);
  await page.getByLabel('정책 등록 단계').getByText('정책 본문').click();
  const editEditorBody = page.frameLocator('iframe').locator('body');
  await editEditorBody.waitFor();
  await editEditorBody.click();
  await editEditorBody.fill(updatedBody);
  await page.getByRole('button', { name: '저장' }).click();

  await page.getByText(policyTitle, { exact: true }).click();

  const historySection = page
    .locator('.detail-drawer__section')
    .filter({ has: page.getByText('정책 히스토리', { exact: true }) });
  const historyRows = historySection.locator('tbody tr.ant-table-row-level-0');

  await expect(historyRows).toHaveCount(2);

  await historySection.getByRole('button', { name: '본문 보기' }).first().click();
  await expect(page.getByText(updatedBody.split('\n')[0], { exact: true })).toBeVisible();
  await closePreviewModal(page, /정책 본문 미리보기 · v/);

  await historySection.getByRole('button', { name: '이 버전 게시' }).first().click();
  await fillOpenConfirmReason(page, '검토 완료된 히스토리 버전으로 노출 전환');
  await page.locator('.ant-modal').getByRole('button', { name: '이 버전 게시' }).click();

  await expect(historyRows).toHaveCount(3);
  await expect(detailDrawer.getByRole('button', { name: '숨김', exact: true })).toBeVisible();

  await detailDrawer.getByRole('button', { name: '새 버전 등록', exact: true }).click();
  await expect(page.getByRole('heading', { name: '정책 새 버전 등록 상세' })).toBeVisible();
  await expect(page.getByPlaceholder('문서명을 입력하세요.')).toHaveValue(policyTitle);
  await expect(page.getByPlaceholder('예: v2026.03')).toHaveValue('');

  await page.getByPlaceholder('예: v2026.03').fill(nextVersion);
  await page.getByLabel('정책 등록 단계').getByText('노출 및 동의').click();
  await page.locator('.ant-picker input').fill('2026-06-01');
  await page.locator('.ant-picker input').press('Enter');
  await page.getByRole('button', { name: '저장' }).click();

  await expect(page.getByText(nextVersion, { exact: true })).toBeVisible();
});
