import type {
  OperationFaqCategory,
  OperationFaqCurationMode,
  OperationFaqCurationStatus,
  OperationFaqExposureSurface,
  OperationFaqStatus
} from './faq-schema';

export type {
  OperationFaqCategory,
  OperationFaqCurationMode,
  OperationFaqCurationStatus,
  OperationFaqExposureSurface,
  OperationFaqStatus
} from './faq-schema';

export type OperationNoticeStatus = '게시' | '숨김';

export type OperationNotice = {
  id: string;
  title: string;
  author: string;
  createdAt: string;
  status: OperationNoticeStatus;
  bodyHtml: string;
  updatedAt: string;
  updatedBy: string;
};

export type OperationFaq = {
  id: string;
  question: string;
  answer: string;
  searchKeywords: string[];
  category: OperationFaqCategory;
  status: OperationFaqStatus;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
};

export type OperationFaqCuration = {
  id: string;
  faqId: string;
  surface: OperationFaqExposureSurface;
  curationMode: OperationFaqCurationMode;
  displayRank: number;
  exposureStatus: OperationFaqCurationStatus;
  pinnedStartAt: string | null;
  pinnedEndAt: string | null;
  updatedAt: string;
  updatedBy: string;
};

export type OperationFaqMetric = {
  faqId: string;
  viewCount: number;
  searchHitCount: number;
  helpfulCount: number;
  notHelpfulCount: number;
  lastViewedAt: string | null;
};

export const operationEventTypeValues = [
  '프로모션',
  '출석',
  '챌린지',
  '리워드'
] as const;

export type OperationEventType = (typeof operationEventTypeValues)[number];

export const operationEventProgressStatusValues = [
  '예정',
  '진행 중',
  '종료'
] as const;

export type OperationEventProgressStatus =
  (typeof operationEventProgressStatusValues)[number];

export const operationEventVisibilityStatusValues = [
  '노출',
  '숨김',
  '예약'
] as const;

export type OperationEventVisibilityStatus =
  (typeof operationEventVisibilityStatusValues)[number];

export const operationEventExposureChannelValues = [
  '앱 홈',
  '웹 홈',
  '이벤트 탭'
] as const;

export type OperationEventExposureChannel =
  (typeof operationEventExposureChannelValues)[number];

export const operationEventRewardTypeValues = [
  '없음',
  '쿠폰',
  '포인트',
  '배지'
] as const;

export type OperationEventRewardType =
  (typeof operationEventRewardTypeValues)[number];

export const operationEventIndexingPolicyValues = [
  'index',
  'noindex'
] as const;

export type OperationEventIndexingPolicy =
  (typeof operationEventIndexingPolicyValues)[number];

export type OperationEvent = {
  id: string;
  title: string;
  summary: string;
  bodyHtml: string;
  slug: string;
  eventType: OperationEventType;
  progressStatus: OperationEventProgressStatus;
  visibilityStatus: OperationEventVisibilityStatus;
  startAt: string;
  endAt: string;
  exposureChannels: OperationEventExposureChannel[];
  targetGroupId: string;
  targetGroupName: string;
  participantCount: number;
  participantLimit: number | null;
  rewardType: OperationEventRewardType;
  rewardPolicyId: string;
  rewardPolicyName: string;
  rewardPolicySummary: string;
  bannerImageUrl: string;
  landingUrl: string;
  messageTemplateName: string;
  metaTitle: string;
  metaDescription: string;
  ogImageUrl: string;
  canonicalUrl: string;
  indexingPolicy: OperationEventIndexingPolicy;
  adminMemo: string;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
};
