import type { AsyncStatus } from '@/shared/model/async-state';

import type { PaymentRow, RefundRow } from './types';

export type RefundRelatedSummary = {
  value: string;
  hint?: string;
};

/** 환불로 종결된 결제. */
const REFUNDED_PAYMENT_STATUS = '환불';
/** 아직 처리되지 않은 환불 요청. */
const PENDING_REFUND_STATUS = '처리 대기';

/**
 * 결제 내역 화면의 `환불 관련 건수` 카드 값.
 *
 * 이 수치는 **두 조회의 합**이다 — 결제 목록의 환불 종결 건수 + 환불 요청 목록의 처리
 * 대기 건수. 그래서 한쪽만 실패해도 합계의 절반이 비어 있다.
 *
 * 이전 배선은 환불 요청 조회의 실패 분기가 아예 없어서 실패하면 목록이 빈 배열로 남았고,
 * 카드는 처리 대기를 0 으로 더한 **낮은 수치를 정상처럼** 보여줬다(gap-register §3.13 ⑨).
 * 실패는 숫자로 표현하지 않는다 — 값을 비우고 무엇이 빠졌는지 알린다.
 */
export function resolveRefundRelatedSummary(
  payments: readonly PaymentRow[],
  refunds: readonly RefundRow[],
  refundsStatus: AsyncStatus
): RefundRelatedSummary {
  if (refundsStatus === 'error') {
    return { value: '집계 불가', hint: '환불 요청 조회 실패' };
  }

  const refundedPaymentCount = payments.filter(
    (row) => row.status === REFUNDED_PAYMENT_STATUS
  ).length;
  const pendingRefundCount = refunds.filter(
    (row) => row.status === PENDING_REFUND_STATUS
  ).length;

  return { value: `${(refundedPaymentCount + pendingRefundCount).toLocaleString()}건` };
}
