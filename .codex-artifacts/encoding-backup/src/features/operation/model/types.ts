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
  '?꾨줈紐⑥뀡',
  '異쒖꽍',
  '梨뚮┛吏',
  '由ъ썙??
] as const;

export type OperationEventType = (typeof operationEventTypeValues)[number];

export const operationEventProgressStatusValues = [
  '?덉젙',
  '吏꾪뻾 以?,
  '醫낅즺'
] as const;

export type OperationEventProgressStatus =
  (typeof operationEventProgressStatusValues)[number];

export const operationEventVisibilityStatusValues = [
  '?몄텧',
  '숨김',
  '예약'
] as const;

export type OperationEventVisibilityStatus =
  (typeof operationEventVisibilityStatusValues)[number];

export const operationEventExposureChannelValues = [
  '????,
  '????,
  '?대깽????
] as const;

export type OperationEventExposureChannel =
  (typeof operationEventExposureChannelValues)[number];

export const operationEventBannerSourceTypeValues = ['file'] as const;

export type OperationEventBannerSourceType =
  (typeof operationEventBannerSourceTypeValues)[number];

export type OperationEventBannerImage = {
  uid: string;
  name: string;
  url: string;
};

export const operationEventRewardTypeValues = [
  '?놁쓬',
  '荑좏룿',
  '?ъ씤??,
  '諛곗?'
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
  messageTemplateId: string;
  bannerImages: OperationEventBannerImage[];
  bannerImageUrl: string;
  bannerImageSourceType: OperationEventBannerSourceType;
  bannerImageFileName: string;
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


