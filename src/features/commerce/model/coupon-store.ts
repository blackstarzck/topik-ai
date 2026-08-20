import { create } from "zustand";

import {
  createInitialCouponAudits,
  createInitialCouponSubscriptionTemplates,
  createInitialCoupons
} from "../api/mock-coupons";
import {
  getCouponTemplatePolicyNotes,
  resolveCouponTemplateCategoryNames,
  resolveCouponTemplateProductNames,
  resolveCouponTemplateShoppingGradeNames,
} from "./coupon-template-form-schema";
import type {
  CommerceCouponSubscriptionTemplate,
  CouponAuditEvent,
  CouponTemplateAlertChannel,
  CouponTemplateExcludedProductMode,
  CouponTemplateStatus,
} from "./coupon-template-types";
import { getCouponPolicyNotes } from "./coupon-form-schema";
import type {
  CommerceCoupon,
  CouponAlertSetting,
  CouponAudience,
  CouponAutoIssueTriggerType,
  CouponBenefitType,
  CouponCodeGenerationMode,
  CouponIssueState,
  CouponIssueTargetType,
  CouponKind,
  CouponLimitMode,
  CouponStatus,
  CouponValidityMode,
} from "./coupon-types";
import { getMessageOptionSnapshot } from "@/features/message/api/messages-service";
import { formatNowMinutes as formatNow } from '@/shared/model/date-format';

export type CouponPlanTier = "free" | "pro";

export type CouponSavePayload = {
  id?: string;
  couponName: string;
  couponKind: CouponKind;
  couponStatus: CouponStatus;
  issueState: CouponIssueState;
  issueTargetType: CouponIssueTargetType | null;
  targetGroupIds: string[];
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
  applicableScope: CommerceCoupon["applicableScope"];
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
  linkedCrmCampaignId: string;
  linkedEventId: string;
  adminMemo: string;
  issueAlert: CouponAlertSetting;
  expireAlert: CouponAlertSetting;
};

export type CouponTemplateSavePayload = {
  id?: string;
  templateName: string;
  targetGradeIds: string[];
  benefitType: CouponBenefitType;
  benefitValue: number;
  minOrderAmount: number;
  maxDiscountAmount: number | null;
  applicableScope: CommerceCoupon["applicableScope"];
  applicableScopeReferenceIds: string[];
  excludedProductMode: CouponTemplateExcludedProductMode;
  excludedProductIds: string[];
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
  issueAlertEnabled: boolean;
  expireAlertEnabled: boolean;
  alertChannel: CouponTemplateAlertChannel;
  adminMemo: string;
};

type CouponActionPayload = {
  couponId: string;
};

type CouponTemplateActionPayload = {
  templateId: string;
};

type CouponStore = {
  planTier: CouponPlanTier;
  coupons: CommerceCoupon[];
  subscriptionTemplates: CommerceCouponSubscriptionTemplate[];
  audits: CouponAuditEvent[];
  saveCoupon: (payload: CouponSavePayload) => CommerceCoupon;
  duplicateCoupon: (payload: CouponActionPayload) => CommerceCoupon | null;
  pauseCoupon: (payload: CouponActionPayload) => CommerceCoupon | null;
  resumeCoupon: (payload: CouponActionPayload) => CommerceCoupon | null;
  deleteCoupon: (payload: CouponActionPayload) => CommerceCoupon | null;
  saveCouponTemplate: (
    payload: CouponTemplateSavePayload,
  ) => CommerceCouponSubscriptionTemplate;
  pauseCouponTemplate: (
    payload: CouponTemplateActionPayload,
  ) => CommerceCouponSubscriptionTemplate | null;
  resumeCouponTemplate: (
    payload: CouponTemplateActionPayload,
  ) => CommerceCouponSubscriptionTemplate | null;
  deleteCouponTemplate: (
    payload: CouponTemplateActionPayload,
  ) => CommerceCouponSubscriptionTemplate | null;
  appendAudit: (audit: CouponAuditEvent) => void;
};

const CURRENT_ACTOR = "admin_current";

function createCouponId(coupons: CommerceCoupon[]): string {
  const nextSequence =
    coupons
      .map((coupon) => Number(coupon.id.replace("CPN-", "")))
      .reduce((max, value) => Math.max(max, value), 0) + 1;

  return `CPN-${String(nextSequence).padStart(4, "0")}`;
}

function createCouponTemplateId(
  templates: CommerceCouponSubscriptionTemplate[],
): string {
  const nextSequence =
    templates
      .map((template) => Number(template.id.replace("CPT-", "")))
      .reduce((max, value) => Math.max(max, value), 0) + 1;

  return `CPT-${String(nextSequence).padStart(4, "0")}`;
}

function createCouponCode(couponName: string): string {
  const normalized = couponName
    .replace(/[^A-Za-z0-9가-힣]/g, "")
    .slice(0, 8)
    .toUpperCase();

  return `${normalized || "TOPIK"}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function createDownloadUrl(couponId: string): string {
  return `https://topik.ai/coupons/${couponId.toLowerCase()}`;
}

function resolveGroupNames(groupIds: string[]): string[] {
  const groups = getMessageOptionSnapshot().groups;
  const groupMap = new Map(groups.map((group) => [group.id, group.name]));

  return groupIds.map((groupId) => groupMap.get(groupId) ?? "").filter(Boolean);
}

function resolveTemplateName(templateId: string): string {
  if (!templateId) {
    return "";
  }

  const templates = getMessageOptionSnapshot().templates;
  return templates.find((template) => template.id === templateId)?.name ?? "";
}

function resolveCrmCampaignName(campaignId: string): string {
  if (!campaignId) {
    return "";
  }

  const crmCampaignNameMap: Record<string, string> = {
    "CRM-CART-001": "장바구니 상품 구매 유도",
    "CRM-WELCOME-001": "자동 발행 쿠폰 안내",
    "CRM-EXPIRE-001": "쿠폰 기간 만료 안내",
    "CRM-MANUAL-001": "지정 발행 쿠폰 알림",
  };

  return crmCampaignNameMap[campaignId] ?? "";
}

function resolveEventName(eventId: string): string {
  if (!eventId) {
    return "";
  }

  const eventNameMap: Record<string, string> = {
    "EVT-COUPON-001": "봄맞이 쿠폰팩 랜딩",
    "EVT-COUPON-002": "장바구니 CRM 리텐션",
    "EVT-COUPON-003": "웰컴 혜택 프로모션",
  };

  return eventNameMap[eventId] ?? "";
}

function normalizeCoupon(
  coupons: CommerceCoupon[],
  payload: CouponSavePayload,
  existingCoupon?: CommerceCoupon,
): CommerceCoupon {
  const now = formatNow();
  const nextId = payload.id ?? createCouponId(coupons);
  const targetGroupNames = resolveGroupNames(payload.targetGroupIds);
  const linkedMessageTemplateName = resolveTemplateName(
    payload.linkedMessageTemplateId,
  );
  const linkedCrmCampaignName = resolveCrmCampaignName(
    payload.linkedCrmCampaignId,
  );
  const linkedEventName = resolveEventName(payload.linkedEventId);
  const couponCode =
    payload.couponKind === "couponCode"
      ? existingCoupon?.couponCode ||
        payload.couponCode ||
        createCouponCode(payload.couponName)
      : "";

  return {
    id: nextId,
    couponName: payload.couponName,
    couponKind: payload.couponKind,
    couponStatus: payload.couponStatus,
    issueState:
      payload.couponKind === "autoIssue" ? payload.issueState : "정상",
    issueTargetType: payload.issueTargetType,
    targetGroupIds: payload.targetGroupIds,
    targetGroupNames,
    targetUserIds: payload.targetUserIds,
    autoIssueTriggerType: payload.autoIssueTriggerType,
    codeGenerationMode: payload.codeGenerationMode,
    couponCode,
    codeCount:
      payload.couponKind === "couponCode" &&
      payload.codeGenerationMode === "bulk"
        ? payload.codeCount
        : payload.couponKind === "couponCode"
          ? 1
          : null,
    audience: payload.audience,
    benefitType: payload.benefitType,
    benefitValue: payload.benefitValue,
    minOrderAmount: payload.minOrderAmount,
    maxDiscountAmount: payload.maxDiscountAmount,
    applicableScope: payload.applicableScope,
    isStackable: payload.isStackable,
    isSecretCoupon: payload.isSecretCoupon,
    issueLimitMode: payload.issueLimitMode,
    issueLimit:
      payload.issueLimitMode === "limited" ? payload.issueLimit : null,
    downloadLimitMode: payload.downloadLimitMode,
    downloadLimit:
      payload.downloadLimitMode === "limited" ? payload.downloadLimit : null,
    usageLimitMode: payload.usageLimitMode,
    usageLimit:
      payload.usageLimitMode === "limited" ? payload.usageLimit : null,
    validityMode: payload.validityMode,
    validFrom: payload.validFrom,
    validUntil: payload.validUntil,
    expireAfterDays:
      payload.validityMode === "afterIssued" ? payload.expireAfterDays : null,
    linkedMessageTemplateId: payload.linkedMessageTemplateId,
    linkedMessageTemplateName,
    linkedCrmCampaignId: payload.linkedCrmCampaignId,
    linkedCrmCampaignName,
    linkedEventId: payload.linkedEventId,
    linkedEventName,
    downloadUrl:
      payload.couponKind === "customerDownload"
        ? createDownloadUrl(nextId)
        : "",
    issueCount: existingCoupon?.issueCount ?? 0,
    downloadCount: existingCoupon?.downloadCount ?? 0,
    useCount: existingCoupon?.useCount ?? 0,
    lastIssuedAt: existingCoupon?.lastIssuedAt ?? "",
    lastDownloadedAt: existingCoupon?.lastDownloadedAt ?? "",
    lastUsedAt: existingCoupon?.lastUsedAt ?? "",
    policyNotes: getCouponPolicyNotes(
      payload.couponKind,
      payload.autoIssueTriggerType,
    ),
    adminMemo: payload.adminMemo,
    createdAt: existingCoupon?.createdAt ?? now,
    updatedAt: now,
    updatedBy: CURRENT_ACTOR,
    issueAlert: payload.issueAlert,
    expireAlert: payload.expireAlert,
  };
}

function normalizeCouponTemplate(
  templates: CommerceCouponSubscriptionTemplate[],
  payload: CouponTemplateSavePayload,
  existingTemplate?: CommerceCouponSubscriptionTemplate,
): CommerceCouponSubscriptionTemplate {
  const now = formatNow();
  const nextId = payload.id ?? createCouponTemplateId(templates);
  const applicableScopeReferenceNames =
    payload.applicableScope === "specificCategory"
      ? resolveCouponTemplateCategoryNames(payload.applicableScopeReferenceIds)
      : payload.applicableScope === "specificProduct"
        ? resolveCouponTemplateProductNames(payload.applicableScopeReferenceIds)
        : [];

  return {
    id: nextId,
    templateName: payload.templateName,
    issueTargetType: "shoppingGrade",
    targetGradeIds: payload.targetGradeIds,
    targetGradeNames: resolveCouponTemplateShoppingGradeNames(
      payload.targetGradeIds,
    ),
    benefitType: payload.benefitType,
    benefitValue: payload.benefitValue,
    minOrderAmount: payload.minOrderAmount,
    maxDiscountAmount:
      payload.benefitType === "rateDiscount" ? payload.maxDiscountAmount : null,
    applicableScope: payload.applicableScope,
    applicableScopeReferenceIds:
      payload.applicableScope === "allProducts"
        ? []
        : payload.applicableScopeReferenceIds,
    applicableScopeReferenceNames,
    excludedProductMode: payload.excludedProductMode,
    excludedProductIds:
      payload.excludedProductMode === "specific"
        ? payload.excludedProductIds
        : [],
    excludedProductNames:
      payload.excludedProductMode === "specific"
        ? resolveCouponTemplateProductNames(payload.excludedProductIds)
        : [],
    isStackable: payload.isStackable,
    issueSchedule: payload.issueSchedule,
    usageEndSchedule: payload.usageEndSchedule,
    status: payload.status,
    issuedCouponCount: existingTemplate?.issuedCouponCount ?? 0,
    lastIssuedAt: existingTemplate?.lastIssuedAt ?? "",
    nextIssuedAt: existingTemplate?.nextIssuedAt ?? "2026-04-01 07:00",
    issueAlertEnabled: payload.issueAlertEnabled,
    expireAlertEnabled: payload.expireAlertEnabled,
    alertChannel: payload.alertChannel,
    adminMemo: payload.adminMemo,
    policyNotes: getCouponTemplatePolicyNotes(payload.targetGradeIds),
    createdAt: existingTemplate?.createdAt ?? now,
    updatedAt: now,
    updatedBy: CURRENT_ACTOR,
  };
}

export const useCouponStore = create<CouponStore>((set, get) => ({
  planTier: "pro",
  coupons: createInitialCoupons(),
  subscriptionTemplates: createInitialCouponSubscriptionTemplates(),
  audits: createInitialCouponAudits(),
  saveCoupon: (payload) => {
    const existingCoupon = payload.id
      ? get().coupons.find((coupon) => coupon.id === payload.id)
      : undefined;
    const nextCoupon = normalizeCoupon(get().coupons, payload, existingCoupon);

    set((state) => {
      const exists = state.coupons.some(
        (coupon) => coupon.id === nextCoupon.id,
      );
      return {
        coupons: exists
          ? state.coupons.map((coupon) =>
              coupon.id === nextCoupon.id ? nextCoupon : coupon,
            )
          : [nextCoupon, ...state.coupons],
      };
    });

    return nextCoupon;
  },
  duplicateCoupon: ({ couponId }) => {
    const targetCoupon = get().coupons.find((coupon) => coupon.id === couponId);

    if (!targetCoupon) {
      return null;
    }

    const duplicatedCoupon = normalizeCoupon(get().coupons, {
      ...targetCoupon,
      id: undefined,
      couponName: `${targetCoupon.couponName} 복사본`,
      couponStatus: "대기",
      issueState: "정상",
      targetGroupIds: targetCoupon.targetGroupIds,
      targetUserIds: targetCoupon.targetUserIds,
      linkedMessageTemplateId: targetCoupon.linkedMessageTemplateId,
      linkedCrmCampaignId: targetCoupon.linkedCrmCampaignId,
      linkedEventId: targetCoupon.linkedEventId,
    });

    set((state) => ({
      coupons: [duplicatedCoupon, ...state.coupons],
    }));

    return duplicatedCoupon;
  },
  pauseCoupon: ({ couponId }) => {
    const targetCoupon = get().coupons.find((coupon) => coupon.id === couponId);

    if (!targetCoupon || targetCoupon.couponKind !== "autoIssue") {
      return null;
    }

    const pausedCoupon: CommerceCoupon = {
      ...targetCoupon,
      issueState: "발행 중지",
      updatedAt: formatNow(),
      updatedBy: CURRENT_ACTOR,
    };

    set((state) => ({
      coupons: state.coupons.map((coupon) =>
        coupon.id === couponId ? pausedCoupon : coupon,
      ),
    }));

    return pausedCoupon;
  },
  resumeCoupon: ({ couponId }) => {
    const targetCoupon = get().coupons.find((coupon) => coupon.id === couponId);

    if (!targetCoupon || targetCoupon.couponKind !== "autoIssue") {
      return null;
    }

    const resumedCoupon: CommerceCoupon = {
      ...targetCoupon,
      issueState: "정상",
      updatedAt: formatNow(),
      updatedBy: CURRENT_ACTOR,
    };

    set((state) => ({
      coupons: state.coupons.map((coupon) =>
        coupon.id === couponId ? resumedCoupon : coupon,
      ),
    }));

    return resumedCoupon;
  },
  deleteCoupon: ({ couponId }) => {
    const targetCoupon = get().coupons.find((coupon) => coupon.id === couponId);

    if (!targetCoupon) {
      return null;
    }

    set((state) => ({
      coupons: state.coupons.filter((coupon) => coupon.id !== couponId),
    }));

    return targetCoupon;
  },
  saveCouponTemplate: (payload) => {
    const existingTemplate = payload.id
      ? get().subscriptionTemplates.find(
          (template) => template.id === payload.id,
        )
      : undefined;
    const nextTemplate = normalizeCouponTemplate(
      get().subscriptionTemplates,
      payload,
      existingTemplate,
    );

    set((state) => {
      const exists = state.subscriptionTemplates.some(
        (template) => template.id === nextTemplate.id,
      );
      return {
        subscriptionTemplates: exists
          ? state.subscriptionTemplates.map((template) =>
              template.id === nextTemplate.id ? nextTemplate : template,
            )
          : [nextTemplate, ...state.subscriptionTemplates],
      };
    });

    return nextTemplate;
  },
  pauseCouponTemplate: ({ templateId }) => {
    const targetTemplate = get().subscriptionTemplates.find(
      (template) => template.id === templateId,
    );

    if (!targetTemplate) {
      return null;
    }

    const pausedTemplate: CommerceCouponSubscriptionTemplate = {
      ...targetTemplate,
      status: "발행 중지",
      updatedAt: formatNow(),
      updatedBy: CURRENT_ACTOR,
    };

    set((state) => ({
      subscriptionTemplates: state.subscriptionTemplates.map((template) =>
        template.id === templateId ? pausedTemplate : template,
      ),
    }));

    return pausedTemplate;
  },
  resumeCouponTemplate: ({ templateId }) => {
    const targetTemplate = get().subscriptionTemplates.find(
      (template) => template.id === templateId,
    );

    if (!targetTemplate) {
      return null;
    }

    const resumedTemplate: CommerceCouponSubscriptionTemplate = {
      ...targetTemplate,
      status: "진행 중",
      updatedAt: formatNow(),
      updatedBy: CURRENT_ACTOR,
    };

    set((state) => ({
      subscriptionTemplates: state.subscriptionTemplates.map((template) =>
        template.id === templateId ? resumedTemplate : template,
      ),
    }));

    return resumedTemplate;
  },
  deleteCouponTemplate: ({ templateId }) => {
    const targetTemplate = get().subscriptionTemplates.find(
      (template) => template.id === templateId,
    );

    if (!targetTemplate) {
      return null;
    }

    set((state) => ({
      subscriptionTemplates: state.subscriptionTemplates.filter(
        (template) => template.id !== templateId,
      ),
    }));

    return targetTemplate;
  },
  appendAudit: (audit) => {
    set((state) => ({
      audits: [audit, ...state.audits],
    }));
  },
}));
