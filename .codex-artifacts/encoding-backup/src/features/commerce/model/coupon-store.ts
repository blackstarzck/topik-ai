import { create } from "zustand";

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
import { useMessageStore } from "../../message/model/message-store";

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

function formatNow(date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

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
    .replace(/[^A-Za-z0-9가-힣]/g, '')
    .slice(0, 8)
    .toUpperCase();

  return `${normalized || "TOPIK"}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function createDownloadUrl(couponId: string): string {
  return `https://topik.ai/coupons/${couponId.toLowerCase()}`;
}

function resolveGroupNames(groupIds: string[]): string[] {
  const groups = useMessageStore.getState().groups;
  const groupMap = new Map(groups.map((group) => [group.id, group.name]));

  return groupIds.map((groupId) => groupMap.get(groupId) ?? "").filter(Boolean);
}

function resolveTemplateName(templateId: string): string {
  if (!templateId) {
    return "";
  }

  const templates = useMessageStore.getState().templates;
  return templates.find((template) => template.id === templateId)?.name ?? "";
}

function resolveCrmCampaignName(campaignId: string): string {
  if (!campaignId) {
    return "";
  }

  const crmCampaignNameMap: Record<string, string> = {
    'CRM-CART-001': '장바구니 상품 구매 유도',
    'CRM-WELCOME-001': '자동 발행 쿠폰 안내',
    'CRM-EXPIRE-001': '쿠폰 기간 만료 안내',
    'CRM-MANUAL-001': '지정 발행 쿠폰 알림'
  };

  return crmCampaignNameMap[campaignId] ?? "";
}

function resolveEventName(eventId: string): string {
  if (!eventId) {
    return "";
  }

  const eventNameMap: Record<string, string> = {
    'EVT-COUPON-001': '친구추가 쿠폰 랜딩',
    'EVT-COUPON-002': '장바구니 CRM 리텐션',
    'EVT-COUPON-003': '회원 혜택 프로모션'
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

function createSeedCoupon(seed: CommerceCoupon): CommerceCoupon {
  return seed;
}

const initialCoupons: CommerceCoupon[] = [
  createSeedCoupon({
    id: "CPN-0001",
    couponName: "채널 친구 추가 시크릿 쿠폰",
    couponKind: "customerDownload",
    couponStatus: "진행 중",
    issueState: "정상",
    issueTargetType: "allMembers",
    targetGroupIds: [],
    targetGroupNames: [],
    targetUserIds: [],
    autoIssueTriggerType: null,
    codeGenerationMode: null,
    couponCode: "",
    codeCount: null,
    audience: null,
    benefitType: "amountDiscount",
    benefitValue: 3000,
    minOrderAmount: 10000,
    maxDiscountAmount: null,
    applicableScope: "allProducts",
    isStackable: false,
    isSecretCoupon: true,
    issueLimitMode: "limited",
    issueLimit: 3000,
    downloadLimitMode: "limited",
    downloadLimit: 3000,
    usageLimitMode: "limited",
    usageLimit: 1,
    validityMode: "afterIssued",
    validFrom: "2026-03-01",
    validUntil: "2026-05-31",
    expireAfterDays: 14,
    linkedMessageTemplateId: "PUSH-MAN-002",
    linkedMessageTemplateName: resolveTemplateName("PUSH-MAN-002"),
    linkedCrmCampaignId: "",
    linkedCrmCampaignName: "",
    linkedEventId: "EVT-COUPON-001",
    linkedEventName: resolveEventName("EVT-COUPON-001"),
    downloadUrl: createDownloadUrl("CPN-0001"),
    issueCount: 1280,
    downloadCount: 984,
    useCount: 462,
    lastIssuedAt: "2026-03-24 18:10",
    lastDownloadedAt: "2026-03-24 18:20",
    lastUsedAt: "2026-03-24 19:40",
    policyNotes: getCouponPolicyNotes("customerDownload", null),
    adminMemo: "채널 메시지 CTA와 연결한 시크릿 쿠폰입니다.",
    createdAt: "2026-03-01 09:10",
    updatedAt: "2026-03-24 19:40",
    updatedBy: "admin_park",
    issueAlert: {
      enabled: true,
      channel: "alimtalk",
      templateId: "PUSH-MAN-002",
      templateName: resolveTemplateName("PUSH-MAN-002"),
      timingLabel: "다운로드 즉시",
    },
    expireAlert: {
      enabled: false,
      channel: "webPush",
      templateId: "",
      templateName: "",
      timingLabel: "사용 안 함",
    },
  }),
  createSeedCoupon({
    id: "CPN-0002",
    couponName: "웰컴 쿠폰 10%",
    couponKind: "autoIssue",
    couponStatus: "진행 중",
    issueState: "정상",
    issueTargetType: null,
    targetGroupIds: [],
    targetGroupNames: [],
    targetUserIds: [],
    autoIssueTriggerType: "firstSignup",
    codeGenerationMode: null,
    couponCode: "",
    codeCount: null,
    audience: null,
    benefitType: "rateDiscount",
    benefitValue: 10,
    minOrderAmount: 15000,
    maxDiscountAmount: 10000,
    applicableScope: "allProducts",
    isStackable: false,
    isSecretCoupon: false,
    issueLimitMode: "unlimited",
    issueLimit: null,
    downloadLimitMode: "unlimited",
    downloadLimit: null,
    usageLimitMode: "limited",
    usageLimit: 1,
    validityMode: "afterIssued",
    validFrom: "2026-03-01",
    validUntil: "2026-12-31",
    expireAfterDays: 30,
    linkedMessageTemplateId: "MAIL-AUTO-001",
    linkedMessageTemplateName: resolveTemplateName("MAIL-AUTO-001"),
    linkedCrmCampaignId: "CRM-WELCOME-001",
    linkedCrmCampaignName: resolveCrmCampaignName("CRM-WELCOME-001"),
    linkedEventId: "EVT-COUPON-003",
    linkedEventName: resolveEventName("EVT-COUPON-003"),
    downloadUrl: "",
    issueCount: 820,
    downloadCount: 0,
    useCount: 314,
    lastIssuedAt: "2026-03-25 09:00",
    lastDownloadedAt: "",
    lastUsedAt: "2026-03-25 11:15",
    policyNotes: getCouponPolicyNotes("autoIssue", "firstSignup"),
    adminMemo: "첫 회원가입 자동 발행과 CRM 안내를 함께 검토합니다.",
    createdAt: "2026-03-02 11:00",
    updatedAt: "2026-03-25 11:15",
    updatedBy: "admin_kim",
    issueAlert: {
      enabled: true,
      channel: "alimtalk",
      templateId: "MAIL-AUTO-001",
      templateName: resolveTemplateName("MAIL-AUTO-001"),
      timingLabel: "발급 즉시",
    },
    expireAlert: {
      enabled: true,
      channel: "alimtalk",
      templateId: "MAIL-AUTO-002",
      templateName: resolveTemplateName("MAIL-AUTO-002"),
      timingLabel: "만료 1일 전",
    },
  }),
  createSeedCoupon({
    id: "CPN-0003",
    couponName: "생일 축하 쿠폰",
    couponKind: "autoIssue",
    couponStatus: "진행 중",
    issueState: "발행 중지",
    issueTargetType: null,
    targetGroupIds: [],
    targetGroupNames: [],
    targetUserIds: [],
    autoIssueTriggerType: "birthday",
    codeGenerationMode: null,
    couponCode: "",
    codeCount: null,
    audience: null,
    benefitType: "amountDiscount",
    benefitValue: 5000,
    minOrderAmount: 30000,
    maxDiscountAmount: null,
    applicableScope: "allProducts",
    isStackable: false,
    isSecretCoupon: false,
    issueLimitMode: "unlimited",
    issueLimit: null,
    downloadLimitMode: "unlimited",
    downloadLimit: null,
    usageLimitMode: "limited",
    usageLimit: 1,
    validityMode: "afterIssued",
    validFrom: "2026-02-01",
    validUntil: "2026-12-31",
    expireAfterDays: 7,
    linkedMessageTemplateId: "",
    linkedMessageTemplateName: "",
    linkedCrmCampaignId: "",
    linkedCrmCampaignName: "",
    linkedEventId: "",
    linkedEventName: "",
    downloadUrl: "",
    issueCount: 105,
    downloadCount: 0,
    useCount: 24,
    lastIssuedAt: "2026-03-10 00:10",
    lastDownloadedAt: "",
    lastUsedAt: "2026-03-12 14:55",
    policyNotes: getCouponPolicyNotes("autoIssue", "birthday"),
    adminMemo:
      "생년월일 입력 회원이 많아 발행 재개 전 데이터 수집 정책 검토가 필요합니다.",
    createdAt: "2026-02-01 09:00",
    updatedAt: "2026-03-18 12:10",
    updatedBy: "admin_lee",
    issueAlert: {
      enabled: false,
      channel: "alimtalk",
      templateId: "",
      templateName: "",
      timingLabel: "사용 안 함",
    },
    expireAlert: {
      enabled: true,
      channel: "webPush",
      templateId: "",
      templateName: "",
      timingLabel: "만료 1일 전",
    },
  }),
  createSeedCoupon({
    id: "CPN-0004",
    couponName: "인플루언서 전용 코드",
    couponKind: "couponCode",
    couponStatus: "진행 중",
    issueState: "정상",
    issueTargetType: null,
    targetGroupIds: [],
    targetGroupNames: [],
    targetUserIds: [],
    autoIssueTriggerType: null,
    codeGenerationMode: "single",
    couponCode: "TOPIKTEST01",
    codeCount: 1,
    audience: "memberAndGuest",
    benefitType: "amountDiscount",
    benefitValue: 2000,
    minOrderAmount: 15000,
    maxDiscountAmount: null,
    applicableScope: "allProducts",
    isStackable: false,
    isSecretCoupon: false,
    issueLimitMode: "unlimited",
    issueLimit: null,
    downloadLimitMode: "unlimited",
    downloadLimit: null,
    usageLimitMode: "limited",
    usageLimit: 1,
    validityMode: "fixedDate",
    validFrom: "2026-03-20",
    validUntil: "2026-04-20",
    expireAfterDays: null,
    linkedMessageTemplateId: "",
    linkedMessageTemplateName: "",
    linkedCrmCampaignId: "",
    linkedCrmCampaignName: "",
    linkedEventId: "",
    linkedEventName: "",
    downloadUrl: "",
    issueCount: 84,
    downloadCount: 0,
    useCount: 27,
    lastIssuedAt: "",
    lastDownloadedAt: "",
    lastUsedAt: "2026-03-24 20:05",
    policyNotes: getCouponPolicyNotes("couponCode", null),
    adminMemo:
      "전용 코드 오용 방지를 위해 대상별 코드 수정은 허용하지 않습니다.",
    createdAt: "2026-03-20 13:00",
    updatedAt: "2026-03-24 20:05",
    updatedBy: "admin_park",
    issueAlert: {
      enabled: false,
      channel: "webPush",
      templateId: "",
      templateName: "",
      timingLabel: "사용 안 함",
    },
    expireAlert: {
      enabled: false,
      channel: "webPush",
      templateId: "",
      templateName: "",
      timingLabel: "사용 안 함",
    },
  }),
  createSeedCoupon({
    id: "CPN-0005",
    couponName: "리텐션 타깃 재구매 쿠폰",
    couponKind: "manualIssue",
    couponStatus: "대기",
    issueState: "정상",
    issueTargetType: "specificGroup",
    targetGroupIds: ["GRP-002"],
    targetGroupNames: resolveGroupNames(["GRP-002"]),
    targetUserIds: [],
    autoIssueTriggerType: null,
    codeGenerationMode: null,
    couponCode: "",
    codeCount: null,
    audience: null,
    benefitType: "amountDiscount",
    benefitValue: 4000,
    minOrderAmount: 20000,
    maxDiscountAmount: null,
    applicableScope: "allProducts",
    isStackable: true,
    isSecretCoupon: false,
    issueLimitMode: "limited",
    issueLimit: 1000,
    downloadLimitMode: "unlimited",
    downloadLimit: null,
    usageLimitMode: "limited",
    usageLimit: 1,
    validityMode: "fixedDate",
    validFrom: "2026-03-28",
    validUntil: "2026-04-05",
    expireAfterDays: null,
    linkedMessageTemplateId: "PUSH-AUTO-001",
    linkedMessageTemplateName: resolveTemplateName("PUSH-AUTO-001"),
    linkedCrmCampaignId: "CRM-MANUAL-001",
    linkedCrmCampaignName: resolveCrmCampaignName("CRM-MANUAL-001"),
    linkedEventId: "EVT-COUPON-002",
    linkedEventName: resolveEventName("EVT-COUPON-002"),
    downloadUrl: "",
    issueCount: 0,
    downloadCount: 0,
    useCount: 0,
    lastIssuedAt: "",
    lastDownloadedAt: "",
    lastUsedAt: "",
    policyNotes: getCouponPolicyNotes("manualIssue", null),
    adminMemo: "최근 구매 제외 그룹에만 발행 예정입니다.",
    createdAt: "2026-03-24 16:10",
    updatedAt: "2026-03-24 16:10",
    updatedBy: "admin_kim",
    issueAlert: {
      enabled: true,
      channel: "webPush",
      templateId: "",
      templateName: "",
      timingLabel: "발급 즉시",
    },
    expireAlert: {
      enabled: true,
      channel: "alimtalk",
      templateId: "MAIL-AUTO-002",
      templateName: resolveTemplateName("MAIL-AUTO-002"),
      timingLabel: "만료 1일 전",
    },
  }),
  createSeedCoupon({
    id: "CPN-0006",
    couponName: "장바구니 리마인드 쿠폰",
    couponKind: "customerDownload",
    couponStatus: "종료",
    issueState: "정상",
    issueTargetType: "allMembers",
    targetGroupIds: [],
    targetGroupNames: [],
    targetUserIds: [],
    autoIssueTriggerType: null,
    codeGenerationMode: null,
    couponCode: "",
    codeCount: null,
    audience: null,
    benefitType: "amountDiscount",
    benefitValue: 1000,
    minOrderAmount: 5000,
    maxDiscountAmount: null,
    applicableScope: "allProducts",
    isStackable: false,
    isSecretCoupon: true,
    issueLimitMode: "unlimited",
    issueLimit: null,
    downloadLimitMode: "unlimited",
    downloadLimit: null,
    usageLimitMode: "limited",
    usageLimit: 1,
    validityMode: "afterIssued",
    validFrom: "2026-03-01",
    validUntil: "2026-03-20",
    expireAfterDays: 3,
    linkedMessageTemplateId: "PUSH-MAN-001",
    linkedMessageTemplateName: resolveTemplateName("PUSH-MAN-001"),
    linkedCrmCampaignId: "CRM-CART-001",
    linkedCrmCampaignName: resolveCrmCampaignName("CRM-CART-001"),
    linkedEventId: "",
    linkedEventName: "",
    downloadUrl: createDownloadUrl("CPN-0006"),
    issueCount: 620,
    downloadCount: 410,
    useCount: 188,
    lastIssuedAt: "2026-03-19 22:30",
    lastDownloadedAt: "2026-03-20 00:05",
    lastUsedAt: "2026-03-20 11:20",
    policyNotes: getCouponPolicyNotes("customerDownload", null),
    adminMemo: "종료된 쿠폰이지만 운영 비교용으로 기록해 둡니다.",
    createdAt: "2026-03-01 18:20",
    updatedAt: "2026-03-20 11:20",
    updatedBy: "admin_park",
    issueAlert: {
      enabled: true,
      channel: "alimtalk",
      templateId: "PUSH-MAN-001",
      templateName: resolveTemplateName("PUSH-MAN-001"),
      timingLabel: "발급 즉시",
    },
    expireAlert: {
      enabled: false,
      channel: "webPush",
      templateId: "",
      templateName: "",
      timingLabel: "사용 안 함",
    },
  }),
];

const initialSubscriptionTemplates: CommerceCouponSubscriptionTemplate[] = [
  {
    id: "CPT-0001",
    templateName: "웰컴 회원 정기 쿠폰",
    issueTargetType: "shoppingGrade",
    targetGradeIds: ["SHOP-GRADE-WELCOME"],
    targetGradeNames: resolveCouponTemplateShoppingGradeNames([
      "SHOP-GRADE-WELCOME",
    ]),
    benefitType: "amountDiscount",
    benefitValue: 3000,
    minOrderAmount: 10000,
    maxDiscountAmount: null,
    applicableScope: "allProducts",
    applicableScopeReferenceIds: [],
    applicableScopeReferenceNames: [],
    excludedProductMode: "none",
    excludedProductIds: [],
    excludedProductNames: [],
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
    status: "진행 중",
    issuedCouponCount: 1820,
    lastIssuedAt: "2026-03-01 07:00",
    nextIssuedAt: "2026-04-01 07:00",
    issueAlertEnabled: true,
    expireAlertEnabled: false,
    alertChannel: "webAppPush",
    adminMemo: "웰컴 등급 대상 리텐션 쿠폰입니다.",
    policyNotes: getCouponTemplatePolicyNotes(["SHOP-GRADE-WELCOME"]),
    createdAt: "2026-01-02 10:30",
    updatedAt: "2026-03-24 14:10",
    updatedBy: "admin_kim",
  },
  {
    id: "CPT-0002",
    templateName: "VIP 재구매 유도 쿠폰",
    issueTargetType: "shoppingGrade",
    targetGradeIds: ["SHOP-GRADE-VIP"],
    targetGradeNames: resolveCouponTemplateShoppingGradeNames([
      "SHOP-GRADE-VIP",
    ]),
    benefitType: "rateDiscount",
    benefitValue: 12,
    minOrderAmount: 30000,
    maxDiscountAmount: 15000,
    applicableScope: "specificCategory",
    applicableScopeReferenceIds: ["CAT-TOPIK-READING", "CAT-TOPIK-SPEAKING"],
    applicableScopeReferenceNames: resolveCouponTemplateCategoryNames([
      "CAT-TOPIK-READING",
      "CAT-TOPIK-SPEAKING",
    ]),
    excludedProductMode: "specific",
    excludedProductIds: ["PRD-COURSE-003"],
    excludedProductNames: resolveCouponTemplateProductNames(["PRD-COURSE-003"]),
    isStackable: true,
    issueSchedule: {
      dayOfMonth: 1,
      hour: 7,
      minute: 0,
    },
    usageEndSchedule: {
      dayOfMonth: 21,
      hour: 23,
      minute: 30,
    },
    status: "발행 중지",
    issuedCouponCount: 420,
    lastIssuedAt: "2026-02-01 07:00",
    nextIssuedAt: "2026-04-01 07:00",
    issueAlertEnabled: true,
    expireAlertEnabled: true,
    alertChannel: "webAppPush",
    adminMemo:
      "VIP 등급 전환 프로모션과 겹치지 않도록 3월 발행을 중지했습니다.",
    policyNotes: getCouponTemplatePolicyNotes(["SHOP-GRADE-VIP"]),
    createdAt: "2026-01-10 09:20",
    updatedAt: "2026-03-10 18:05",
    updatedBy: "admin_park",
  },
];

const initialCouponAudits: CouponAuditEvent[] = [
  {
    id: "AL-CPN-0001",
    targetType: "CommerceCouponTemplate",
    targetId: "CPT-0002",
    action: "정기 쿠폰 템플릿 발행 중지",
    reason: "VIP 재구매 유도 쿠폰과 등급 전환 프로모션 중복 검토",
    changedBy: "admin_park",
    createdAt: "2026-03-10 18:05",
  },
];

export const useCouponStore = create<CouponStore>((set, get) => ({
  planTier: "pro",
  coupons: initialCoupons,
  subscriptionTemplates: initialSubscriptionTemplates,
  audits: initialCouponAudits,
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
      issueState: "諛쒗뻾 以묒?",
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
      status: "諛쒗뻾 以묒?",
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
      status: "吏꾪뻾 以?,
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


