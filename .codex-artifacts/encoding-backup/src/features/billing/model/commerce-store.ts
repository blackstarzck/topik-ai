import { create } from 'zustand';

export type PaymentStatus = '완료' | '취소' | '환불';
export type PaymentMethod = '移대뱶' | '怨꾩쥖?댁껜' | '媛꾪렪결제';
export type RefundStatus = '泥섎━ 대기 | '?뱀씤' | '嫄곗젅';

export type PaymentRow = {
  id: string;
  userId: string;
  userNickname: string;
  product: string;
  amount: number;
  method: PaymentMethod;
  paidAt: string;
  status: PaymentStatus;
};

export type RefundRow = {
  id: string;
  paymentId: string;
  userId: string;
  userNickname: string;
  requestedAmount: number;
  reason: string;
  status: RefundStatus;
  requestedAt: string;
  processedAt?: string;
  processedBy?: string;
  reviewReason?: string;
};

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

const initialPayments: PaymentRow[] = [
  {
    id: 'PAY-1001',
    userId: 'U00001',
    userNickname: 'member_1',
    product: 'TOPIK Premium Monthly',
    amount: 29000,
    method: '移대뱶',
    paidAt: '2026-03-01',
    status: '완료'
  },
  {
    id: 'PAY-1002',
    userId: 'U00008',
    userNickname: 'member_8',
    product: 'TOPIK Mock Test',
    amount: 49000,
    method: '怨꾩쥖?댁껜',
    paidAt: '2026-02-22',
    status: '환불'
  },
  {
    id: 'PAY-1003',
    userId: 'U00014',
    userNickname: 'member_14',
    product: 'TOPIK Premium Annual',
    amount: 299000,
    method: '媛꾪렪결제',
    paidAt: '2026-03-06',
    status: '완료'
  },
  {
    id: 'PAY-1004',
    userId: 'U00031',
    userNickname: 'member_31',
    product: '媛뺤궗 ?꾩슜 ?⑦궎吏',
    amount: 129000,
    method: '移대뱶',
    paidAt: '2026-03-09',
    status: '취소'
  },
  {
    id: 'PAY-1005',
    userId: 'U00024',
    userNickname: 'member_24',
    product: 'TOPIK 紐⑥쓽怨좎궗 ?⑦궎吏',
    amount: 79000,
    method: '移대뱶',
    paidAt: '2026-03-10',
    status: '완료'
  }
];

const initialRefunds: RefundRow[] = [
  {
    id: 'RF-001',
    paymentId: 'PAY-1001',
    userId: 'U00001',
    userNickname: 'member_1',
    requestedAmount: 29000,
    reason: '以묐났 결제',
    status: '泥섎━ 대기,
    requestedAt: '2026-03-04 10:23'
  },
  {
    id: 'RF-002',
    paymentId: 'PAY-1002',
    userId: 'U00008',
    userNickname: 'member_8',
    requestedAmount: 49000,
    reason: '?쒕퉬??誘몄씠??,
    status: '?뱀씤',
    requestedAt: '2026-03-02 08:12',
    processedAt: '2026-03-02 14:40',
    processedBy: 'admin_kim',
    reviewReason: '?쒕퉬??誘몄씠???뺤씤 ???뱀씤'
  },
  {
    id: 'RF-003',
    paymentId: 'PAY-1005',
    userId: 'U00024',
    userNickname: 'member_24',
    requestedAmount: 79000,
    reason: '결제 ??상품 蹂寃??붿껌',
    status: '嫄곗젅',
    requestedAt: '2026-03-10 09:48',
    processedAt: '2026-03-10 11:05',
    processedBy: 'admin_park',
    reviewReason: '遺遺?환불 遺덇? 상품'
  }
];

export const useCommerceStore = create<CommerceStore>((set, get) => ({
  payments: initialPayments,
  refunds: initialRefunds,
  approveRefund: ({ refundId, changedBy, reason }) => {
    const refund = get().refunds.find((item) => item.id === refundId);
    if (!refund || refund.status !== '泥섎━ 대기) {
      return null;
    }

    const processedAt = formatNow();
    const nextRefund: RefundRow = {
      ...refund,
      status: '?뱀씤',
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
    if (!refund || refund.status !== '泥섎━ 대기) {
      return null;
    }

    const processedAt = formatNow();
    const nextRefund: RefundRow = {
      ...refund,
      status: '嫄곗젅',
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


