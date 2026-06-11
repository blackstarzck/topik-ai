import { create } from 'zustand';

import {
  createInitialBillingPayments,
  createInitialBillingRefunds
} from '../api/mock-billing';
import type { PaymentRow, RefundRow } from './types';

type UpdateRefundPayload = {
  refundId: string;
  changedBy: string;
  reason: string;
};

type CommerceStore = {
  payments: PaymentRow[];
  refunds: RefundRow[];
  approveRefund: (payload: UpdateRefundPayload) => RefundRow | null;
  rejectRefund: (payload: UpdateRefundPayload) => RefundRow | null;
};

function formatNow(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const mi = String(now.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}
export const useCommerceStore = create<CommerceStore>((set, get) => ({
  payments: createInitialBillingPayments(),
  refunds: createInitialBillingRefunds(),
  approveRefund: ({ refundId, changedBy, reason }) => {
    const refund = get().refunds.find((item) => item.id === refundId);
    if (!refund || refund.status !== '처리 대기') {
      return null;
    }

    const processedAt = formatNow();
    const nextRefund: RefundRow = {
      ...refund,
      status: '승인',
      processedAt,
      processedBy: changedBy,
      reviewReason: reason
    };

    set((state) => ({
      refunds: state.refunds.map((item) => (item.id === refundId ? nextRefund : item)),
      payments: state.payments.map((item) =>
        item.id === refund.paymentId ? { ...item, status: '환불' } : item
      )
    }));

    return nextRefund;
  },
  rejectRefund: ({ refundId, changedBy, reason }) => {
    const refund = get().refunds.find((item) => item.id === refundId);
    if (!refund || refund.status !== '처리 대기') {
      return null;
    }

    const processedAt = formatNow();
    const nextRefund: RefundRow = {
      ...refund,
      status: '거절',
      processedAt,
      processedBy: changedBy,
      reviewReason: reason
    };

    set((state) => ({
      refunds: state.refunds.map((item) => (item.id === refundId ? nextRefund : item))
    }));

    return nextRefund;
  }
}));
