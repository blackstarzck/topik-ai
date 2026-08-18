import {
  getCouponTemplatePolicyNotes,
  resolveCouponTemplateCategoryNames,
  resolveCouponTemplateProductNames,
  resolveCouponTemplateShoppingGradeNames
} from '../model/coupon-template-form-schema';
import type {
  CommerceCouponSubscriptionTemplate,
  CouponTemplateStatus
} from '../model/coupon-template-types';
import { getCouponPolicyNotes } from '../model/coupon-form-schema';
import type {
  CommerceCoupon,
  CouponIssueState,
  CouponStatus
} from '../model/coupon-types';
import type {
  CouponSavePayload,
  CouponTemplateSavePayload
} from '../model/coupon-store';
import { filterStringArray as toStringArray, requireClient, requireReason, throwIfAborted } from '@/shared/api/supabase-service-utils';
import { toDateOnly as toDate, toDateTimeMinutes as toDateTime } from '@/shared/model/date-format';

type CouponActionPayload = {
  couponId: string;
  reason?: string;
};

type CouponTemplateActionPayload = {
  templateId: string;
  reason?: string;
};

type CouponRow = {
  id: string;
  coupon_name: string;
  coupon_kind: string;
  coupon_status: string;
  issue_state: string;
  issue_target_type: string | null;
  target_group_ids: unknown;
  target_group_names: unknown;
  target_user_ids: unknown;
  auto_issue_trigger_type: string | null;
  code_generation_mode: string | null;
  coupon_code: string | null;
  code_count: number | null;
  audience: string | null;
  benefit_type: string;
  benefit_value: number;
  min_order_amount: number;
  max_discount_amount: number | null;
  applicable_scope: string;
  applicable_scope_reference_ids: unknown;
  excluded_product_ids: unknown;
  is_stackable: boolean;
  is_secret_coupon: boolean;
  issue_limit_mode: string;
  issue_limit: number | null;
  download_limit_mode: string;
  download_limit: number | null;
  usage_limit_mode: string;
  usage_limit: number | null;
  validity_mode: string;
  valid_from: string | null;
  valid_until: string | null;
  expire_after_days: number | null;
  linked_message_template_id: string | null;
  linked_message_template_name: string | null;
  linked_crm_campaign_id: string | null;
  linked_crm_campaign_name: string | null;
  linked_event_id: string | null;
  linked_event_name: string | null;
  download_url: string | null;
  issue_count: number;
  download_count: number;
  use_count: number;
  last_issued_at: string | null;
  last_downloaded_at: string | null;
  last_used_at: string | null;
  policy_notes: unknown;
  admin_memo: string | null;
  issue_alert: unknown;
  expire_alert: unknown;
  created_at: string | null;
  updated_at: string | null;
  updated_by: string | null;
};

type CouponTemplateRow = {
  id: string;
  template_name: string;
  issue_target_type: string;
  target_grade_ids: unknown;
  target_grade_names: unknown;
  benefit_type: string;
  benefit_value: number;
  min_order_amount: number;
  max_discount_amount: number | null;
  applicable_scope: string;
  applicable_scope_reference_ids: unknown;
  applicable_scope_reference_names: unknown;
  excluded_product_mode: string;
  excluded_product_ids: unknown;
  excluded_product_names: unknown;
  is_stackable: boolean;
  issue_schedule: unknown;
  usage_end_schedule: unknown;
  status: string;
  issued_coupon_count: number;
  last_issued_at: string | null;
  next_issued_at: string | null;
  issue_alert_enabled: boolean;
  expire_alert_enabled: boolean;
  alert_channel: string;
  admin_memo: string | null;
  policy_notes: unknown;
  created_at: string | null;
  updated_at: string | null;
  updated_by: string | null;
};

const COUPON_COLUMNS = [
  'id',
  'coupon_name',
  'coupon_kind',
  'coupon_status',
  'issue_state',
  'issue_target_type',
  'target_group_ids',
  'target_group_names',
  'target_user_ids',
  'auto_issue_trigger_type',
  'code_generation_mode',
  'coupon_code',
  'code_count',
  'audience',
  'benefit_type',
  'benefit_value',
  'min_order_amount',
  'max_discount_amount',
  'applicable_scope',
  'applicable_scope_reference_ids',
  'excluded_product_ids',
  'is_stackable',
  'is_secret_coupon',
  'issue_limit_mode',
  'issue_limit',
  'download_limit_mode',
  'download_limit',
  'usage_limit_mode',
  'usage_limit',
  'validity_mode',
  'valid_from',
  'valid_until',
  'expire_after_days',
  'linked_message_template_id',
  'linked_message_template_name',
  'linked_crm_campaign_id',
  'linked_crm_campaign_name',
  'linked_event_id',
  'linked_event_name',
  'download_url',
  'issue_count',
  'download_count',
  'use_count',
  'last_issued_at',
  'last_downloaded_at',
  'last_used_at',
  'policy_notes',
  'admin_memo',
  'issue_alert',
  'expire_alert',
  'created_at',
  'updated_at',
  'updated_by'
].join(', ');

const TEMPLATE_COLUMNS = [
  'id',
  'template_name',
  'issue_target_type',
  'target_grade_ids',
  'target_grade_names',
  'benefit_type',
  'benefit_value',
  'min_order_amount',
  'max_discount_amount',
  'applicable_scope',
  'applicable_scope_reference_ids',
  'applicable_scope_reference_names',
  'excluded_product_mode',
  'excluded_product_ids',
  'excluded_product_names',
  'is_stackable',
  'issue_schedule',
  'usage_end_schedule',
  'status',
  'issued_coupon_count',
  'last_issued_at',
  'next_issued_at',
  'issue_alert_enabled',
  'expire_alert_enabled',
  'alert_channel',
  'admin_memo',
  'policy_notes',
  'created_at',
  'updated_at',
  'updated_by'
].join(', ');

const DB_COUPON_STATUS_BY_UI: Record<CouponStatus, string> = {
  대기: 'waiting',
  '진행 중': 'active',
  종료: 'ended'
};

const UI_COUPON_STATUS_BY_DB: Record<string, CouponStatus> = {
  waiting: '대기',
  active: '진행 중',
  ended: '종료'
};

const DB_ISSUE_STATE_BY_UI: Record<CouponIssueState, string> = {
  정상: 'normal',
  '발행 중지': 'paused'
};

const UI_ISSUE_STATE_BY_DB: Record<string, CouponIssueState> = {
  normal: '정상',
  paused: '발행 중지'
};

const DB_TEMPLATE_STATUS_BY_UI: Record<CouponTemplateStatus, string> = {
  '진행 중': 'active',
  '발행 중지': 'paused'
};

const UI_TEMPLATE_STATUS_BY_DB: Record<string, CouponTemplateStatus> = {
  active: '진행 중',
  paused: '발행 중지'
};

function toSchedule(value: unknown): {
  dayOfMonth: number;
  hour: number;
  minute: number;
} {
  if (!value || typeof value !== 'object') {
    return { dayOfMonth: 1, hour: 7, minute: 0 };
  }

  const record = value as Record<string, unknown>;
  return {
    dayOfMonth: Number(record.dayOfMonth ?? 1),
    hour: Number(record.hour ?? 7),
    minute: Number(record.minute ?? 0)
  };
}

function mapCouponRow(row: CouponRow): CommerceCoupon {
  const couponKind = row.coupon_kind as CommerceCoupon['couponKind'];
  const autoIssueTriggerType =
    row.auto_issue_trigger_type as CommerceCoupon['autoIssueTriggerType'];

  return {
    id: row.id,
    couponName: row.coupon_name,
    couponKind,
    couponStatus: UI_COUPON_STATUS_BY_DB[row.coupon_status] ?? '대기',
    issueState: UI_ISSUE_STATE_BY_DB[row.issue_state] ?? '정상',
    issueTargetType:
      row.issue_target_type as CommerceCoupon['issueTargetType'],
    targetGroupIds: toStringArray(row.target_group_ids),
    targetGroupNames: toStringArray(row.target_group_names),
    targetUserIds: toStringArray(row.target_user_ids),
    autoIssueTriggerType,
    codeGenerationMode:
      row.code_generation_mode as CommerceCoupon['codeGenerationMode'],
    couponCode: row.coupon_code ?? '',
    codeCount: row.code_count,
    audience: row.audience as CommerceCoupon['audience'],
    benefitType: row.benefit_type as CommerceCoupon['benefitType'],
    benefitValue: row.benefit_value,
    minOrderAmount: row.min_order_amount,
    maxDiscountAmount: row.max_discount_amount,
    applicableScope: row.applicable_scope as CommerceCoupon['applicableScope'],
    isStackable: row.is_stackable,
    isSecretCoupon: row.is_secret_coupon,
    issueLimitMode: row.issue_limit_mode as CommerceCoupon['issueLimitMode'],
    issueLimit: row.issue_limit,
    downloadLimitMode:
      row.download_limit_mode as CommerceCoupon['downloadLimitMode'],
    downloadLimit: row.download_limit,
    usageLimitMode: row.usage_limit_mode as CommerceCoupon['usageLimitMode'],
    usageLimit: row.usage_limit,
    validityMode: row.validity_mode as CommerceCoupon['validityMode'],
    validFrom: toDate(row.valid_from),
    validUntil: toDate(row.valid_until),
    expireAfterDays: row.expire_after_days,
    linkedMessageTemplateId: row.linked_message_template_id ?? '',
    linkedMessageTemplateName: row.linked_message_template_name ?? '',
    linkedCrmCampaignId: row.linked_crm_campaign_id ?? '',
    linkedCrmCampaignName: row.linked_crm_campaign_name ?? '',
    linkedEventId: row.linked_event_id ?? '',
    linkedEventName: row.linked_event_name ?? '',
    downloadUrl: row.download_url ?? '',
    issueCount: row.issue_count,
    downloadCount: row.download_count,
    useCount: row.use_count,
    lastIssuedAt: toDateTime(row.last_issued_at),
    lastDownloadedAt: toDateTime(row.last_downloaded_at),
    lastUsedAt: toDateTime(row.last_used_at),
    policyNotes: toStringArray(row.policy_notes).length
      ? toStringArray(row.policy_notes)
      : getCouponPolicyNotes(couponKind, autoIssueTriggerType),
    adminMemo: row.admin_memo ?? '',
    createdAt: toDateTime(row.created_at),
    updatedAt: toDateTime(row.updated_at ?? row.created_at),
    updatedBy: row.updated_by ?? 'system',
    issueAlert: {
      enabled: Boolean((row.issue_alert as { enabled?: unknown })?.enabled),
      channel:
        ((row.issue_alert as { channel?: CommerceCoupon['issueAlert']['channel'] })
          ?.channel as CommerceCoupon['issueAlert']['channel']) ?? 'alimtalk',
      templateId: String((row.issue_alert as { templateId?: unknown })?.templateId ?? ''),
      templateName: String((row.issue_alert as { templateName?: unknown })?.templateName ?? ''),
      timingLabel: String((row.issue_alert as { timingLabel?: unknown })?.timingLabel ?? '')
    },
    expireAlert: {
      enabled: Boolean((row.expire_alert as { enabled?: unknown })?.enabled),
      channel:
        ((row.expire_alert as { channel?: CommerceCoupon['expireAlert']['channel'] })
          ?.channel as CommerceCoupon['expireAlert']['channel']) ?? 'webPush',
      templateId: String((row.expire_alert as { templateId?: unknown })?.templateId ?? ''),
      templateName: String((row.expire_alert as { templateName?: unknown })?.templateName ?? ''),
      timingLabel: String((row.expire_alert as { timingLabel?: unknown })?.timingLabel ?? '')
    }
  };
}

function mapTemplateRow(
  row: CouponTemplateRow
): CommerceCouponSubscriptionTemplate {
  const targetGradeIds = toStringArray(row.target_grade_ids);
  const applicableScope =
    row.applicable_scope as CommerceCouponSubscriptionTemplate['applicableScope'];
  const referenceIds = toStringArray(row.applicable_scope_reference_ids);
  const excludedProductIds = toStringArray(row.excluded_product_ids);

  return {
    id: row.id,
    templateName: row.template_name,
    issueTargetType: 'shoppingGrade',
    targetGradeIds,
    targetGradeNames: toStringArray(row.target_grade_names).length
      ? toStringArray(row.target_grade_names)
      : resolveCouponTemplateShoppingGradeNames(targetGradeIds),
    benefitType: row.benefit_type as CommerceCouponSubscriptionTemplate['benefitType'],
    benefitValue: row.benefit_value,
    minOrderAmount: row.min_order_amount,
    maxDiscountAmount: row.max_discount_amount,
    applicableScope,
    applicableScopeReferenceIds: referenceIds,
    applicableScopeReferenceNames: toStringArray(
      row.applicable_scope_reference_names
    ).length
      ? toStringArray(row.applicable_scope_reference_names)
      : applicableScope === 'specificCategory'
        ? resolveCouponTemplateCategoryNames(referenceIds)
        : applicableScope === 'specificProduct'
          ? resolveCouponTemplateProductNames(referenceIds)
          : [],
    excludedProductMode:
      row.excluded_product_mode as CommerceCouponSubscriptionTemplate['excludedProductMode'],
    excludedProductIds,
    excludedProductNames: toStringArray(row.excluded_product_names).length
      ? toStringArray(row.excluded_product_names)
      : resolveCouponTemplateProductNames(excludedProductIds),
    isStackable: row.is_stackable,
    issueSchedule: toSchedule(row.issue_schedule),
    usageEndSchedule: toSchedule(row.usage_end_schedule),
    status: UI_TEMPLATE_STATUS_BY_DB[row.status] ?? '진행 중',
    issuedCouponCount: row.issued_coupon_count,
    lastIssuedAt: toDateTime(row.last_issued_at),
    nextIssuedAt: toDateTime(row.next_issued_at),
    issueAlertEnabled: row.issue_alert_enabled,
    expireAlertEnabled: row.expire_alert_enabled,
    alertChannel:
      row.alert_channel as CommerceCouponSubscriptionTemplate['alertChannel'],
    adminMemo: row.admin_memo ?? '',
    policyNotes: toStringArray(row.policy_notes).length
      ? toStringArray(row.policy_notes)
      : getCouponTemplatePolicyNotes(targetGradeIds),
    createdAt: toDateTime(row.created_at),
    updatedAt: toDateTime(row.updated_at ?? row.created_at),
    updatedBy: row.updated_by ?? 'system'
  };
}

async function loadCoupon(couponId: string): Promise<CommerceCoupon> {
  const client = requireClient();
  const { data, error } = await client
    .from('commerce_coupons')
    .select(COUPON_COLUMNS)
    .eq('id', couponId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error('쿠폰 대상을 찾을 수 없습니다.');
  return mapCouponRow(data as unknown as CouponRow);
}

async function loadTemplate(
  templateId: string
): Promise<CommerceCouponSubscriptionTemplate> {
  const client = requireClient();
  const { data, error } = await client
    .from('commerce_coupon_subscription_templates')
    .select(TEMPLATE_COLUMNS)
    .eq('id', templateId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error('정기 쿠폰 템플릿을 찾을 수 없습니다.');
  return mapTemplateRow(data as unknown as CouponTemplateRow);
}

export async function loadCouponsFromSupabase(
  signal?: AbortSignal
): Promise<CommerceCoupon[]> {
  const client = requireClient();
  const { data, error } = await client
    .from('commerce_coupons')
    .select(COUPON_COLUMNS)
    .order('updated_at', { ascending: false });

  throwIfAborted(signal);
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as CouponRow[]).map(mapCouponRow);
}

export async function loadCouponFromSupabase(
  couponId: string,
  signal?: AbortSignal
): Promise<CommerceCoupon> {
  const coupon = await loadCoupon(couponId);
  throwIfAborted(signal);
  return coupon;
}

export async function saveCouponViaRpc(
  payload: CouponSavePayload
): Promise<CommerceCoupon> {
  const client = requireClient();
  const { data, error } = await client.rpc('admin_save_commerce_coupon', {
    p_id: payload.id ?? null,
    p_coupon: {
      coupon_name: payload.couponName,
      coupon_kind: payload.couponKind,
      coupon_status: DB_COUPON_STATUS_BY_UI[payload.couponStatus],
      issue_state: DB_ISSUE_STATE_BY_UI[payload.issueState],
      issue_target_type: payload.issueTargetType,
      target_group_ids: payload.targetGroupIds,
      target_user_ids: payload.targetUserIds,
      auto_issue_trigger_type: payload.autoIssueTriggerType,
      code_generation_mode: payload.codeGenerationMode,
      coupon_code: payload.couponCode,
      code_count: payload.codeCount,
      audience: payload.audience,
      benefit_type: payload.benefitType,
      benefit_value: payload.benefitValue,
      min_order_amount: payload.minOrderAmount,
      max_discount_amount: payload.maxDiscountAmount,
      applicable_scope: payload.applicableScope,
      is_stackable: payload.isStackable,
      is_secret_coupon: payload.isSecretCoupon,
      issue_limit_mode: payload.issueLimitMode,
      issue_limit: payload.issueLimit,
      download_limit_mode: payload.downloadLimitMode,
      download_limit: payload.downloadLimit,
      usage_limit_mode: payload.usageLimitMode,
      usage_limit: payload.usageLimit,
      validity_mode: payload.validityMode,
      valid_from: payload.validFrom || null,
      valid_until: payload.validUntil || null,
      expire_after_days: payload.expireAfterDays,
      linked_message_template_id: payload.linkedMessageTemplateId,
      linked_crm_campaign_id: payload.linkedCrmCampaignId,
      linked_event_id: payload.linkedEventId,
      admin_memo: payload.adminMemo,
      issue_alert: payload.issueAlert,
      expire_alert: payload.expireAlert
    },
    p_reason: payload.id ? '쿠폰 등록 상세에서 수정' : '쿠폰 등록 상세에서 생성'
  });

  if (error) throw new Error(error.message);
  return loadCoupon(String(data));
}

export async function duplicateCouponViaRpc(
  payload: CouponActionPayload
): Promise<CommerceCoupon> {
  const client = requireClient();
  const { data, error } = await client.rpc('admin_duplicate_commerce_coupon', {
    p_coupon_id: payload.couponId,
    p_reason: requireReason(payload.reason)
  });

  if (error) throw new Error(error.message);
  return loadCoupon(String(data));
}

export async function setCouponIssueStateViaRpc(
  payload: CouponActionPayload,
  state: 'paused' | 'normal'
): Promise<CommerceCoupon> {
  const client = requireClient();
  const { error } = await client.rpc('admin_set_commerce_coupon_issue_state', {
    p_coupon_id: payload.couponId,
    p_state: state,
    p_reason: requireReason(payload.reason)
  });

  if (error) throw new Error(error.message);
  return loadCoupon(payload.couponId);
}

export async function deleteCouponViaRpc(
  payload: CouponActionPayload
): Promise<CommerceCoupon> {
  const coupon = await loadCoupon(payload.couponId);
  const client = requireClient();
  const { error } = await client.rpc('admin_delete_commerce_coupon', {
    p_coupon_id: payload.couponId,
    p_reason: requireReason(payload.reason)
  });

  if (error) throw new Error(error.message);
  return coupon;
}

export async function loadCouponTemplatesFromSupabase(
  signal?: AbortSignal
): Promise<CommerceCouponSubscriptionTemplate[]> {
  const client = requireClient();
  const { data, error } = await client
    .from('commerce_coupon_subscription_templates')
    .select(TEMPLATE_COLUMNS)
    .order('updated_at', { ascending: false });

  throwIfAborted(signal);
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as CouponTemplateRow[]).map(mapTemplateRow);
}

export async function loadCouponTemplateFromSupabase(
  templateId: string,
  signal?: AbortSignal
): Promise<CommerceCouponSubscriptionTemplate> {
  const template = await loadTemplate(templateId);
  throwIfAborted(signal);
  return template;
}

export async function saveCouponTemplateViaRpc(
  payload: CouponTemplateSavePayload
): Promise<CommerceCouponSubscriptionTemplate> {
  const client = requireClient();
  const { data, error } = await client.rpc(
    'admin_save_commerce_coupon_template',
    {
      p_id: payload.id ?? null,
      p_template: {
        template_name: payload.templateName,
        target_grade_ids: payload.targetGradeIds,
        benefit_type: payload.benefitType,
        benefit_value: payload.benefitValue,
        min_order_amount: payload.minOrderAmount,
        max_discount_amount: payload.maxDiscountAmount,
        applicable_scope: payload.applicableScope,
        applicable_scope_reference_ids: payload.applicableScopeReferenceIds,
        excluded_product_mode: payload.excludedProductMode,
        excluded_product_ids: payload.excludedProductIds,
        is_stackable: payload.isStackable,
        issue_schedule: payload.issueSchedule,
        usage_end_schedule: payload.usageEndSchedule,
        status: DB_TEMPLATE_STATUS_BY_UI[payload.status],
        issue_alert_enabled: payload.issueAlertEnabled,
        expire_alert_enabled: payload.expireAlertEnabled,
        alert_channel: payload.alertChannel,
        admin_memo: payload.adminMemo
      },
      p_reason: payload.id
        ? '정기 쿠폰 템플릿 등록 상세에서 수정'
        : '정기 쿠폰 템플릿 등록 상세에서 생성'
    }
  );

  if (error) throw new Error(error.message);
  return loadTemplate(String(data));
}

export async function setCouponTemplateStatusViaRpc(
  payload: CouponTemplateActionPayload,
  status: 'active' | 'paused'
): Promise<CommerceCouponSubscriptionTemplate> {
  const client = requireClient();
  const { error } = await client.rpc(
    'admin_set_commerce_coupon_template_status',
    {
      p_template_id: payload.templateId,
      p_status: status,
      p_reason: requireReason(payload.reason)
    }
  );

  if (error) throw new Error(error.message);
  return loadTemplate(payload.templateId);
}

export async function deleteCouponTemplateViaRpc(
  payload: CouponTemplateActionPayload
): Promise<CommerceCouponSubscriptionTemplate> {
  const template = await loadTemplate(payload.templateId);
  const client = requireClient();
  const { error } = await client.rpc(
    'admin_delete_commerce_coupon_template',
    {
      p_template_id: payload.templateId,
      p_reason: requireReason(payload.reason)
    }
  );

  if (error) throw new Error(error.message);
  return template;
}
