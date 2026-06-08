import { supabaseClient } from '../../../shared/api/supabase-client';
import type { PaymentRow, PaymentStatus, RefundRow } from '../model/commerce-store';

/**
 * Phase D (payments) — READ-ONLY inventory from v13 billing tables.
 *
 * payment_history / subscriptions are admin-readable directly under RLS
 * (private.is_platform_admin), so no RPC is needed — the platform_admin session
 * selects them. v13 is the schema SoT; topik-ai reconciles TO it. There is NO
 * write path here (refund approve/reject is disabled when connected).
 *
 * Mappings are PROPOSED (R2) and several are genuine owner-decisions (ch3 §F3):
 *  - method: v13 payment_history has NO payment-method column -> '미확인'.
 *  - product: derived from the linked subscription's plan name, else '(미연동)'.
 *  - status: topik-ai has only 완료/취소/환불 (3) but v13 has paid/failed/refunded/
 *    pending (4); failed AND pending both collapse to 취소 (lossy — owner decision).
 *  - refund: v13 has NO refund entity; an approved refund == payment_history.status
 *    ='refunded'. We synthesize a read-only RefundRow (status 승인) from such rows;
 *    topik-ai's 처리 대기/거절 workflow states have no v13 source.
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

const PAYMENT_STATUS_MAP: Record<string, PaymentStatus> = {
  paid: '완료',
  refunded: '환불',
  failed: '취소',
  pending: '취소'
};

const PAYMENT_SELECT =
  'id, user_id, subscription_id, amount_cents, currency, status, paid_at, created_at, ' +
  'profiles(display_name, nickname), subscriptions(plan_key, subscription_plans(name))';

function toDate(ts: string | null): string {
  return ts ? ts.slice(0, 10) : '';
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

export async function loadPaymentsFromSupabase(signal?: AbortSignal): Promise<PaymentRow[]> {
  if (!supabaseClient) {
    throw new Error('Supabase client not configured');
  }
  const { data, error } = await supabaseClient
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
  if (!supabaseClient) {
    throw new Error('Supabase client not configured');
  }
  // v13 has no refund entity: an approved refund is a payment with status='refunded'.
  const { data, error } = await supabaseClient
    .from('payment_history')
    .select(PAYMENT_SELECT)
    .eq('status', 'refunded')
    .order('created_at', { ascending: false });
  if (signal?.aborted) {
    throw new DOMException('Request aborted', 'AbortError');
  }
  if (error) {
    throw new Error(error.message);
  }
  return ((data ?? []) as unknown as PaymentHistoryRow[]).map((row) => ({
    id: row.id,
    paymentId: row.id,
    userId: row.user_id,
    userNickname: nicknameOf(row),
    requestedAmount: Math.round((row.amount_cents ?? 0) / 100),
    reason: '(결제 환불)',
    status: '승인',
    requestedAt: toDate(row.created_at),
    processedAt: toDate(row.created_at),
    processedBy: '(시스템)',
    reviewReason: undefined
  }));
}
