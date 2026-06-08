import { toSafeResult, withRetry } from '../../../shared/api/safe-request';
import { isSupabaseConfigured } from '../../../shared/api/supabase-client';
import { useCommerceStore } from '../model/commerce-store';
import type { PaymentRow, RefundRow } from '../model/commerce-store';
import { loadPaymentsFromSupabase, loadRefundsFromSupabase } from './supabase-billing-service';

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

export function fetchPaymentsSafe(signal?: AbortSignal) {
  return toSafeResult(() => withRetry(() => loadPayments(signal), { maxRetries: 1 }));
}

export function fetchRefundsSafe(signal?: AbortSignal) {
  return toSafeResult(() => withRetry(() => loadRefunds(signal), { maxRetries: 1 }));
}
