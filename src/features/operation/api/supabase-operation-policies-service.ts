import {
  operationPolicyCategoryValues,
  operationPolicyExposureSurfaceValues,
  operationPolicyRelatedAdminPageValues,
  operationPolicyRelatedUserPageValues,
  operationPolicyTrackingStatusValues,
  operationPolicyTypeValues,
  type OperationPolicy,
  type OperationPolicyExposureSurface,
  type OperationPolicyHistoryEntry,
  type OperationPolicyRelatedAdminPage,
  type OperationPolicyRelatedUserPage,
  type OperationPolicyStatus
} from '../model/policy-types';
import type {
  DeletePolicyPayload,
  PublishPolicyHistoryVersionPayload,
  SavePolicyPayload,
  TogglePolicyStatusPayload
} from './policies-service';
import { requireClient, requireReason, throwIfAborted } from '@/shared/api/supabase-service-utils';
import { toDateOnly as toDate, toDateTimeMinutes as toDateTime } from '@/shared/model/date-format';

type OperationPolicyRow = {
  id: string;
  category: string;
  policy_type: string;
  title: string;
  version_label: string | null;
  effective_date: string | null;
  exposure_surfaces: unknown;
  requires_consent: boolean | null;
  tracking_status: string | null;
  status: string;
  related_admin_pages: unknown;
  related_user_pages: unknown;
  source_documents: unknown;
  legal_references: unknown;
  summary: string | null;
  body_html: string;
  title_en: string | null;
  body_html_en: string | null;
  summary_en: string | null;
  admin_memo: string | null;
  current_version_id: string | null;
  created_at: string | null;
  updated_at: string | null;
  updated_by: string | null;
};

type OperationPolicyHistoryRow = {
  id: string;
  policy_id: string;
  action: OperationPolicyHistoryEntry['action'];
  version_label: string | null;
  changed_at: string | null;
  changed_by: string | null;
  snapshot: unknown;
};

const DB_POLICY_STATUS_BY_UI: Record<OperationPolicyStatus, string> = {
  게시: 'published',
  숨김: 'hidden'
};

const UI_POLICY_STATUS_BY_DB: Record<string, OperationPolicyStatus> = {
  published: '게시',
  hidden: '숨김'
};

const POLICY_COLUMNS = [
  'id',
  'category',
  'policy_type',
  'title',
  'version_label',
  'effective_date',
  'exposure_surfaces',
  'requires_consent',
  'tracking_status',
  'status',
  'related_admin_pages',
  'related_user_pages',
  'source_documents',
  'legal_references',
  'summary',
  'body_html',
  'title_en',
  'body_html_en',
  'summary_en',
  'admin_memo',
  'current_version_id',
  'created_at',
  'updated_at',
  'updated_by'
].join(', ');

const POLICY_HISTORY_COLUMNS = [
  'id',
  'policy_id',
  'action',
  'version_label',
  'changed_at',
  'changed_by',
  'snapshot'
].join(', ');

function coerceValue<T extends string>(
  value: string | null | undefined,
  candidates: readonly T[],
  fallback: T
): T {
  return value && candidates.includes(value as T) ? (value as T) : fallback;
}

function parseStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === 'string');
}

function parseExposureSurfaces(value: unknown): OperationPolicyExposureSurface[] {
  return parseStringList(value).filter((item): item is OperationPolicyExposureSurface =>
    operationPolicyExposureSurfaceValues.includes(
      item as OperationPolicyExposureSurface
    )
  );
}

function parseRelatedAdminPages(value: unknown): OperationPolicyRelatedAdminPage[] {
  return parseStringList(value).filter((item): item is OperationPolicyRelatedAdminPage =>
    operationPolicyRelatedAdminPageValues.includes(
      item as OperationPolicyRelatedAdminPage
    )
  );
}

function parseRelatedUserPages(value: unknown): OperationPolicyRelatedUserPage[] {
  return parseStringList(value).filter((item): item is OperationPolicyRelatedUserPage =>
    operationPolicyRelatedUserPageValues.includes(
      item as OperationPolicyRelatedUserPage
    )
  );
}

function mapPolicyRow(row: OperationPolicyRow): OperationPolicy {
  return {
    id: row.id,
    category: coerceValue(row.category, operationPolicyCategoryValues, operationPolicyCategoryValues[0]),
    policyType: coerceValue(row.policy_type, operationPolicyTypeValues, operationPolicyTypeValues[0]),
    title: row.title,
    versionLabel: row.version_label ?? '',
    effectiveDate: toDate(row.effective_date),
    exposureSurfaces: parseExposureSurfaces(row.exposure_surfaces),
    requiresConsent: Boolean(row.requires_consent),
    trackingStatus: coerceValue(
      row.tracking_status,
      operationPolicyTrackingStatusValues,
      operationPolicyTrackingStatusValues[0]
    ),
    relatedAdminPages: parseRelatedAdminPages(row.related_admin_pages),
    relatedUserPages: parseRelatedUserPages(row.related_user_pages),
    sourceDocuments: parseStringList(row.source_documents),
    summary: row.summary ?? '',
    legalReferences: parseStringList(row.legal_references),
    bodyHtml: row.body_html,
    titleEn: row.title_en ?? '',
    bodyHtmlEn: row.body_html_en ?? '',
    summaryEn: row.summary_en ?? '',
    adminMemo: row.admin_memo ?? '',
    status: UI_POLICY_STATUS_BY_DB[row.status] ?? '숨김',
    createdAt: toDate(row.created_at),
    updatedAt: toDateTime(row.updated_at),
    updatedBy: row.updated_by ?? 'system'
  };
}

function mapPolicySnapshot(value: unknown): OperationPolicy {
  if (!value || typeof value !== 'object') {
    throw new Error('정책 이력 스냅샷 형식이 올바르지 않습니다.');
  }

  const snapshot = value as Partial<OperationPolicy>;
  return {
    id: snapshot.id ?? '',
    category: coerceValue(snapshot.category, operationPolicyCategoryValues, operationPolicyCategoryValues[0]),
    policyType: coerceValue(snapshot.policyType, operationPolicyTypeValues, operationPolicyTypeValues[0]),
    title: snapshot.title ?? '',
    versionLabel: snapshot.versionLabel ?? '',
    effectiveDate: snapshot.effectiveDate ?? '',
    exposureSurfaces: parseExposureSurfaces(snapshot.exposureSurfaces),
    requiresConsent: Boolean(snapshot.requiresConsent),
    trackingStatus: coerceValue(
      snapshot.trackingStatus,
      operationPolicyTrackingStatusValues,
      operationPolicyTrackingStatusValues[0]
    ),
    relatedAdminPages: parseRelatedAdminPages(snapshot.relatedAdminPages),
    relatedUserPages: parseRelatedUserPages(snapshot.relatedUserPages),
    sourceDocuments: parseStringList(snapshot.sourceDocuments),
    summary: snapshot.summary ?? '',
    legalReferences: parseStringList(snapshot.legalReferences),
    bodyHtml: snapshot.bodyHtml ?? '',
    adminMemo: snapshot.adminMemo ?? '',
    status: snapshot.status === '게시' ? '게시' : '숨김',
    createdAt: snapshot.createdAt ?? '',
    updatedAt: snapshot.updatedAt ?? '',
    updatedBy: snapshot.updatedBy ?? 'system'
  };
}

function mapPolicyHistoryRow(row: OperationPolicyHistoryRow): OperationPolicyHistoryEntry {
  const snapshot = mapPolicySnapshot(row.snapshot);

  return {
    id: row.id,
    policyId: row.policy_id,
    action: row.action,
    versionLabel: row.version_label ?? snapshot.versionLabel,
    status: snapshot.status,
    trackingStatus: snapshot.trackingStatus,
    changedAt: toDateTime(row.changed_at),
    changedBy: row.changed_by ?? snapshot.updatedBy,
    note: '',
    snapshot
  };
}

function defaultSavePolicyReason(payload: SavePolicyPayload): string {
  if (!payload.id) {
    return '신규 정책 저장';
  }
  return payload.mode === 'version' ? '새 정책 버전 등록' : '정책 내용 수정';
}

// 이용약관/개인정보 처리방침만 v13 사용자 측 legal_documents 로 투영(projection)한다.
const LEGAL_DOC_TYPE_BY_POLICY_TYPE: Partial<
  Record<OperationPolicy['policyType'], 'terms' | 'privacy'>
> = {
  이용약관: 'terms',
  '개인정보 처리방침': 'privacy'
};

// 발행(게시) 시점에 operation_policies(SoT) 내용을 v13 소유 RPC로 legal_documents 미러에 투영한다.
// topik-ai 는 legal_documents 를 직접 쓰지 않고 v13 소유 SECURITY DEFINER RPC만 호출(소유권 경계 준수).
async function syncLegalProjection(
  policy: OperationPolicy | null,
  signal?: AbortSignal
): Promise<void> {
  if (!policy) {
    return;
  }
  if (!LEGAL_DOC_TYPE_BY_POLICY_TYPE[policy.policyType]) {
    return;
  }
  if (policy.status !== '게시') {
    return;
  }

  const client = requireClient();
  const { error } = await client.rpc('admin_sync_legal_document_from_operation_policy', {
    p_source_policy_id: policy.id,
    p_source_policy_history_id: null,
    p_policy_type: policy.policyType,
    p_version: policy.versionLabel,
    p_effective_date: policy.effectiveDate || null,
    p_requires_consent: policy.requiresConsent,
    p_title_ko: policy.title,
    p_body_ko: policy.bodyHtml,
    p_summary_ko: policy.summary,
    p_title_en: policy.titleEn || null,
    p_body_en: policy.bodyHtmlEn || null,
    p_summary_en: policy.summaryEn || null
  });

  throwIfAborted(signal);
  if (error) {
    if (error.message.includes('immutable version conflict')) {
      throw new Error(
        '이미 게시된 동일 버전의 약관 내용은 변경할 수 없습니다. 새 버전으로 발행해 주세요.'
      );
    }
    throw new Error(`사용자 약관(legal_documents) 동기화 실패: ${error.message}`);
  }
}

export async function loadOperationPolicies(
  signal?: AbortSignal
): Promise<OperationPolicy[]> {
  const client = requireClient();
  const { data, error } = await client
    .from('operation_policies')
    .select(POLICY_COLUMNS)
    .order('created_at', { ascending: false });

  throwIfAborted(signal);
  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as unknown as OperationPolicyRow[]).map(mapPolicyRow);
}

export async function loadOperationPolicy(
  policyId: string,
  signal?: AbortSignal
): Promise<OperationPolicy | null> {
  const client = requireClient();
  const { data, error } = await client
    .from('operation_policies')
    .select(POLICY_COLUMNS)
    .eq('id', policyId)
    .maybeSingle();

  throwIfAborted(signal);
  if (error) {
    throw new Error(error.message);
  }

  return data ? mapPolicyRow(data as unknown as OperationPolicyRow) : null;
}

export async function loadOperationPolicyHistory(
  policyId: string,
  signal?: AbortSignal
): Promise<OperationPolicyHistoryEntry[]> {
  const client = requireClient();
  const { data, error } = await client
    .from('operation_policy_histories')
    .select(POLICY_HISTORY_COLUMNS)
    .eq('policy_id', policyId)
    .order('changed_at', { ascending: false });

  throwIfAborted(signal);
  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as unknown as OperationPolicyHistoryRow[]).map(
    mapPolicyHistoryRow
  );
}

export async function saveOperationPolicy(
  payload: SavePolicyPayload,
  signal?: AbortSignal
): Promise<OperationPolicy> {
  const client = requireClient();
  const reason = requireReason(payload.reason ?? defaultSavePolicyReason(payload));

  const { data, error } = await client.rpc('admin_save_operation_policy', {
    p_id: payload.id ?? null,
    p_policy: {
      category: payload.category,
      policy_type: payload.policyType,
      title: payload.title,
      version_label: payload.versionLabel,
      effective_date: payload.effectiveDate,
      exposure_surfaces: payload.exposureSurfaces,
      requires_consent: payload.requiresConsent,
      tracking_status: payload.trackingStatus,
      related_admin_pages: payload.relatedAdminPages,
      related_user_pages: payload.relatedUserPages,
      source_documents: payload.sourceDocuments,
      legal_references: payload.legalReferences,
      summary: payload.summary,
      body_html: payload.bodyHtml,
      admin_memo: payload.adminMemo,
      mode: payload.mode
    },
    p_reason: reason
  });

  throwIfAborted(signal);
  if (error) {
    throw new Error(error.message);
  }

  const saved = await loadOperationPolicy(String(data), signal);
  if (!saved) {
    throw new Error('저장된 정책을 다시 불러오지 못했습니다.');
  }
  return saved;
}

export async function setOperationPolicyStatus(
  payload: TogglePolicyStatusPayload,
  signal?: AbortSignal
): Promise<OperationPolicy | null> {
  const client = requireClient();
  const reason = requireReason(payload.reason);
  const { error } = await client.rpc('admin_toggle_operation_policy_status', {
    p_policy_id: payload.policyId,
    p_next_status: DB_POLICY_STATUS_BY_UI[payload.nextStatus],
    p_reason: reason
  });

  throwIfAborted(signal);
  if (error) {
    throw new Error(error.message);
  }

  const updated = await loadOperationPolicy(payload.policyId, signal);
  await syncLegalProjection(updated, signal);
  return updated;
}

export async function deleteOperationPolicy(
  payload: DeletePolicyPayload,
  signal?: AbortSignal
): Promise<OperationPolicy | null> {
  const client = requireClient();
  const reason = requireReason(payload.reason);
  const target = await loadOperationPolicy(payload.policyId, signal);
  const { error } = await client.rpc('admin_delete_operation_policy', {
    p_policy_id: payload.policyId,
    p_reason: reason
  });

  throwIfAborted(signal);
  if (error) {
    throw new Error(error.message);
  }

  return target;
}

export async function publishOperationPolicyHistoryVersion(
  payload: PublishPolicyHistoryVersionPayload,
  signal?: AbortSignal
): Promise<OperationPolicy | null> {
  const client = requireClient();
  const reason = requireReason(payload.reason);
  const { error } = await client.rpc('admin_publish_operation_policy_version', {
    p_policy_id: payload.policyId,
    p_history_id: payload.historyId,
    p_reason: reason
  });

  throwIfAborted(signal);
  if (error) {
    throw new Error(error.message);
  }

  const updated = await loadOperationPolicy(payload.policyId, signal);
  await syncLegalProjection(updated, signal);
  return updated;
}

export type TermsChangeNotificationResult = {
  recipients: number;
  inAppDispatch: string | null;
  emailDispatch: string | null;
};

// 관리자 수동 발송: 이용약관 버전 변경 알림(인앱+이메일)을 전체 활성 사용자에게 발송한다.
// v13 디스패처/이메일 워커가 집행한다(인앱=즉시 카드, 이메일=수신설정 사용자 대상).
export async function sendTermsChangeNotification(
  reason: string,
  signal?: AbortSignal
): Promise<TermsChangeNotificationResult> {
  const client = requireClient();
  const trimmed = requireReason(reason);
  const { data, error } = await client.rpc('admin_send_terms_change_notification', {
    p_reason: trimmed
  });

  throwIfAborted(signal);
  if (error) {
    throw new Error(error.message);
  }

  const payload = (data ?? {}) as {
    recipients?: number;
    in_app_dispatch?: string;
    email_dispatch?: string;
  };
  return {
    recipients: payload.recipients ?? 0,
    inAppDispatch: payload.in_app_dispatch ?? null,
    emailDispatch: payload.email_dispatch ?? null
  };
}
