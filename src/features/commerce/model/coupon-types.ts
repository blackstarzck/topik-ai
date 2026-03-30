export const couponMainViewValues = ['list', 'subscriptionTemplate'] as const;
export type CouponMainView = (typeof couponMainViewValues)[number];

export const couponStatusTabValues = ['all', 'waiting', 'active', 'ended'] as const;
export type CouponStatusTab = (typeof couponStatusTabValues)[number];

export const couponKindValues = [
  'customerDownload',
  'autoIssue',
  'couponCode',
  'manualIssue'
] as const;
export type CouponKind = (typeof couponKindValues)[number];

export const couponStatusValues = ['대기', '진행 중', '종료'] as const;
export type CouponStatus = (typeof couponStatusValues)[number];

export const couponIssueStateValues = ['정상', '발행 중지'] as const;
export type CouponIssueState = (typeof couponIssueStateValues)[number];

export const couponBenefitTypeValues = [
  'amountDiscount',
  'rateDiscount',
  'freeShipping',
  'fixedPrice'
] as const;
export type CouponBenefitType = (typeof couponBenefitTypeValues)[number];

export const couponIssueTargetTypeValues = [
  'allMembers',
  'specificGroup',
  'specificMembers'
] as const;
export type CouponIssueTargetType = (typeof couponIssueTargetTypeValues)[number];

export const couponAutoIssueTriggerTypeValues = [
  'firstSignup',
  'firstOrderComplete',
  'shoppingGradeChange',
  'birthday'
] as const;
export type CouponAutoIssueTriggerType =
  (typeof couponAutoIssueTriggerTypeValues)[number];

export const couponCodeGenerationModeValues = ['single', 'bulk'] as const;
export type CouponCodeGenerationMode =
  (typeof couponCodeGenerationModeValues)[number];

export const couponAudienceValues = [
  'memberOnly',
  'memberAndGuest'
] as const;
export type CouponAudience = (typeof couponAudienceValues)[number];

export const couponApplicableScopeValues = [
  'allProducts',
  'specificCategory',
  'specificProduct'
] as const;
export type CouponApplicableScope =
  (typeof couponApplicableScopeValues)[number];

export const couponValidityModeValues = [
  'fixedDate',
  'afterIssued',
  'unlimited'
] as const;
export type CouponValidityMode = (typeof couponValidityModeValues)[number];

export const couponLimitModeValues = ['unlimited', 'limited'] as const;
export type CouponLimitMode = (typeof couponLimitModeValues)[number];

export const couponAlertChannelValues = ['alimtalk', 'webPush'] as const;
export type CouponAlertChannel = (typeof couponAlertChannelValues)[number];

export type CouponAlertSetting = {
  enabled: boolean;
  channel: CouponAlertChannel;
  templateId: string;
  templateName: string;
  timingLabel: string;
};

export type CommerceCoupon = {
  id: string;
  couponName: string;
  couponKind: CouponKind;
  couponStatus: CouponStatus;
  issueState: CouponIssueState;
  issueTargetType: CouponIssueTargetType | null;
  targetGroupIds: string[];
  targetGroupNames: string[];
  targetUserIds: string[];
  autoIssueTriggerType: CouponAutoIssueTriggerType | null;
  codeGenerationMode: CouponCodeGenerationMode | null;
  couponCode: string;
  codeCount: number | null;
  audience: CouponAudience | null;
  benefitType: CouponBenefitType;
  benefitValue: number;
  minOrderAmount: number;
  maxDiscountAmount: number | null;
  applicableScope: CouponApplicableScope;
  isStackable: boolean;
  isSecretCoupon: boolean;
  issueLimitMode: CouponLimitMode;
  issueLimit: number | null;
  downloadLimitMode: CouponLimitMode;
  downloadLimit: number | null;
  usageLimitMode: CouponLimitMode;
  usageLimit: number | null;
  validityMode: CouponValidityMode;
  validFrom: string;
  validUntil: string;
  expireAfterDays: number | null;
  linkedMessageTemplateId: string;
  linkedMessageTemplateName: string;
  linkedCrmCampaignId: string;
  linkedCrmCampaignName: string;
  linkedEventId: string;
  linkedEventName: string;
  downloadUrl: string;
  issueCount: number;
  downloadCount: number;
  useCount: number;
  lastIssuedAt: string;
  lastDownloadedAt: string;
  lastUsedAt: string;
  policyNotes: string[];
  adminMemo: string;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
  issueAlert: CouponAlertSetting;
  expireAlert: CouponAlertSetting;
};

export type CouponSummaryMetric = {
  label: string;
  value: number;
};

const couponKindLabelMap: Record<CouponKind, string> = {
  customerDownload: '고객 다운로드',
  autoIssue: '자동 발행',
  couponCode: '쿠폰 코드 생성',
  manualIssue: '지정 발행'
};

const couponBenefitTypeLabelMap: Record<CouponBenefitType, string> = {
  amountDiscount: '금액 할인',
  rateDiscount: '비율 할인',
  freeShipping: '배송비 무료',
  fixedPrice: '고정가 할인'
};

const couponIssueTargetTypeLabelMap: Record<CouponIssueTargetType, string> = {
  allMembers: '전체 회원',
  specificGroup: '특정 그룹',
  specificMembers: '특정 회원'
};

const couponAutoIssueTriggerLabelMap: Record<CouponAutoIssueTriggerType, string> = {
  firstSignup: '첫 회원가입',
  firstOrderComplete: '첫 주문 완료',
  shoppingGradeChange: '쇼핑 등급 변경',
  birthday: '생일'
};

const couponAudienceLabelMap: Record<CouponAudience, string> = {
  memberOnly: '회원',
  memberAndGuest: '회원 및 비회원'
};

const couponApplicableScopeLabelMap: Record<CouponApplicableScope, string> = {
  allProducts: '전체 상품',
  specificCategory: '특정 카테고리',
  specificProduct: '특정 상품'
};

const couponValidityModeLabelMap: Record<CouponValidityMode, string> = {
  fixedDate: '사용 기한 설정',
  afterIssued: '발급 후 N일 만료',
  unlimited: '제한 없음'
};

const couponAlertChannelLabelMap: Record<CouponAlertChannel, string> = {
  alimtalk: '알림톡',
  webPush: '웹·앱 푸시'
};

export function getCouponKindLabel(couponKind: CouponKind): string {
  return couponKindLabelMap[couponKind];
}

export function getCouponBenefitTypeLabel(benefitType: CouponBenefitType): string {
  return couponBenefitTypeLabelMap[benefitType];
}

export function getCouponIssueTargetTypeLabel(
  issueTargetType: CouponIssueTargetType
): string {
  return couponIssueTargetTypeLabelMap[issueTargetType];
}

export function getCouponAutoIssueTriggerLabel(
  trigger: CouponAutoIssueTriggerType
): string {
  return couponAutoIssueTriggerLabelMap[trigger];
}

export function getCouponAudienceLabel(audience: CouponAudience): string {
  return couponAudienceLabelMap[audience];
}

export function getCouponApplicableScopeLabel(scope: CouponApplicableScope): string {
  return couponApplicableScopeLabelMap[scope];
}

export function getCouponValidityModeLabel(mode: CouponValidityMode): string {
  return couponValidityModeLabelMap[mode];
}

export function getCouponAlertChannelLabel(channel: CouponAlertChannel): string {
  return couponAlertChannelLabelMap[channel];
}

export function formatCouponCurrency(value: number): string {
  return `${value.toLocaleString('ko-KR')}원`;
}

export function getCouponKindDisplayLabel(coupon: CommerceCoupon): string {
  if (coupon.couponKind !== 'couponCode') {
    return getCouponKindLabel(coupon.couponKind);
  }

  if (coupon.codeGenerationMode === 'bulk') {
    return '쿠폰코드(여러 개)';
  }

  return '쿠폰코드(단일)';
}

export function getCouponIssueSummary(coupon: CommerceCoupon): string {
  if (coupon.couponKind === 'autoIssue' && coupon.autoIssueTriggerType) {
    return getCouponAutoIssueTriggerLabel(coupon.autoIssueTriggerType);
  }

  if (coupon.couponKind === 'couponCode') {
    return coupon.audience ? getCouponAudienceLabel(coupon.audience) : '-';
  }

  if (!coupon.issueTargetType) {
    return '-';
  }

  if (coupon.issueTargetType === 'specificGroup') {
    return coupon.targetGroupNames.length > 0
      ? `${getCouponIssueTargetTypeLabel(coupon.issueTargetType)} · ${coupon.targetGroupNames.join(', ')}`
      : getCouponIssueTargetTypeLabel(coupon.issueTargetType);
  }

  if (coupon.issueTargetType === 'specificMembers') {
    return `${getCouponIssueTargetTypeLabel(coupon.issueTargetType)} · ${coupon.targetUserIds.length.toLocaleString()}명`;
  }

  return getCouponIssueTargetTypeLabel(coupon.issueTargetType);
}

export function getCouponBenefitSummary(coupon: CommerceCoupon): string {
  if (coupon.benefitType === 'amountDiscount') {
    return `금액 할인 ${formatCouponCurrency(coupon.benefitValue)}`;
  }

  if (coupon.benefitType === 'rateDiscount') {
    const maxDiscountText = coupon.maxDiscountAmount
      ? ` · 최대 ${formatCouponCurrency(coupon.maxDiscountAmount)}`
      : '';
    return `비율 할인 ${coupon.benefitValue}%${maxDiscountText}`;
  }

  if (coupon.benefitType === 'fixedPrice') {
    return `고정가 할인 ${formatCouponCurrency(coupon.benefitValue)}`;
  }

  return '배송비 무료';
}

export function getCouponConditionSummary(coupon: CommerceCoupon): string {
  const scopeLabel = getCouponApplicableScopeLabel(coupon.applicableScope);
  const stackableLabel = coupon.isStackable ? '중복 허용' : '중복 불가';
  return `${formatCouponCurrency(coupon.minOrderAmount)} 이상 · ${scopeLabel} · ${stackableLabel}`;
}

export function getCouponValiditySummary(coupon: CommerceCoupon): string {
  if (coupon.validityMode === 'afterIssued' && coupon.expireAfterDays) {
    return `발급 후 ${coupon.expireAfterDays}일`;
  }

  if (coupon.validityMode === 'unlimited') {
    return '제한 없음';
  }

  return `${coupon.validFrom} ~ ${coupon.validUntil}`;
}

export function getCouponLinkageSummary(coupon: CommerceCoupon): string {
  if (coupon.linkedMessageTemplateName && coupon.linkedCrmCampaignName) {
    return `${coupon.linkedMessageTemplateName} · ${coupon.linkedCrmCampaignName}`;
  }

  if (coupon.linkedMessageTemplateName) {
    return coupon.linkedMessageTemplateName;
  }

  if (coupon.linkedCrmCampaignName) {
    return coupon.linkedCrmCampaignName;
  }

  return '미연동';
}

export function getCouponAlertSummary(alert: CouponAlertSetting): string {
  if (!alert.enabled) {
    return '사용 안 함';
  }

  return `${getCouponAlertChannelLabel(alert.channel)} · ${alert.timingLabel}`;
}
