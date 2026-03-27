import type { SelectProps } from "antd";

import type { CommerceCouponSubscriptionTemplate } from "./coupon-template-types";
import { getCouponTemplateAlertChannelLabel } from "./coupon-template-types";
import type { CouponApplicableScope, CouponBenefitType } from "./coupon-types";
import {
  getCouponApplicableScopeLabel,
  getCouponBenefitTypeLabel,
} from "./coupon-types";

export type CouponTemplateReferenceOption = {
  id: string;
  name: string;
  description?: string;
};

export const couponTemplateShoppingGradeOptions: CouponTemplateReferenceOption[] =
  [
    {
      id: "SHOP-GRADE-WELCOME",
      name: "웰컴",
      description: "신규 가입 후 첫 구매 전 단계 회원",
    },
    {
      id: "SHOP-GRADE-CORE",
      name: "코어",
      description: "최근 90일 누적 결제 1회 이상 회원",
    },
    {
      id: "SHOP-GRADE-VIP",
      name: "VIP",
      description: "최근 90일 누적 결제 금액 상위 회원",
    },
  ];

export const couponTemplateCategoryOptions: CouponTemplateReferenceOption[] = [
  { id: "CAT-TOPIK-STARTER", name: "입문 강의" },
  { id: "CAT-TOPIK-READING", name: "읽기" },
  { id: "CAT-TOPIK-SPEAKING", name: "말하기" },
];

export const couponTemplateProductOptions: CouponTemplateReferenceOption[] = [
  { id: "PRD-COURSE-001", name: "TOPIK 실전 패키지" },
  { id: "PRD-COURSE-002", name: "쓰기 집중반" },
  { id: "PRD-COURSE-003", name: "읽기 단과반" },
];

type CouponTemplateDraftDefaults = Pick<
  CommerceCouponSubscriptionTemplate,
  | "templateName"
  | "targetGradeIds"
  | "benefitType"
  | "benefitValue"
  | "minOrderAmount"
  | "maxDiscountAmount"
  | "applicableScope"
  | "applicableScopeReferenceIds"
  | "excludedProductMode"
  | "excludedProductIds"
  | "isStackable"
  | "issueSchedule"
  | "usageEndSchedule"
  | "issueAlertEnabled"
  | "expireAlertEnabled"
  | "alertChannel"
  | "adminMemo"
>;

export function createCouponTemplateDraftDefaults(): CouponTemplateDraftDefaults {
  return {
    templateName: "",
    targetGradeIds: ["SHOP-GRADE-WELCOME"],
    benefitType: "amountDiscount",
    benefitValue: 3000,
    minOrderAmount: 10000,
    maxDiscountAmount: 10000,
    applicableScope: "allProducts",
    applicableScopeReferenceIds: [],
    excludedProductMode: "none",
    excludedProductIds: [],
    isStackable: false,
    issueSchedule: {
      dayOfMonth: 1,
      hour: 7,
      minute: 0,
    },
    usageEndSchedule: {
      dayOfMonth: 28,
      hour: 23,
      minute: 59,
    },
    issueAlertEnabled: true,
    expireAlertEnabled: false,
    alertChannel: "webAppPush",
    adminMemo: "",
  };
}

export function getCouponTemplateBenefitTypeOptions(): SelectProps["options"] {
  return (
    [
      "amountDiscount",
      "rateDiscount",
      "freeShipping",
      "fixedPrice",
    ] as CouponBenefitType[]
  ).map((value) => ({
    label: getCouponBenefitTypeLabel(value),
    value,
  }));
}

export function getCouponTemplateScopeOptions(): SelectProps["options"] {
  return (
    [
      "allProducts",
      "specificCategory",
      "specificProduct",
    ] as CouponApplicableScope[]
  ).map((value) => ({
    label: getCouponApplicableScopeLabel(value),
    value,
  }));
}

export function getCouponTemplateShoppingGradeSelectOptions(): SelectProps["options"] {
  return couponTemplateShoppingGradeOptions.map((option) => ({
    label: `${option.name} (${option.id})`,
    value: option.id,
  }));
}

export function getCouponTemplateCategorySelectOptions(): SelectProps["options"] {
  return couponTemplateCategoryOptions.map((option) => ({
    label: `${option.name} (${option.id})`,
    value: option.id,
  }));
}

export function getCouponTemplateProductSelectOptions(): SelectProps["options"] {
  return couponTemplateProductOptions.map((option) => ({
    label: `${option.name} (${option.id})`,
    value: option.id,
  }));
}

export function getCouponTemplateAlertChannelOptions(): SelectProps["options"] {
  return [
    {
      label: getCouponTemplateAlertChannelLabel("webAppPush"),
      value: "webAppPush",
    },
  ];
}

function resolveReferenceNames(
  ids: string[],
  options: CouponTemplateReferenceOption[],
): string[] {
  const optionMap = new Map(options.map((option) => [option.id, option.name]));
  return ids.map((id) => optionMap.get(id) ?? "").filter(Boolean);
}

export function resolveCouponTemplateShoppingGradeNames(
  ids: string[],
): string[] {
  return resolveReferenceNames(ids, couponTemplateShoppingGradeOptions);
}

export function resolveCouponTemplateCategoryNames(ids: string[]): string[] {
  return resolveReferenceNames(ids, couponTemplateCategoryOptions);
}

export function resolveCouponTemplateProductNames(ids: string[]): string[] {
  return resolveReferenceNames(ids, couponTemplateProductOptions);
}

export function getCouponTemplatePolicyNotes(
  targetGradeIds: string[],
): string[] {
  const targetGradeNames =
    resolveCouponTemplateShoppingGradeNames(targetGradeIds);
  const gradeSummary =
    targetGradeNames.length > 0 ? targetGradeNames.join(", ") : "대상 미지정";

  return [
    `매월 1일 오전 7시에 자동 발행되며, 발행일에 존재하지 않는 날짜는 해당 월의 마지막 날짜로 보정됩니다.`,
    `발행 대상은 쇼핑 등급 기준으로만 운영하며, 현재 설정된 등급은 ${gradeSummary}입니다.`,
    "자동 발행 중지 시 기존 발급 쿠폰은 유지되고, 이후 발급분만 멈춥니다.",
  ];
}
