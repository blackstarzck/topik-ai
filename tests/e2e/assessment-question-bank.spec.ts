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

test('TOPIK 쓰기 문제은행 검수 플로우와 감사 로그 연결이 동작한다', async ({
  page
}) => {
  await page.goto('/assessment/question-bank');

  await expect(
    page.getByRole('heading', { name: 'TOPIK 쓰기 문제은행' })
  ).toBeVisible();
  await expect(page.getByRole('tab', { name: '검수 큐' })).toBeVisible();
  await expect(page.getByRole('tab', { name: '51번' })).toBeVisible();
  await expect(
    page.getByPlaceholder('문항 ID, 배치 ID, 토픽을 검색하세요.')
  ).toBeVisible();

  const reviewRow = page.locator('tbody tr').filter({ hasText: 'AQ-51001' }).first();
  await expect(reviewRow).toBeVisible();
  await reviewRow.click();

  const drawer = await getVisibleDrawer(page);
  await expect(drawer).toContainText('TOPIK 51번 문항 · AQ-51001');
  await expect(drawer).toContainText('안내문 빈칸 어휘 선택');

  await drawer.getByRole('button', { name: '검수 완료' }).click();
  await confirmVisibleReasonModal(page, 'e2e 검수 완료 처리');

  await expect(drawer).toContainText('검수 완료');
  await expect(page.getByText('검수 완료 처리되었습니다.')).toBeVisible();

  await drawer.getByRole('link', { name: '감사 로그 확인' }).click();
  await expect(page).toHaveURL(
    /\/system\/audit-logs\?targetType=AssessmentQuestion&targetId=AQ-51001/
  );

  const auditRow = page
    .locator('tbody tr')
    .filter({ hasText: 'AQ-51001' })
    .filter({ hasText: '검수 완료' })
    .first();
  await expect(auditRow).toBeVisible();
});

test('문항 관리 탭은 URL 상태를 복원하고 운영 상태 변경을 저장한다', async ({
  page
}) => {
  await page.goto('/assessment/question-bank?tab=manage&questionNo=54&selected=AQ-54001');

  await expect(
    page.getByRole('heading', { name: 'TOPIK 쓰기 문제은행' })
  ).toBeVisible();
  await expect(page.getByRole('tab', { name: '문항 관리', selected: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: '54번', selected: true })).toBeVisible();

  const drawer = await getVisibleDrawer(page);
  await expect(drawer).toContainText('TOPIK 54번 문항 · AQ-54001');

  await drawer.getByRole('button', { name: '노출 후보' }).click();
  await confirmVisibleReasonModal(page, 'e2e 노출 후보 지정');

  await expect(drawer).toContainText('노출 후보');
  await expect(page).toHaveURL(
    /\/assessment\/question-bank\?tab=manage&questionNo=54&selected=AQ-54001/
  );

  await drawer.locator('.ant-drawer-close').click();
  await expect(drawer).toBeHidden();
  await expect(page).toHaveURL(/\/assessment\/question-bank\?tab=manage&questionNo=54$/);

  const managedRow = page.locator('tbody tr').filter({ hasText: 'AQ-54001' }).first();
  await expect(managedRow).toContainText('노출 후보');
});
