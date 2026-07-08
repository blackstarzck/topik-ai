import { expect, test } from '@playwright/test';

import { expectNotificationAuditHref } from './source-flow-helpers';

// Operation > PDF 내보내기 제한. mock 모드(VITE_SUPABASE_DISABLED=true) 기준으로
// 단일 설정 폼 저장(사유 필수 + 이력 적재)과 한도 0(중단) 2차 확인,
// 초기화 실행(개인/전체, 전체는 2차 확인) 흐름을 검증한다.

test('pdf quota policy settings form saves with reason and appends history', async ({
  page
}) => {
  await page.goto('/operation/pdf-quota');

  await expect(page.getByRole('heading', { name: 'PDF 내보내기 제한' })).toBeVisible();
  await expect(page.getByText('현재 정책: 3회/월')).toBeVisible();

  // 구형 감사 행(diff 부분 기록)은 결과값 fallback으로 렌더된다.
  await expect(page.getByText('(결과값)').first()).toBeVisible();

  // 사유 없이 저장하면 검증 오류로 막힌다.
  await page.getByRole('button', { name: '정책 저장' }).click();
  await expect(page.getByText('사유를 입력하세요.')).toBeVisible();

  await page.getByLabel('주기당 내보내기 한도(회)').fill('5');
  await page.getByLabel('사유/근거').fill('e2e pdf quota policy edit');
  await page.getByRole('button', { name: '정책 저장' }).click();

  await expectNotificationAuditHref(page, 'PdfQuotaPolicy', 'PDFQ-POLICY-001');
  await expect(page.getByText('현재 정책: 5회/월')).toBeVisible();
  await expect(
    page.locator('.ant-table-row', { hasText: 'e2e pdf quota policy edit' })
  ).toBeVisible();
});

test('pdf quota limit zero pauses export with warning and second confirm', async ({
  page
}) => {
  await page.goto('/operation/pdf-quota');
  await expect(page.getByText('현재 정책: 3회/월')).toBeVisible();

  await page.getByLabel('주기당 내보내기 한도(회)').fill('0');
  await expect(
    page.getByText('한도 0회는 전 사용자의 PDF 내보내기를 중단합니다.')
  ).toBeVisible();

  await page.getByLabel('사유/근거').fill('e2e pdf quota pause');
  await page.getByRole('button', { name: '정책 저장' }).click();

  const confirmModal = page.locator('.ant-modal:visible').last();
  await expect(confirmModal).toContainText('PDF 내보내기 중단 확인');
  await confirmModal.getByRole('button', { name: '저장 실행' }).click();

  await expectNotificationAuditHref(page, 'PdfQuotaPolicy', 'PDFQ-POLICY-001');
  await expect(page.getByText('내보내기 중단됨')).toBeVisible();
  await expect(
    page.getByText('현재 PDF 내보내기가 중단된 상태입니다(한도 0회).')
  ).toBeVisible();
  await expect(
    page.locator('.ant-table-row', { hasText: 'e2e pdf quota pause' })
  ).toBeVisible();
});

test('pdf quota resets tab lists history and creates a global reset with second confirm', async ({
  page
}) => {
  await page.goto('/operation/pdf-quota?tab=resets');

  const seededRow = page
    .locator('.ant-table-row', { hasText: '학습자 문의(중복 결제)' })
    .first();
  await expect(page.getByRole('button', { name: '초기화 실행' })).toBeVisible();
  await expect(seededRow).toBeVisible();
  await expect(seededRow).toContainText('개인');

  await page.getByRole('button', { name: '초기화 실행' }).click();
  const modal = page.locator('.ant-modal:visible').last();
  await expect(modal).toContainText('이번 주기 사용량만 초기화됩니다.');

  // 개인 범위는 대상 회원 선택을 요구한다.
  await modal.locator('.ant-modal-footer .ant-btn-primary').click();
  await expect(modal.getByText('대상 회원을 선택하세요.')).toBeVisible();

  // 전체 범위 선택 → 경고 노출 + 사유 입력 → 2차 확인 모달.
  await modal.getByRole('radio', { name: '전체' }).check();
  await expect(modal.getByText('모든 회원이 대상입니다.')).toBeVisible();
  await modal.getByLabel('사유/근거').fill('e2e pdf quota global reset');
  await modal.locator('.ant-modal-footer .ant-btn-primary').click();

  const confirmModal = page.locator('.ant-modal:visible').last();
  await expect(confirmModal).toContainText('전체 초기화 확인');
  await confirmModal.getByRole('button', { name: '전체 초기화 실행' }).click();

  await expectNotificationAuditHref(page, 'PdfQuotaReset', 'PDFQ-RESET-003');
  await expect(
    page.locator('.ant-table-row', { hasText: 'e2e pdf quota global reset' })
  ).toBeVisible();
});
