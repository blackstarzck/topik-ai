import { expect, test } from 'playwright/test';

import { confirmVisibleReasonModal } from './harness/admin-flow-helpers';

const policyType = '이용약관';

// P6 — 게시된 이용약관 상세에 "사용자에게 알림" 버튼이 노출되고, 사유 입력 후 발송이
// 성공 처리되는지 검증한다(mock 모드: 실제 발송 없이 성공 응답). 실제 발송 파이프라인
// (투영/디스패치/이메일)은 Supabase 모드 dev DB 프로브로 별도 검증됨.
test('게시된 이용약관 상세에서 사용자에게 알림 발송 버튼이 노출되고 사유 입력 후 발송할 수 있다', async ({
  page
}) => {
  await page.goto(`/operation/policies?policyType=${encodeURIComponent(policyType)}`);
  await expect(page.getByRole('heading', { name: '정책 관리' })).toBeVisible();

  // 시드된 게시 상태 이용약관(POL-001) 상세 열기
  await page.getByText('TOPIK AI 이용약관', { exact: true }).first().click();
  await expect(page.getByText(/정책 상세 · POL-001/)).toBeVisible();
  const detailDrawer = page
    .getByRole('dialog')
    .filter({ has: page.getByText(/정책 상세 · POL-001/) });

  // 이용약관 + 게시 상태이므로 알림 버튼이 보여야 한다.
  const notifyButton = detailDrawer.getByRole('button', {
    name: '사용자에게 알림',
    exact: true
  });
  await expect(notifyButton).toBeVisible();

  await notifyButton.click();
  await expect(
    page.getByRole('dialog', { name: /사용자에게 약관 변경 알림/ })
  ).toBeVisible();
  await confirmVisibleReasonModal(page, '이용약관 개정 안내 발송 테스트');

  await expect(page.getByText('약관 변경 알림 발송', { exact: true })).toBeVisible();
});
