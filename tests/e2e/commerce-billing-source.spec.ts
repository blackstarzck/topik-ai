import { expect, test } from '@playwright/test';

import {
  confirmVisibleAction,
  expectQueryParam,
  expectRowVisible,
  openRowOverlay
} from './source-flow-helpers';

test('commerce billing pages read billing mock seed through service and keep refund actions live', async ({
  page
}) => {
  await page.goto('/commerce/payments?searchField=id&keyword=PAY-1001');

  await expectQueryParam(page, 'searchField', 'id');
  await expectQueryParam(page, 'keyword', 'PAY-1001');
  const paymentModal = await openRowOverlay(page, 'PAY-1001');
  await expect(paymentModal).toContainText('PAY-1001');
  await paymentModal.locator('.ant-modal-close, .ant-drawer-close').click();
  await expect(paymentModal).not.toBeVisible();

  await page.goto('/commerce/refunds?searchField=id&keyword=RF-001');
  await expectQueryParam(page, 'searchField', 'id');
  await expectQueryParam(page, 'keyword', 'RF-001');
  const refundRow = await expectRowVisible(page, 'RF-001');
  const refundDrawer = await openRowOverlay(page, 'RF-001');
  await expect(refundDrawer).toContainText('RF-001');
  await refundDrawer.locator('.ant-modal-close, .ant-drawer-close').click();
  await expect(refundDrawer).not.toBeVisible();

  await refundRow.locator('button').first().click();
  await confirmVisibleAction(page, 'e2e billing refund source transition');
  await expect(
    refundRow.locator('a[href*="/system/audit-logs"][href*="targetType=CommerceRefund"][href*="targetId=RF-001"]')
  ).toBeVisible();
});

test('payments summary keeps both halves of the refund KPI wired', async ({
  page
}) => {
  await page.goto('/commerce/payments');

  const refundCard = page.locator('.list-summary-card', {
    hasText: '환불 관련 건수'
  });
  await expect(refundCard).toBeVisible();

  // 이 수치는 두 조회의 합이다 — 결제 목록의 환불 종결 1건 + 환불 요청 목록의 처리 대기 1건
  // (mock seed). 어느 한쪽 배선이 끊기면 값이 내려가거나 '집계 불가' 가 된다. 이전 배선은
  // 환불 요청 조회 실패를 삼켜 낮은 수치를 정상처럼 보여줬다(gap-register §3.13 ⑨).
  await expect(refundCard.locator('.list-summary-card__value')).toHaveText('2건');
  await expect(refundCard).not.toContainText('집계 불가');
});
