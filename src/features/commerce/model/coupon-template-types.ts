import type { CouponApplicableScope, CouponBenefitType } from "./coupon-types";
import {
  formatCouponCurrency,
  getCouponApplicableScopeLabel,
  getCouponBenefitTypeLabel,
} from "./coupon-types";

export const couponTemplateStatusValues = ["진행 중", "발행 중지"] as const;
export type CouponTemplateStatus = (typeof couponTemplateStatusValues)[number];

export const couponTemplateIssueTargetTypeValues = ["shoppingGrade"] as const;
export type CouponTemplateIssueTargetType =
  (typeof couponTemplateIssueTargetTypeValues)[number];

export const couponTemplateExcludedProductModeValues = [
  "none",
  "specific",
] as const;
export type CouponTemplateExcludedProductMode =
  (typeof couponTemplateExcludedProductModeValues)[number];

export const couponTemplateAlertChannelValues = ["webAppPush"] as const;
export type CouponTemplateAlertChannel =
  (typeof couponTemplateAlertChannelValues)[number];

export type CommerceCouponSubscriptionTemplate = {
  id: string;
  templateName: string;
  issueTargetType: CouponTemplateIssueTargetType;
  targetGradeIds: string[];
  targetGradeNames: string[];
  benefitType: CouponBenefitType;
  benefitValue: number;
  minOrderAmount: number;
  maxDiscountAmount: number | null;
  applicableScope: CouponApplicableScope;
  applicableScopeReferenceIds: string[];
  applicableScopeReferenceNames: string[];
  excludedProductMode: CouponTemplateExcludedProductMode;
  excludedProductIds: string[];
  excludedProductNames: string[];
  isStackable: boolean;
  issueSchedule: {
    dayOfMonth: number;
    hour: number;
    minute: number;
  };
  usageEndSchedule: {
    dayOfMonth: number;
    hour: number;
    minute: number;
  };
  status: CouponTemplateStatus;
  issuedCouponCount: number;
  lastIssuedAt: string;
  nextIssuedAt: string;
  issueAlertEnabled: boolean;
  expireAlertEnabled: boolean;
  alertChannel: CouponTemplateAlertChannel;
  adminMemo: string;
  policyNotes: string[];
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
};

export type CouponAuditEvent = {
  id: string;
  targetType: "CommerceCoupon" | "CommerceCouponTemplate";
  targetId: string;
  action: string;
  reason: string;
  changedBy: string;
  createdAt: string;
};

const couponTemplateAlertChannelLabelMap: Record<
  CouponTemplateAlertChannel,
  string
> = {
  webAppPush: "웹 푸시·앱 푸시",
};

export function getCouponTemplateAlertChannelLabel(
  channel: CouponTemplateAlertChannel,
): string {
  return couponTemplateAlertChannelLabelMap[channel];
}

export function formatCouponTemplateSchedule(schedule: {
  dayOfMonth: number;
  hour: number;
  minute: number;
}): string {
  const day = `${schedule.dayOfMonth}일`;
  const hour = `${String(schedule.hour).padStart(2, "0")}시`;
  const minute = `${String(schedule.minute).padStart(2, "0")}분`;
  return `${day} ${hour} ${minute}`;
}

export function getCouponTemplateBenefitSummary(
  template: CommerceCouponSubscriptionTemplate,
): string {
  if (template.benefitType === "amountDiscount") {
    return `${getCouponBenefitTypeLabel(template.benefitType)} ${formatCouponCurrency(template.benefitValue)}`;
  }

  if (template.benefitType === "rateDiscount") {
    const maxDiscountText = template.maxDiscountAmount
      ? ` · 최대 ${formatCouponCurrency(template.maxDiscountAmount)}`
      : "";
    return `${getCouponBenefitTypeLabel(template.benefitType)} ${template.benefitValue}%${maxDiscountText}`;
  }

  if (template.benefitType === "fixedPrice") {
    return `${getCouponBenefitTypeLabel(template.benefitType)} ${formatCouponCurrency(template.benefitValue)}`;
  }

  return getCouponBenefitTypeLabel(template.benefitType);
}

export function getCouponTemplateConditionSummary(
  template: CommerceCouponSubscriptionTemplate,
): string {
  const scopeLabel = getCouponApplicableScopeLabel(template.applicableScope);
  const stackableLabel = template.isStackable ? "중복 허용" : "단독 사용";
  return `${formatCouponCurrency(template.minOrderAmount)} 이상 · ${scopeLabel} · ${stackableLabel}`;
}

export function getCouponTemplateIssueTargetSummary(
  template: CommerceCouponSubscriptionTemplate,
): string {
  const gradeSummary =
    template.targetGradeNames.length > 0
      ? template.targetGradeNames.join(", ")
      : "대상 미지정";

  return `쇼핑 등급 · ${gradeSummary}`;
}

export function getCouponTemplateScopeSummary(
  template: CommerceCouponSubscriptionTemplate,
): string {
  const scopeLabel = getCouponApplicableScopeLabel(template.applicableScope);
  const referenceNames =
    template.applicableScopeReferenceNames.length > 0
      ? ` · ${template.applicableScopeReferenceNames.join(", ")}`
      : "";

  if (
    template.excludedProductMode === "specific" &&
    template.excludedProductNames.length > 0
  ) {
    return `${scopeLabel}${referenceNames} / 제외 ${template.excludedProductNames.join(", ")}`;
  }

  return `${scopeLabel}${referenceNames}`;
}

export function getCouponTemplateAlertSummary(
  template: CommerceCouponSubscriptionTemplate,
): string {
  const parts: string[] = [];

  if (template.issueAlertEnabled) {
    parts.push("발급 알림");
  }

  if (template.expireAlertEnabled) {
    parts.push("소멸 알림");
  }

  if (parts.length === 0) {
    return "사용 안 함";
  }

  return `${getCouponTemplateAlertChannelLabel(template.alertChannel)} · ${parts.join(" / ")}`;
}
