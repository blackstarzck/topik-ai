export type PaymentStatus = string;
export type PaymentMethod = string;
export type RefundStatus = string;

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
