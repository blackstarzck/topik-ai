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
      name: "?곗뺨",
      description: "?좉퇋 媛????泥?援щℓ ???④퀎 회원",
    },
    {
      id: "SHOP-GRADE-CORE",
      name: "肄붿뼱",
      description: "理쒓렐 90???꾩쟻 결제 1???댁긽 회원",
    },
    {
      id: "SHOP-GRADE-VIP",
      name: "VIP",
      description: "理쒓렐 90???꾩쟻 결제 湲덉븸 ?곸쐞 회원",
    },
  ];

export const couponTemplateCategoryOptions: CouponTemplateReferenceOption[] = [
  { id: "CAT-TOPIK-STARTER", name: "?낅Ц 媛뺤쓽" },
  { id: "CAT-TOPIK-READING", name: "?쎄린" },
  { id: "CAT-TOPIK-SPEAKING", name: "留먰븯湲? },
];

export const couponTemplateProductOptions: CouponTemplateReferenceOption[] = [
  { id: "PRD-COURSE-001", name: "TOPIK ?ㅼ쟾 ?⑦궎吏" },
  { id: "PRD-COURSE-002", name: "?곌린 吏묒쨷諛? },
  { id: "PRD-COURSE-003", name: "?쎄린 ?④낵諛? },
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
    targetGradeNames.length > 0 ? targetGradeNames.join(", ") : "대상誘몄???;

  return [
    `留ㅼ썡 1???ㅼ쟾 7?쒖뿉 ?먮룞 諛쒗뻾?섎ŉ, 諛쒗뻾?쇱뿉 議댁옱?섏? ?딅뒗 ?좎쭨???대떦 ?붿쓽 留덉?留??좎쭨濡?蹂댁젙?⑸땲??`,
    `諛쒗뻾 ??곸? ?쇳븨 등급 湲곗??쇰줈留?운영?섎ŉ, ?꾩옱 ?ㅼ젙??등급? ${gradeSummary}?낅땲??`,
    "?먮룞 諛쒗뻾 以묒? ??湲곗〈 諛쒓툒 荑좏룿? ?좎??섍퀬, ?댄썑 諛쒓툒遺꾨쭔 硫덉땅?덈떎.",
  ];
}


