import { describe, expect, it } from 'vitest';

import { resolveRefundRelatedSummary } from '../../src/features/billing/model/refund-summary';
import type { PaymentRow, RefundRow } from '../../src/features/billing/model/types';

/**
 * 결제 내역 화면의 `환불 관련 건수` 카드 계산을 고정한다.
 *
 * 이 화면은 e2e 로 **실패 경로를 만들 수 없다**(mock 모드는 항상 성공하고, 별도 네트워크
 * 요청이 없어 라우트 가로채기도 불가). 그래서 카드 값 계산을 순수 함수로 떼어
 * 여기서 단위 테스트로 고정한다 — 회귀가 생기면 e2e 가 아니라 이 테스트가 잡는다.
 */
function payment(status: string): PaymentRow {
  return {
    id: `PAY-${status}`,
    userId: 'U-1',
    userNickname: 'nick',
    product: '구독',
    amount: 1000,
    method: '카드',
    paidAt: '2026-08-20T00:00:00.000Z',
    status
  };
}

function refund(status: string): RefundRow {
  return {
    id: `RF-${status}`,
    paymentId: 'PAY-1',
    userId: 'U-1',
    userNickname: 'nick',
    requestedAmount: 1000,
    reason: '단순 변심',
    status,
    requestedAt: '2026-08-20T00:00:00.000Z'
  };
}

describe('resolveRefundRelatedSummary', () => {
  it('두 조회의 합을 건수로 보여준다', () => {
    const summary = resolveRefundRelatedSummary(
      [payment('환불'), payment('환불'), payment('완료')],
      [refund('처리 대기'), refund('승인')],
      'success'
    );

    expect(summary).toEqual({ value: '3건' });
  });

  it('환불 요청 조회가 실패하면 숫자를 보여주지 않는다', () => {
    // 🚨 이전 배선의 결함: 실패해도 목록이 [] 로 남아 `2건`(결제측 절반)을 정상처럼 보여줬다.
    const summary = resolveRefundRelatedSummary(
      [payment('환불'), payment('환불')],
      [],
      'error'
    );

    expect(summary.value).toBe('집계 불가');
    expect(summary.value).not.toMatch(/\d/);
    expect(summary.hint).toBe('환불 요청 조회 실패');
  });

  it('실패 상태에서는 결제측 건수가 있어도 값이 바뀌지 않는다', () => {
    const withPayments = resolveRefundRelatedSummary([payment('환불')], [], 'error');
    const withoutPayments = resolveRefundRelatedSummary([], [], 'error');

    expect(withPayments).toEqual(withoutPayments);
  });

  it('빈 결과(empty)와 조회 전(pending)은 실패가 아니므로 0건으로 센다', () => {
    for (const status of ['pending', 'empty', 'idle'] as const) {
      const summary = resolveRefundRelatedSummary([], [], status);
      expect(summary).toEqual({ value: '0건' });
    }
  });

  it('처리 대기가 아닌 환불 요청은 세지 않는다', () => {
    const summary = resolveRefundRelatedSummary(
      [],
      [refund('승인'), refund('반려')],
      'success'
    );

    expect(summary).toEqual({ value: '0건' });
  });

  it('힌트는 실패 상태에서만 붙는다', () => {
    const success = resolveRefundRelatedSummary([], [refund('처리 대기')], 'success');

    expect(success.hint).toBeUndefined();
  });
});
