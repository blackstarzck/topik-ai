import { create } from 'zustand';

import {
  createInitialBillingPayments,
  createInitialBillingRefunds
} from '../api/mock-billing';
import type { PaymentRow, RefundRow } from './types';
import { formatNowMinutes as formatNow } from '@/shared/model/date-format';

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
