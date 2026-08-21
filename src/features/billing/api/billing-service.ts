import { toSafeResult, withRetry } from '@/shared/api/safe-request';
import { isSupabaseConfigured } from '@/shared/api/supabase-client';
import { sleep } from '@/shared/api/supabase-service-utils';
import { getMockUserRealName } from '@/features/users/api/users-service';
import { useCommerceStore } from '../model/commerce-store';
import type {
  PaymentRow,
  PaymentStatus,
  RefundRow,
  RefundStatus
} from '../model/types';
import { commerceRefundsDataSource } from './commerce-refunds-data-source';
import {
  approveBillingRefundViaRpc,
  loadPaymentsFromSupabase,
  loadRefundsFromSupabase,
  rejectBillingRefundViaRpc
} from './supabase-billing-service';

export type { PaymentRow, PaymentStatus, RefundRow, RefundStatus };

type UpdateBillingRefundPayload = {
  refundId: string;
  changedBy: string;
  reason: string;
};

async function loadPayments(signal?: AbortSignal): Promise<PaymentRow[]> {
  if (isSupabaseConfigured) {
    return loadPaymentsFromSupabase(signal);
  }
  // 다른 mock 서비스와 같은 인위적 지연. 이게 없으면 pending 프레임이 마이크로태스크
  // 한 번에 끝나 로딩 표시의 유무를 화면에서도 e2e 에서도 확인할 수 없다.
  await sleep(200, signal);
  return useCommerceStore.getState().payments;
}

async function loadRefunds(signal?: AbortSignal): Promise<RefundRow[]> {
  if (commerceRefundsDataSource === 'supabase') {
    return loadRefundsFromSupabase(signal);
  }
  await sleep(200, signal);
  return useCommerceStore.getState().refunds;
}

async function approveBillingRefund(
  payload: UpdateBillingRefundPayload
): Promise<RefundRow> {
  if (commerceRefundsDataSource === 'supabase') {
    return approveBillingRefundViaRpc(payload);
  }

  const updatedRefund = useCommerceStore.getState().approveRefund(payload);

  if (!updatedRefund) {
    throw new Error('처리 가능한 환불 요청을 찾을 수 없습니다.');
  }

  return updatedRefund;
}

async function rejectBillingRefund(
  payload: UpdateBillingRefundPayload
): Promise<RefundRow> {
  if (commerceRefundsDataSource === 'supabase') {
    return rejectBillingRefundViaRpc(payload);
  }

  const updatedRefund = useCommerceStore.getState().rejectRefund(payload);

  if (!updatedRefund) {
    throw new Error('처리 가능한 환불 요청을 찾을 수 없습니다.');
  }

  return updatedRefund;
}

export function getBillingUserNameSafe(
  record: Pick<PaymentRow | RefundRow, 'userId' | 'userNickname'>
): string {
  // Default (Supabase) path: the row already carries the DB-resolved nickname.
  // Only the fully-mock path (Supabase unconfigured) enriches via the mock fixture.
  if (isSupabaseConfigured) {
    return record.userNickname;
  }
  return getMockUserRealName(record.userId) ?? record.userNickname;
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
