export const referralStatuses = ['활성', '비활성] as const;
export const referralAnomalyStatuses = ['?놁쓬', '寃???꾩슂', '寃??완료'] as const;
export const referralRelationStatuses = ['대기, '완료', '취소'] as const;
export const referralRewardStatuses = ['대기, '완료', '취소'] as const;
export const referralRewardEntryTypes = [
  '吏湲?,
  '?뚯닔',
  '취소',
  '?섎룞 蹂댁젙'
] as const;

export type ReferralStatus = (typeof referralStatuses)[number];
export type ReferralAnomalyStatus = (typeof referralAnomalyStatuses)[number];
export type ReferralRelationStatus = (typeof referralRelationStatuses)[number];
export type ReferralRewardStatus = (typeof referralRewardStatuses)[number];
export type ReferralRewardEntryType = (typeof referralRewardEntryTypes)[number];

export type ReferralSearchField = 'all' | 'code' | 'referrerId' | 'referrerName';
export type ReferralSort = 'latest-use';
export type ReferralStatusFilter = 'all' | ReferralStatus;
export type ReferralAnomalyFilter = 'all' | ReferralAnomalyStatus;

export type ReferralQuery = {
  page: number;
  pageSize: number;
  sort: ReferralSort;
  searchField: ReferralSearchField;
  status: ReferralStatusFilter;
  anomalyStatus: ReferralAnomalyFilter;
  startDate: string;
  endDate: string;
  keyword: string;
};

export type ReferralRelation = {
  id: string;
  referredUserId: string;
  referredUserName: string;
  joinedAt: string;
  confirmedAt: string;
  status: ReferralRelationStatus;
  anomalyFlag: string;
  reviewNote: string;
};

export type ReferralRewardLedgerEntry = {
  id: string;
  relationId: string;
  entryType: ReferralRewardEntryType;
  rewardMethodLabel: string;
  amount: number;
  status: ReferralRewardStatus;
  actedAt: string;
  reason: string;
};

export type ReferralPolicySnapshot = {
  version: string;
  confirmationTiming: string;
  rewardMethod: string;
  manualAdjustmentAuthority: string;
  rollbackRule: string;
  note: string;
};

export type ReferralSummary = {
  id: string;
  code: string;
  referrerUserId: string;
  referrerName: string;
  referrerEmail: string;
  createdAt: string;
  expiresAt: string;
  lastUsedAt: string;
  lastActionAt: string;
  status: ReferralStatus;
  anomalyStatus: ReferralAnomalyStatus;
  anomalyFlags: string[];
  referredCount: number;
  confirmedCount: number;
  totalRewardAmount: number;
  adminMemo: string;
  relations: ReferralRelation[];
  rewardLedger: ReferralRewardLedgerEntry[];
  policySnapshot: ReferralPolicySnapshot;
};

