import type { SelectProps } from 'antd';

import type {
  CommerceCoupon,
  CouponApplicableScope,
  CouponAudience,
  CouponAutoIssueTriggerType,
  CouponBenefitType,
  CouponCodeGenerationMode,
  CouponIssueTargetType,
  CouponKind,
  CouponValidityMode
} from './coupon-types';
import {
  getCouponApplicableScopeLabel,
  getCouponAudienceLabel,
  getCouponAutoIssueTriggerLabel,
  getCouponBenefitTypeLabel,
  getCouponIssueTargetTypeLabel,
  getCouponKindLabel,
  getCouponValidityModeLabel
} from './coupon-types';

type CouponDraftDefaults = Pick<
  CommerceCoupon,
  | 'couponKind'
  | 'couponName'
  | 'issueTargetType'
  | 'targetGroupIds'
  | 'targetGroupNames'
  | 'targetUserIds'
  | 'autoIssueTriggerType'
  | 'codeGenerationMode'
  | 'couponCode'
  | 'codeCount'
  | 'audience'
  | 'benefitType'
  | 'benefitValue'
  | 'minOrderAmount'
  | 'maxDiscountAmount'
  | 'applicableScope'
  | 'isStackable'
  | 'isSecretCoupon'
  | 'issueLimitMode'
  | 'issueLimit'
  | 'downloadLimitMode'
  | 'downloadLimit'
  | 'usageLimitMode'
  | 'usageLimit'
  | 'validityMode'
  | 'validFrom'
  | 'validUntil'
  | 'expireAfterDays'
  | 'linkedMessageTemplateId'
  | 'linkedMessageTemplateName'
  | 'linkedCrmCampaignId'
  | 'linkedCrmCampaignName'
  | 'linkedEventId'
  | 'linkedEventName'
  | 'adminMemo'
  | 'issueAlert'
  | 'expireAlert'
>;

export const couponKindCardItems: Array<{
  value: CouponKind;
  title: string;
  description: string;
}> = [
  {
    value: 'customerDownload',
    title: '고객 다운로드',
    description: '시크릿 링크, 장바구니 유도, 쿠폰팩처럼 링크 기반 다운로드 쿠폰을 만듭니다.'
  },
  {
    value: 'autoIssue',
    title: '자동 발행',
    description: '회원가입, 첫 주문 완료, 쇼핑 등급 변경, 생일 트리거에 따라 자동 발행합니다.'
  },
  {
    value: 'couponCode',
    title: '쿠폰 코드 생성',
    description: '단일 또는 여러 개의 쿠폰 코드를 생성하고 결제 단계 입력형으로 운영합니다.'
  },
  {
    value: 'manualIssue',
    title: '지정 발행',
    description: '특정 그룹 또는 특정 회원에게 수동 발행하고 후속 알림을 연결합니다.'
  }
];

export function getCouponKindOptions(): SelectProps['options'] {
  return couponKindCardItems.map((item) => ({
    label: getCouponKindLabel(item.value),
    value: item.value
  }));
}

export function getCouponIssueTargetOptions(): SelectProps['options'] {
  return (['allMembers', 'specificGroup', 'specificMembers'] as const).map(
    (value) => ({
      label: getCouponIssueTargetTypeLabel(value),
      value
    })
  );
}

export function getCouponAutoIssueTriggerOptions(): SelectProps['options'] {
  return (
    [
      'firstSignup',
      'firstOrderComplete',
      'shoppingGradeChange',
      'birthday'
    ] as const
  ).map((value) => ({
    label: getCouponAutoIssueTriggerLabel(value),
    value
  }));
}

export function getCouponBenefitTypeOptions(): SelectProps['options'] {
  return (
    ['amountDiscount', 'rateDiscount', 'freeShipping', 'fixedPrice'] as const
  ).map((value) => ({
    label: getCouponBenefitTypeLabel(value),
    value
  }));
}

export function getCouponScopeOptions(): SelectProps['options'] {
  return (
    ['allProducts', 'specificCategory', 'specificProduct'] as const
  ).map((value) => ({
    label: getCouponApplicableScopeLabel(value),
    value
  }));
}

export function getCouponCodeGenerationOptions(): SelectProps['options'] {
  return (
    ['single', 'bulk'] as const
  ).map((value) => ({
    label: value === 'single' ? '단일 생성' : '여러 개 생성',
    value
  }));
}

export function getCouponAudienceOptions(): SelectProps['options'] {
  return (['memberOnly', 'memberAndGuest'] as const).map((value) => ({
    label: getCouponAudienceLabel(value),
    value
  }));
}

export function getCouponValidityModeOptions(): SelectProps['options'] {
  return (['fixedDate', 'afterIssued', 'unlimited'] as const).map((value) => ({
    label: getCouponValidityModeLabel(value),
    value
  }));
}

export function createCouponDraftDefaults(
  couponKind: CouponKind
): CouponDraftDefaults {
  const sharedDefaults: CouponDraftDefaults = {
    couponKind,
    couponName: '',
    issueTargetType: couponKind === 'couponCode' ? null : 'allMembers',
    targetGroupIds: [],
    targetGroupNames: [],
    targetUserIds: [],
    autoIssueTriggerType: couponKind === 'autoIssue' ? 'firstSignup' : null,
    codeGenerationMode: couponKind === 'couponCode' ? 'single' : null,
    couponCode: '',
    codeCount: couponKind === 'couponCode' ? 1 : null,
    audience: couponKind === 'couponCode' ? 'memberOnly' : null,
    benefitType: 'amountDiscount',
    benefitValue: 1000,
    minOrderAmount: 5000,
    maxDiscountAmount: 10000,
    applicableScope: 'allProducts',
    isStackable: false,
    isSecretCoupon: couponKind === 'customerDownload',
    issueLimitMode: 'unlimited',
    issueLimit: null,
    downloadLimitMode: couponKind === 'customerDownload' ? 'unlimited' : 'unlimited',
    downloadLimit: null,
    usageLimitMode: 'unlimited',
    usageLimit: null,
    validityMode:
      couponKind === 'customerDownload' || couponKind === 'autoIssue'
        ? 'afterIssued'
        : 'fixedDate',
    validFrom: '2026-03-25',
    validUntil: '2026-04-30',
    expireAfterDays:
      couponKind === 'customerDownload' || couponKind === 'autoIssue' ? 30 : null,
    linkedMessageTemplateId: '',
    linkedMessageTemplateName: '',
    linkedCrmCampaignId: '',
    linkedCrmCampaignName: '',
    linkedEventId: '',
    linkedEventName: '',
    adminMemo: '',
    issueAlert: {
      enabled: couponKind !== 'couponCode',
      channel: 'alimtalk',
      templateId: '',
      templateName: '',
      timingLabel: couponKind === 'autoIssue' ? '발급 즉시' : '발급 즉시'
    },
    expireAlert: {
      enabled: couponKind === 'autoIssue' || couponKind === 'manualIssue',
      channel: 'alimtalk',
      templateId: '',
      templateName: '',
      timingLabel: '만료 1일 전'
    }
  };

  if (couponKind === 'manualIssue') {
    return {
      ...sharedDefaults,
      issueTargetType: 'specificGroup',
      validityMode: 'fixedDate',
      expireAfterDays: null
    };
  }

  if (couponKind === 'couponCode') {
    return {
      ...sharedDefaults,
      isSecretCoupon: false,
      issueAlert: {
        enabled: false,
        channel: 'webPush',
        templateId: '',
        templateName: '',
        timingLabel: '사용 안 함'
      },
      expireAlert: {
        enabled: false,
        channel: 'webPush',
        templateId: '',
        templateName: '',
        timingLabel: '사용 안 함'
      }
    };
  }

  return sharedDefaults;
}

export function getCouponPolicyNotes(
  couponKind: CouponKind,
  trigger: CouponAutoIssueTriggerType | null
): string[] {
  if (couponKind === 'customerDownload') {
    return [
      '시크릿 쿠폰은 링크를 받은 회원만 다운로드할 수 있습니다.',
      '쿠폰팩은 고객 다운로드 쿠폰만 묶을 수 있고 최대 10개까지 구성할 수 있습니다.'
    ];
  }

  if (couponKind === 'couponCode') {
    return [
      '단일 생성은 코드를 비워두면 자동 생성되고, 직접 입력한 코드는 저장 후 수정할 수 없습니다.',
      '여러 개 생성은 최대 10,000개까지 자동 생성할 수 있습니다.'
    ];
  }

  if (couponKind === 'manualIssue') {
    return [
      '특정 회원 발행은 유효한 회원 ID만 저장할 수 있습니다.',
      '실회원 대상 발행은 저장 즉시 운영 데이터에 영향을 줄 수 있으므로 사유와 대상 검수가 필요합니다.'
    ];
  }

  if (trigger === 'firstSignup') {
    return [
      '첫 회원가입 자동 발행은 기존 가입 이력 또는 동일 인증정보 재가입 회원에게는 발급되지 않습니다.'
    ];
  }

  if (trigger === 'firstOrderComplete') {
    return [
      '첫 주문 완료 자동 발행은 부분 취소에도 발급될 수 있지만, 주문 전 전체 취소나 동일 정보 재주문은 제외됩니다.',
      '반품·교환 반복 발급 방지 정책은 쇼핑 설정과 함께 검토해야 합니다.'
    ];
  }

  if (trigger === 'shoppingGradeChange') {
    return [
      '쇼핑 등급 변경 자동 발행은 상향/하향 모두 발급될 수 있으므로 등급 변경 정책과 함께 확인해야 합니다.'
    ];
  }

  if (trigger === 'birthday') {
    return [
      '생일 쿠폰은 1년에 한 번만 발급되고, 쿠폰 생성 다음 날부터 발급됩니다.',
      '회원 생년월일이 수집되지 않으면 발급 대상에서 제외됩니다.'
    ];
  }

  return [
    '자동 발행 쿠폰은 발행 트리거와 메시지 템플릿이 함께 검증돼야 운영 혼선을 줄일 수 있습니다.'
  ];
}

export function parseCouponUserIds(rawValue: string): string[] {
  return rawValue
    .split(/[\n,]/)
    .map((value) => value.trim())
    .filter(Boolean);
}

export function serializeCouponUserIds(userIds: string[]): string {
  return userIds.join('\n');
}

export function normalizeCouponScope(
  scope: CouponApplicableScope
): CouponApplicableScope {
  return scope;
}

export function normalizeCouponIssueTargetType(
  value: CouponIssueTargetType
): CouponIssueTargetType {
  return value;
}

export function normalizeCouponBenefitType(
  value: CouponBenefitType
): CouponBenefitType {
  return value;
}

export function normalizeCouponCodeGenerationMode(
  value: CouponCodeGenerationMode
): CouponCodeGenerationMode {
  return value;
}

export function normalizeCouponAudience(value: CouponAudience): CouponAudience {
  return value;
}

export function normalizeCouponValidityMode(
  value: CouponValidityMode
): CouponValidityMode {
  return value;
}
