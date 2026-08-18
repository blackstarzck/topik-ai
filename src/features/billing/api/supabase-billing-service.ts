import type { PaymentRow, PaymentStatus, RefundRow, RefundStatus } from '../model/types';
import { requireClient, requireReason } from '@/shared/api/supabase-service-utils';
import { toDateOnly as toDate } from '@/shared/model/date-format';

/**
 * Payments remain a read-only v13 payment_history integration. Refund workflow
 * state is admin-owned in commerce_refunds; approving records intent only and
 * does not write back to v13 payment_history.
 */

type PaymentHistoryRow = {
  id: string;
  user_id: string;
  subscription_id: string | null;
  amount_cents: number;
  currency: string;
  status: string;
  paid_at: string | null;
  created_at: string;
  profiles?: { display_name: string | null; nickname: string | null } | null;
  subscriptions?: { plan_key: string | null; subscription_plans?: { name: string | null } | null } | null;
};

type CommerceRefundRow = {
  id: string;
  payment_id: string;
  user_id: string;
  user_nickname: string;
  requested_amount: number;
  reason: string;
  status: string;
  requested_at: string;
  processed_by: string | null;
  processed_at: string | null;
  review_reason: string | null;
};

const PAYMENT_STATUS_MAP: Record<string, PaymentStatus> = {
  paid: '완료',
  refunded: '환불',
  failed: '취소',
  pending: '취소'
};

const UI_REFUND_STATUS_BY_DB: Record<string, RefundStatus> = {
  pending: '처리 대기',
  approved: '승인',
  rejected: '거절'
};

const PAYMENT_SELECT =
  'id, user_id, subscription_id, amount_cents, currency, status, paid_at, created_at, ' +
  'profiles(display_name, nickname), subscriptions(plan_key, subscription_plans(name))';

const REFUND_COLUMNS = [
  'id',
  'payment_id',
  'user_id',
  'user_nickname',
  'requested_amount',
  'reason',
  'status',
  'requested_at',
  'processed_by',
  'processed_at',
  'review_reason'
].join(', ');

function toDateTime(ts: string | null): string | undefined {
  return ts ? ts.slice(0, 16).replace('T', ' ') : undefined;
}

function nicknameOf(row: PaymentHistoryRow): string {
  return row.profiles?.nickname ?? row.profiles?.display_name ?? row.user_id.slice(0, 8);
}

function productOf(row: PaymentHistoryRow): string {
  return row.subscriptions?.subscription_plans?.name ?? '(미연동)';
}

function mapPaymentRow(row: PaymentHistoryRow): PaymentRow {
  return {
    id: row.id,
    userId: row.user_id,
    userNickname: nicknameOf(row),
    product: productOf(row),
    amount: Math.round((row.amount_cents ?? 0) / 100),
    method: '미확인',
    paidAt: toDate(row.paid_at ?? row.created_at),
    status: PAYMENT_STATUS_MAP[row.status] ?? '완료'
  };
}

function mapRefundRow(row: CommerceRefundRow): RefundRow {
  return {
    id: row.id,
    paymentId: row.payment_id,
    userId: row.user_id,
    userNickname: row.user_nickname,
    requestedAmount: row.requested_amount,
    reason: row.reason,
    status: UI_REFUND_STATUS_BY_DB[row.status] ?? '처리 대기',
    requestedAt: toDateTime(row.requested_at) ?? '',
    processedAt: toDateTime(row.processed_at),
    processedBy: row.processed_by ?? undefined,
    reviewReason: row.review_reason ?? undefined
  };
}

async function loadRefund(refundId: string): Promise<RefundRow> {
  const client = requireClient();
  const { data, error } = await client
    .from('commerce_refunds')
    .select(REFUND_COLUMNS)
    .eq('id', refundId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error('환불 요청을 찾을 수 없습니다.');
  return mapRefundRow(data as unknown as CommerceRefundRow);
}

export async function loadPaymentsFromSupabase(signal?: AbortSignal): Promise<PaymentRow[]> {
  const client = requireClient();
  const { data, error } = await client
    .from('payment_history')
    .select(PAYMENT_SELECT)
    .order('paid_at', { ascending: false });
  if (signal?.aborted) {
    throw new DOMException('Request aborted', 'AbortError');
  }
  if (error) {
    throw new Error(error.message);
  }
  return ((data ?? []) as unknown as PaymentHistoryRow[]).map(mapPaymentRow);
}

export async function loadRefundsFromSupabase(signal?: AbortSignal): Promise<RefundRow[]> {
  const client = requireClient();
  const { data, error } = await client
    .from('commerce_refunds')
    .select(REFUND_COLUMNS)
    .order('requested_at', { ascending: false });
  if (signal?.aborted) {
    throw new DOMException('Request aborted', 'AbortError');
  }
  if (error) {
    throw new Error(error.message);
  }
  return ((data ?? []) as unknown as CommerceRefundRow[]).map(mapRefundRow);
}

export async function approveBillingRefundViaRpc(payload: {
  refundId: string;
  reason: string;
}): Promise<RefundRow> {
  const client = requireClient();
  const { error } = await client.rpc('admin_approve_billing_refund', {
    p_refund_id: payload.refundId,
    p_reason: requireReason(payload.reason)
  });

  if (error) throw new Error(error.message);
  return loadRefund(payload.refundId);
}

export async function rejectBillingRefundViaRpc(payload: {
  refundId: string;
  reason: string;
}): Promise<RefundRow> {
  const client = requireClient();
  const { error } = await client.rpc('admin_reject_billing_refund', {
    p_refund_id: payload.refundId,
    p_reason: requireReason(payload.reason)
  });

  if (error) throw new Error(error.message);
  return loadRefund(payload.refundId);
}
