import dayjs, { type Dayjs } from "dayjs";
import { APP_COLOR, COLOR, RADIUS } from '@/shared/styles/design-tokens';

import type {
  CommerceCouponSubscriptionTemplate,
  CouponTemplateAlertChannel,
  CouponTemplateExcludedProductMode,
} from "./coupon-template-types";

// 정기(구독) 쿠폰 템플릿 등록/수정 화면의 순수 스키마 — Phase 4 분해로 이동(동작 동일).
// 폼 인스턴스·조회 상태·제출 로직은 페이지가 소유한다.

export const couponTemplateReadOnlyFieldStyle = {
  width: "100%",
  padding: "12px 12px",
  border: `1px solid ${COLOR.border}`,
  borderRadius: RADIUS.base,
  backgroundColor: APP_COLOR.panelHeaderBg,
};
export const monthlyUsageEndDateReference = dayjs("2026-01-01");

export type CouponTemplateFormValues = {
  templateName: string;
  targetGradeIds: string[];
  benefitType: CommerceCouponSubscriptionTemplate["benefitType"];
  benefitValue: number;
  maxDiscountAmount: number | null;
  minOrderAmount: number;
  applicableScope: CommerceCouponSubscriptionTemplate["applicableScope"];
  applicableScopeReferenceIds: string[];
  excludedProductMode: CouponTemplateExcludedProductMode;
  excludedProductIds: string[];
  isStackable: boolean;
  usageEndDayOfMonth: number;
  usageEndHour: number;
  usageEndMinute: number;
  issueAlertEnabled: boolean;
  expireAlertEnabled: boolean;
  alertChannel: CouponTemplateAlertChannel;
  adminMemo: string;
};

export type CouponTemplateSectionKey =
  | "basic"
  | "benefit"
  | "operation"
  | "alert"
  | "memo";

export const couponTemplateSectionMeta: Record<
  CouponTemplateSectionKey,
  { title: string; description: string }
> = {
  basic: {
    title: "기본 설정",
    description: "정기 쿠폰명과 발행 대상을 설정합니다.",
  },
  benefit: {
    title: "혜택 설정",
    description: "혜택과 적용 범위, 제외 상품 규칙을 설정합니다.",
  },
  operation: {
    title: "운영 설정",
    description: "정기 발행 시점과 쿠폰 사용 종료일을 설정합니다.",
  },
  alert: {
    title: "알림 설정",
    description: "발급 및 만료 알림 채널을 설정합니다.",
  },
  memo: {
    title: "관리자 메모",
    description: "운영 검토 메모와 내부 공유 사항을 기록합니다.",
  },
};

export const couponTemplateStepFieldMap: Record<
  CouponTemplateSectionKey,
  Array<keyof CouponTemplateFormValues>
> = {
  basic: ["templateName", "targetGradeIds"],
  benefit: [
    "benefitType",
    "benefitValue",
    "maxDiscountAmount",
    "minOrderAmount",
    "applicableScope",
    "applicableScopeReferenceIds",
    "excludedProductMode",
    "excludedProductIds",
    "isStackable",
  ],
  operation: ["usageEndDayOfMonth", "usageEndHour", "usageEndMinute"],
  alert: ["issueAlertEnabled", "expireAlertEnabled", "alertChannel"],
  memo: ["adminMemo"],
};

export function isPositiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function findCouponTemplateStepIndexByFieldName(
  fieldName: string | number | undefined,
  stepKeys: CouponTemplateSectionKey[],
): number {
  if (typeof fieldName !== "string") {
    return 0;
  }

  const nextIndex = stepKeys.findIndex((stepKey) =>
    couponTemplateStepFieldMap[stepKey].includes(
      fieldName as keyof CouponTemplateFormValues,
    ),
  );

  return nextIndex >= 0 ? nextIndex : 0;
}

export function getFirstHiddenCouponTemplateValidationError(
  values: Partial<CouponTemplateFormValues>,
  hasAlertSection: boolean,
): { field: keyof CouponTemplateFormValues } | null {
  if (!values.templateName?.trim()) {
    return { field: "templateName" };
  }

  if (
    !Array.isArray(values.targetGradeIds) ||
    values.targetGradeIds.length === 0
  ) {
    return { field: "targetGradeIds" };
  }

  if (!values.benefitType) {
    return { field: "benefitType" };
  }

  if (
    values.benefitType !== "freeShipping" &&
    !isPositiveNumber(values.benefitValue)
  ) {
    return { field: "benefitValue" };
  }

  if (!isPositiveNumber(values.minOrderAmount)) {
    return { field: "minOrderAmount" };
  }

  if (!values.applicableScope) {
    return { field: "applicableScope" };
  }

  if (
    values.applicableScope !== "allProducts" &&
    (!Array.isArray(values.applicableScopeReferenceIds) ||
      values.applicableScopeReferenceIds.length === 0)
  ) {
    return { field: "applicableScopeReferenceIds" };
  }

  if (
    values.excludedProductMode === "specific" &&
    (!Array.isArray(values.excludedProductIds) ||
      values.excludedProductIds.length === 0)
  ) {
    return { field: "excludedProductIds" };
  }

  if (typeof values.usageEndDayOfMonth !== "number") {
    return { field: "usageEndDayOfMonth" };
  }

  if (typeof values.usageEndHour !== "number") {
    return { field: "usageEndHour" };
  }

  if (typeof values.usageEndMinute !== "number") {
    return { field: "usageEndMinute" };
  }

  if (hasAlertSection) {
    const hasAnyAlert = Boolean(
      values.issueAlertEnabled || values.expireAlertEnabled,
    );

    if (hasAnyAlert && !values.alertChannel) {
      return { field: "alertChannel" };
    }
  }

  return null;
}

export function toMonthlyUsageEndDate(dayOfMonth: number | undefined): Dayjs | null {
  if (typeof dayOfMonth !== "number" || !Number.isFinite(dayOfMonth)) {
    return null;
  }

  return monthlyUsageEndDateReference.date(
    Math.max(1, Math.min(dayOfMonth, 31)),
  );
}
