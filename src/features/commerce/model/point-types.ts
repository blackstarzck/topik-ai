export const pointPolicyStatuses = ['초안', '운영 중', '중지'] as const;
export const pointPolicyTypes = ['적립', '차감', '소멸'] as const;
export const pointLedgerTypes = ['적립', '차감', '회수', '복구', '소멸'] as const;
export const pointLedgerSourceTypes = [
  '추천',
  '미션',
  '이벤트',
  '결제',
  '환불',
  '관리자',
  '시스템'
] as const;
export const pointLedgerStatuses = ['완료', '보류', '취소'] as const;
export const pointExpirationStatuses = ['예정', '보류', '완료', '취소'] as const;

export type PointPolicyStatus = (typeof pointPolicyStatuses)[number];
export type PointPolicyType = (typeof pointPolicyTypes)[number];
export type PointLedgerType = (typeof pointLedgerTypes)[number];
export type PointLedgerSourceType = (typeof pointLedgerSourceTypes)[number];
export type PointLedgerStatus = (typeof pointLedgerStatuses)[number];
export type PointExpirationStatus = (typeof pointExpirationStatuses)[number];

export type PointsTab = 'policy' | 'ledger' | 'expiration';

export type PointPolicySearchField = 'name' | 'id';
export type PointLedgerSearchField = 'userId' | 'userName' | 'id';
export type PointExpirationSearchField = 'userId' | 'userName' | 'id';
export type PointSortOrder = 'ascend' | 'descend' | null;

export type PointPolicySortField = 'name' | 'policyType' | 'status' | 'updatedAt';
export type PointLedgerSortField =
  | 'occurredAt'
  | 'ledgerType'
  | 'sourceType'
  | 'pointDelta'
  | 'expirationAt'
  | 'status';
export type PointExpirationSortField =
  | 'scheduledAt'
  | 'sourceType'
  | 'expiringPoint'
  | 'availablePoint'
  | 'status';

export type PointPolicyStatusFilter = 'all' | PointPolicyStatus;
export type PointPolicyTypeFilter = 'all' | PointPolicyType;
export type PointLedgerTypeFilter = 'all' | PointLedgerType;
export type PointLedgerSourceTypeFilter = 'all' | PointLedgerSourceType;
export type PointLedgerStatusFilter = 'all' | PointLedgerStatus;
export type PointExpirationStatusFilter = 'all' | PointExpirationStatus;

export type PointPolicy = {
  id: string;
  name: string;
  policyType: PointPolicyType;
  conditionSummary: string;
  earnDebitRule: string;
  expirationRule: string;
  status: PointPolicyStatus;
  updatedAt: string;
  updatedBy: string;
  targetCondition: string;
  triggerSource: string;
  duplicationRule: string;
  manualAdjustmentRule: string;
  note: string;
};

export type PointLedger = {
  id: string;
  occurredAt: string;
  userId: string;
  userName: string;
  ledgerType: PointLedgerType;
  sourceType: PointLedgerSourceType;
  pointDelta: number;
  balanceAfter: number;
  availableBalanceAfter: number;
  status: PointLedgerStatus;
  expirationAt: string;
  sourceId: string;
  sourceLabel: string;
  policyId: string;
  policyName: string;
  reason: string;
  approvalMemo: string;
  actedBy: string;
};

export type PointExpiration = {
  id: string;
  scheduledAt: string;
  userId: string;
  userName: string;
  sourceType: PointLedgerSourceType;
  expiringPoint: number;
  availablePoint: number;
  status: PointExpirationStatus;
  holdReason: string;
  heldBy: string;
  processedAt: string;
  relatedLedgerId: string;
  policyId: string;
  policyName: string;
  calculationMemo: string;
};

export type CommercePointsSnapshot = {
  policies: PointPolicy[];
  ledgers: PointLedger[];
  expirations: PointExpiration[];
};

export type PointPolicyQuery = {
  page: number;
  pageSize: number;
  searchField: PointPolicySearchField;
  keyword: string;
  status: PointPolicyStatusFilter;
  type: PointPolicyTypeFilter;
  sortField: PointPolicySortField | null;
  sortOrder: PointSortOrder;
};

export type PointLedgerQuery = {
  page: number;
  pageSize: number;
  searchField: PointLedgerSearchField;
  keyword: string;
  type: PointLedgerTypeFilter;
  sourceType: PointLedgerSourceTypeFilter;
  status: PointLedgerStatusFilter;
  startDate: string;
  endDate: string;
  sortField: PointLedgerSortField | null;
  sortOrder: PointSortOrder;
};

export type PointExpirationQuery = {
  page: number;
  pageSize: number;
  searchField: PointExpirationSearchField;
  keyword: string;
  status: PointExpirationStatusFilter;
  startDate: string;
  endDate: string;
  sortField: PointExpirationSortField | null;
  sortOrder: PointSortOrder;
};

export type CommercePointsQuery = {
  tab: PointsTab;
  selectedId: string;
  policy: PointPolicyQuery;
  ledger: PointLedgerQuery;
  expiration: PointExpirationQuery;
};
