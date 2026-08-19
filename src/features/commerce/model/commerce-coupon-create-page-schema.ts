import dayjs, { type Dayjs } from "dayjs";

import type { CommerceCoupon, CouponKind, CouponValidityMode } from "./coupon-types";

// 쿠폰 등록/수정 화면의 순수 스키마 — Phase 4 분해로 페이지 본문에서 이동(동작 동일).
// 폼 인스턴스·조회 상태·제출 로직은 페이지가 소유한다.

export type CouponFormValues = {
  couponName: string;
  issueTargetType: CommerceCoupon["issueTargetType"];
  targetGroupId: string;
  targetUserIdsText: string;
  autoIssueTriggerType: CommerceCoupon["autoIssueTriggerType"];
  codeGenerationMode: CommerceCoupon["codeGenerationMode"];
  couponCode: string;
  codeCount: number | null;
  audience: CommerceCoupon["audience"];
  benefitType: CommerceCoupon["benefitType"];
  benefitValue: number;
  minOrderAmount: number;
  maxDiscountAmount: number | null;
  applicableScope: CommerceCoupon["applicableScope"];
  isStackable: boolean;
  isSecretCoupon: boolean;
  issueLimitMode: CommerceCoupon["issueLimitMode"];
  issueLimit: number | null;
  downloadLimitMode: CommerceCoupon["downloadLimitMode"];
  downloadLimit: number | null;
  usageLimitMode: CommerceCoupon["usageLimitMode"];
  usageLimit: number | null;
  validityMode: CommerceCoupon["validityMode"];
  validityRange: [Dayjs, Dayjs];
  expireAfterDays: number | null;
  linkedMessageTemplateId: string;
  linkedCrmCampaignId: string;
  linkedEventId: string;
  issueAlertEnabled: boolean;
  issueAlertChannel: CommerceCoupon["issueAlert"]["channel"];
  expireAlertEnabled: boolean;
  expireAlertChannel: CommerceCoupon["expireAlert"]["channel"];
  adminMemo: string;
};

export type CouponKindMeta = {
  description: string;
  examples: string[];
  basicDescription: string;
  operationsDescription: string;
  alertDescription: string | null;
};

export const couponKindMetaMap: Record<CouponKind, CouponKindMeta> = {
  customerDownload: {
    description: "고객이 직접 다운로드해서 사용하는 일반 쿠폰을 설정합니다.",
    examples: ["장바구니 쿠폰", "이벤트 쿠폰", "채널 친구 추가 쿠폰"],
    basicDescription:
      "쿠폰명, 발행 대상, 쿠폰 수량과 시크릿 쿠폰 정책을 설정합니다.",
    operationsDescription: "사용 기간, 발급 후 만료, 사용 횟수를 설정합니다.",
    alertDescription: "발급 알림과 만료 알림, 미리보기 위치를 정리합니다.",
  },
  autoIssue: {
    description: "조건을 만족한 고객에게 자동으로 발행되는 쿠폰을 설정합니다.",
    examples: [
      "신규 회원 웰컴 쿠폰",
      "생일 쿠폰",
      "첫 구매 쿠폰",
      "쇼핑 적립금 쿠폰",
    ],
    basicDescription: "자동 발행 트리거와 기본 쿠폰명을 설정합니다.",
    operationsDescription:
      "발급 후 만료 또는 무기한 정책과 사용 횟수를 설정합니다.",
    alertDescription: "발급 알림, 만료 알림, CRM 연동 위치를 안내합니다.",
  },
  couponCode: {
    description: "코드를 입력해 사용하는 쿠폰을 발행합니다.",
    examples: ["오프라인 쿠폰", "시크릿 코드 쿠폰"],
    basicDescription:
      "대상 범위, 단일 또는 복수 코드 생성, 입력 정책을 설정합니다.",
    operationsDescription: "고정 사용 기간과 사용 횟수를 설정합니다.",
    alertDescription: null,
  },
  manualIssue: {
    description:
      "특정 그룹 또는 특정 회원에게 직접 발행하는 쿠폰을 설정합니다.",
    examples: ["정기 멤버십 혜택", "재구매 유도 쿠폰"],
    basicDescription:
      "발행 대상을 전체 회원, 특정 그룹, 특정 회원으로 나누어 설정합니다.",
    operationsDescription: "사용 시작일과 종료일을 고정 기간으로 설정합니다.",
    alertDescription:
      "푸시 알림 발송 영역은 구조만 맞추고 후속 연동은 placeholder로 둡니다.",
  },
};

export function parseCouponKind(value: string | null): CouponKind {
  if (
    value === "autoIssue" ||
    value === "couponCode" ||
    value === "manualIssue"
  ) {
    return value;
  }

  return "customerDownload";
}

export function createDefaultValidityRange(): [Dayjs, Dayjs] {
  return [dayjs().startOf("day"), dayjs().add(30, "day").startOf("day")];
}

export function resolveCouponStatus(
  validityMode: CouponFormValues["validityMode"],
  validityRange: CouponFormValues["validityRange"],
): CommerceCoupon["couponStatus"] {
  if (validityMode !== "fixedDate") {
    return "진행 중";
  }

  const today = dayjs().startOf("day");

  if (today.isBefore(validityRange[0], "day")) {
    return "대기";
  }

  if (today.isAfter(validityRange[1], "day")) {
    return "종료";
  }

  return "진행 중";
}

export function getAllowedValidityModes(couponKind: CouponKind): CouponValidityMode[] {
  if (couponKind === "customerDownload") {
    return ["fixedDate", "afterIssued", "unlimited"];
  }

  if (couponKind === "autoIssue") {
    return ["afterIssued", "unlimited"];
  }

  if (couponKind === "couponCode") {
    return ["fixedDate", "unlimited"];
  }

  return ["fixedDate"];
}

export type CouponCreateSectionKey =
  | "basic"
  | "benefit"
  | "operation"
  | "alert"
  | "memo";

export const couponCreateSectionMeta: Record<
  CouponCreateSectionKey,
  { title: string; description: string }
> = {
  basic: {
    title: "기본 정보",
    description: "쿠폰명과 발행 대상, 발행 수량 정책을 설정합니다.",
  },
  benefit: {
    title: "혜택 설정",
    description: "할인 방식과 최소 주문 조건, 적용 범위를 설정합니다.",
  },
  operation: {
    title: "운영 설정",
    description: "사용 기한과 만료 조건, 사용 횟수를 설정합니다.",
  },
  alert: {
    title: "알림 설정",
    description: "발급 및 만료 알림, CRM 연동 구조를 정리합니다.",
  },
  memo: {
    title: "관리자 메모",
    description: "운영 검토 메모와 내부 공유 사항을 기록합니다.",
  },
};

export const couponCreateStepFieldMap: Record<
  CouponCreateSectionKey,
  Array<keyof CouponFormValues>
> = {
  basic: [
    "couponName",
    "autoIssueTriggerType",
    "audience",
    "codeGenerationMode",
    "codeCount",
    "issueTargetType",
    "targetGroupId",
    "issueLimitMode",
    "issueLimit",
  ],
  benefit: ["benefitType", "benefitValue", "minOrderAmount", "applicableScope"],
  operation: [
    "validityMode",
    "validityRange",
    "expireAfterDays",
    "usageLimitMode",
    "usageLimit",
  ],
  alert: [
    "issueAlertEnabled",
    "issueAlertChannel",
    "expireAlertEnabled",
    "expireAlertChannel",
    "linkedMessageTemplateId",
    "linkedCrmCampaignId",
  ],
  memo: ["adminMemo"],
};

export function hasValidCouponDateRange(
  value: Partial<CouponFormValues>["validityRange"],
): value is [Dayjs, Dayjs] {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    dayjs.isDayjs(value[0]) &&
    dayjs.isDayjs(value[1])
  );
}

export function findCouponStepIndexByFieldName(
  fieldName: string | number | undefined,
  stepKeys: CouponCreateSectionKey[],
): number {
  if (typeof fieldName !== "string") {
    return 0;
  }

  const nextIndex = stepKeys.findIndex((stepKey) =>
    couponCreateStepFieldMap[stepKey].includes(
      fieldName as keyof CouponFormValues,
    ),
  );

  return nextIndex >= 0 ? nextIndex : 0;
}

export function getFirstHiddenCouponValidationError(
  values: Partial<CouponFormValues>,
  couponKind: CouponKind,
  hasAlertSection: boolean,
): { field: keyof CouponFormValues } | null {
  if (!values.couponName?.trim()) {
    return { field: "couponName" };
  }

  if (couponKind === "autoIssue" && !values.autoIssueTriggerType) {
    return { field: "autoIssueTriggerType" };
  }

  if (couponKind === "couponCode") {
    if (!values.audience) {
      return { field: "audience" };
    }

    if (!values.codeGenerationMode) {
      return { field: "codeGenerationMode" };
    }

    if (
      values.codeGenerationMode === "bulk" &&
      !(values.codeCount && values.codeCount > 0)
    ) {
      return { field: "codeCount" };
    }
  }

  if (couponKind !== "autoIssue" && couponKind !== "couponCode") {
    if (!values.issueTargetType) {
      return { field: "issueTargetType" };
    }

    if (
      values.issueTargetType === "specificGroup" &&
      !values.targetGroupId?.trim()
    ) {
      return { field: "targetGroupId" };
    }

    if (
      couponKind === "customerDownload" &&
      values.issueLimitMode === "limited" &&
      !(values.issueLimit && values.issueLimit > 0)
    ) {
      return { field: "issueLimit" };
    }
  }

  if (!values.benefitType) {
    return { field: "benefitType" };
  }

  if (
    values.benefitType !== "freeShipping" &&
    !(values.benefitValue && values.benefitValue > 0)
  ) {
    return { field: "benefitValue" };
  }

  if (!(values.minOrderAmount && values.minOrderAmount > 0)) {
    return { field: "minOrderAmount" };
  }

  if (!values.applicableScope) {
    return { field: "applicableScope" };
  }

  if (couponKind === "manualIssue") {
    if (!hasValidCouponDateRange(values.validityRange)) {
      return { field: "validityRange" };
    }
  } else {
    if (!values.validityMode) {
      return { field: "validityMode" };
    }

    if (
      values.validityMode === "fixedDate" &&
      !hasValidCouponDateRange(values.validityRange)
    ) {
      return { field: "validityRange" };
    }

    if (
      values.validityMode === "afterIssued" &&
      !(values.expireAfterDays && values.expireAfterDays > 0)
    ) {
      return { field: "expireAfterDays" };
    }
  }

  if (
    values.usageLimitMode === "limited" &&
    !(values.usageLimit && values.usageLimit > 0)
  ) {
    return { field: "usageLimit" };
  }

  if (hasAlertSection) {
    if (values.issueAlertEnabled && !values.issueAlertChannel) {
      return { field: "issueAlertChannel" };
    }

    if (values.expireAlertEnabled && !values.expireAlertChannel) {
      return { field: "expireAlertChannel" };
    }
  }

  return null;
}

// 아래 두 함수는 페이지 useMemo 본문을 그대로 옮긴 순수 파생이다.
export function buildCouponBenefitFieldMeta(
  selectedBenefitType: CouponFormValues["benefitType"] | undefined
) {
  if (selectedBenefitType === "rateDiscount") {
    return {
      valueLabel: "할인 비율",
      valuePlaceholder: "1~100% 사이로 입력해 주세요.",
      valueRequiredMessage: "할인 비율을 입력해 주세요.",
      max: 100,
    };
  }

  if (selectedBenefitType === "freeShipping") {
    return {
      valueLabel: "혜택 내용",
      valuePlaceholder: "",
      valueRequiredMessage: "",
      max: undefined as number | undefined,
    };
  }

  if (selectedBenefitType === "fixedPrice") {
    return {
      valueLabel: "고정가",
      valuePlaceholder: "1원 이상 입력해 주세요.",
      valueRequiredMessage: "고정가를 입력해 주세요.",
      max: undefined as number | undefined,
    };
  }

  return {
    valueLabel: "할인 금액",
    valuePlaceholder: "1원 이상 입력해 주세요.",
    valueRequiredMessage: "할인 금액을 입력해 주세요.",
    max: undefined as number | undefined,
  };
}

export function buildCouponValidityModeOptions(activeCouponKind: CouponKind) {
  if (activeCouponKind === "customerDownload") {
    return [
      { label: "사용 기한 설정", value: "fixedDate" },
      { label: "발급 후 N일 만료", value: "afterIssued" },
      { label: "제한 없음", value: "unlimited" },
    ];
  }

  if (activeCouponKind === "autoIssue") {
    return [
      { label: "발급 후 N일 만료", value: "afterIssued" },
      { label: "제한 없음", value: "unlimited" },
    ];
  }

  if (activeCouponKind === "couponCode") {
    return [
      { label: "사용 기한 설정", value: "fixedDate" },
      { label: "제한 없음", value: "unlimited" },
    ];
  }

  return [{ label: "사용 기한 설정", value: "fixedDate" }];
}
