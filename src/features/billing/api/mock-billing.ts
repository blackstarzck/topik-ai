import type { PaymentRow, RefundRow } from '../model/types';

const mockBillingPayments: PaymentRow[] = [
  {
    id: 'PAY-1001',
    userId: 'U00001',
    userNickname: 'member_1',
    product: 'TOPIK Premium Monthly',
    amount: 29000,
    method: '카드',
    paidAt: '2026-03-01',
    status: '완료'
  },
  {
    id: 'PAY-1002',
    userId: 'U00008',
    userNickname: 'member_8',
    product: 'TOPIK Mock Test',
    amount: 49000,
    method: '계좌이체',
    paidAt: '2026-02-22',
    status: '환불'
  },
  {
    id: 'PAY-1003',
    userId: 'U00014',
    userNickname: 'member_14',
    product: 'TOPIK Premium Annual',
    amount: 299000,
    method: '간편결제',
    paidAt: '2026-03-06',
    status: '완료'
  },
  {
    id: 'PAY-1004',
    userId: 'U00031',
    userNickname: 'member_31',
    product: '강사 전용 패키지',
    amount: 129000,
    method: '카드',
    paidAt: '2026-03-09',
    status: '취소'
  },
  {
    id: 'PAY-1005',
    userId: 'U00024',
    userNickname: 'member_24',
    product: 'TOPIK 모의고사 패키지',
    amount: 79000,
    method: '카드',
    paidAt: '2026-03-10',
    status: '완료'
  }
];

const mockBillingRefunds: RefundRow[] = [
  {
    id: 'RF-001',
    paymentId: 'PAY-1001',
    userId: 'U00001',
    userNickname: 'member_1',
    requestedAmount: 29000,
    reason: '중복 결제',
    status: '처리 대기',
    requestedAt: '2026-03-04 10:23'
  },
  {
    id: 'RF-002',
    paymentId: 'PAY-1002',
    userId: 'U00008',
    userNickname: 'member_8',
    requestedAmount: 49000,
    reason: '서비스 미이용',
    status: '승인',
    requestedAt: '2026-03-02 08:12',
    processedAt: '2026-03-02 14:40',
    processedBy: 'admin_kim',
    reviewReason: '서비스 미이용 확인 후 승인'
  },
  {
    id: 'RF-003',
    paymentId: 'PAY-1005',
    userId: 'U00024',
    userNickname: 'member_24',
    requestedAmount: 79000,
    reason: '결제 후 상품 변경 요청',
    status: '거절',
    requestedAt: '2026-03-10 09:48',
    processedAt: '2026-03-10 11:05',
    processedBy: 'admin_park',
    reviewReason: '부분 환불 불가 상품'
  }
];


export function createInitialBillingPayments(): PaymentRow[] {
  return mockBillingPayments.map((item) => ({ ...item }));
}

export function createInitialBillingRefunds(): RefundRow[] {
  return mockBillingRefunds.map((item) => ({ ...item }));
}
