import { toSafeResult, withRetry } from '../../../shared/api/safe-request';
import { isSupabaseConfigured } from '../../../shared/api/supabase-client';
import { getMockUserById } from '../../users/api/mock-users';
import { useCommerceStore } from '../model/commerce-store';
import type {
  PaymentRow,
  PaymentStatus,
  RefundRow,
  RefundStatus
} from '../model/types';
import { loadPaymentsFromSupabase, loadRefundsFromSupabase } from './supabase-billing-service';

export type { PaymentRow, PaymentStatus, RefundRow, RefundStatus };

type UpdateBillingRefundPayload = {
  refundId: string;
  changedBy: string;
  reason: string;
};

/**
 * Phase D (read-first): real v13 billing inventory when connected; the existing
 * in-memory mock store otherwise (unchanged). READ-ONLY — no write path here.
 */
async function loadPayments(signal?: AbortSignal): Promise<PaymentRow[]> {
  if (isSupabaseConfigured) {
    return loadPaymentsFromSupabase(signal);
  }
  return useCommerceStore.getState().payments;
}

async function loadRefunds(signal?: AbortSignal): Promise<RefundRow[]> {
  if (isSupabaseConfigured) {
    return loadRefundsFromSupabase(signal);
  }
  return useCommerceStore.getState().refunds;
}

function assertMockRefundActionAllowed(): void {
  if (isSupabaseConfigured) {
    throw new Error('Supabase 연결 상태에서는 mock 환불 조치를 실행할 수 없습니다.');
  }
}

async function approveBillingRefund(
  payload: UpdateBillingRefundPayload
): Promise<RefundRow> {
  assertMockRefundActionAllowed();
  const updatedRefund = useCommerceStore.getState().approveRefund(payload);

  if (!updatedRefund) {
    throw new Error('처리 가능한 환불 요청을 찾을 수 없습니다.');
  }

  return updatedRefund;
}

async function rejectBillingRefund(
  payload: UpdateBillingRefundPayload
): Promise<RefundRow> {
  assertMockRefundActionAllowed();
  const updatedRefund = useCommerceStore.getState().rejectRefund(payload);

  if (!updatedRefund) {
    throw new Error('처리 가능한 환불 요청을 찾을 수 없습니다.');
  }

  return updatedRefund;
}

export function getBillingUserNameSafe(
  record: Pick<PaymentRow | RefundRow, 'userId' | 'userNickname'>
): string {
  return getMockUserById(record.userId)?.realName ?? record.userNickname;
}

export function fetchPaymentsSafe(signal?: AbortSignal) {
  return toSafeResult(() => withRetry(() => loadPayments(signal), { maxRetries: 1 }));
}

export function fetchRefundsSafe(signal?: AbortSignal) {
  return toSafeResult(() => withRetry(() => loadRefunds(signal), { maxRetries: 1 }));
}

export function approveBillingRefundSafe(payload: UpdateBillingRefundPayload) {
  return toSafeResult(() => approveBillingRefund(payload));
}

export function rejectBillingRefundSafe(payload: UpdateBillingRefundPayload) {
  return toSafeResult(() => rejectBillingRefund(payload));
}
