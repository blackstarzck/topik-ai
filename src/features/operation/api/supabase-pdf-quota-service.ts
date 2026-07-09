import { supabaseClient } from '../../../shared/api/supabase-client';
import type {
  CreatePdfQuotaResetPayload,
  SavePdfQuotaPolicyPayload
} from '../model/pdf-quota-store';
import {
  pdfQuotaPeriodUnitValues,
  pdfQuotaResetScopeValues,
  type PdfQuotaPeriodUnit,
  type PdfQuotaPolicy,
  type PdfQuotaPolicyHistoryEntry,
  type PdfQuotaPolicyHistoryPage,
  type PdfQuotaReset,
  type PdfQuotaResetPage,
  type PdfQuotaResetScope,
  type PdfQuotaResetUserOption,
  type PdfQuotaResetUserOptionPage
} from '../model/pdf-quota-types';

type PdfQuotaPolicyRow = {
  id: string;
  subject_scope: string;
  resource_scope: string;
  period_unit: string;
  period_timezone: string;
  limit_count: number;
  priority: number;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
  updated_at_display: string | null;
};

type PdfQuotaResetRow = {
  id: string;
  reset_scope: string;
  problem_id: string | null;
  reason: string | null;
  actor_email: string | null;
  actor_name: string | null;
  target_count: number | null;
  created_at: string | null;
  total_count: number | null;
};

type PdfQuotaResetUserOptionRow = {
  user_id: string;
  email: string | null;
  display_name: string | null;
  nickname: string | null;
  status: string | null;
  total_count: number | null;
};

type PdfQuotaPolicyHistoryRow = {
  id: string | null;
  created_at: string | null;
  actor_name: string | null;
  actor_email: string | null;
  reason: string | null;
  limit_from: number | null;
  limit_to: number | null;
  period_unit_from: string | null;
  period_unit_to: string | null;
  period_timezone_from: string | null;
  period_timezone_to: string | null;
  result_limit: number | null;
  result_period_unit: string | null;
  total_count: number | null;
};

function requireClient() {
  if (!supabaseClient) {
    throw new Error('Supabase client not configured');
  }
  return supabaseClient;
}

function requireReason(reason: string | undefined): string {
  const trimmed = (reason ?? '').trim();
  if (!trimmed) {
    throw new Error('사유/근거를 입력하세요. (RPC p_reason 필수)');
  }
  return trimmed;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new DOMException('Request aborted', 'AbortError');
  }
}

function toDisplayDateTime(value: string | null | undefined): string {
  return value ?? '';
}

function coerceValue<T extends string>(
  value: string | null | undefined,
  candidates: readonly T[],
  fallback: T
): T {
  return value && candidates.includes(value as T) ? (value as T) : fallback;
}

function mapPolicyRow(row: PdfQuotaPolicyRow): PdfQuotaPolicy {
  return {
    id: row.id,
    subjectScope: row.subject_scope,
    resourceScope: row.resource_scope,
    periodUnit: coerceValue<PdfQuotaPeriodUnit>(
      row.period_unit,
      pdfQuotaPeriodUnitValues,
      'month'
    ),
    periodTimezone: row.period_timezone,
    limitCount: row.limit_count,
    priority: row.priority,
    isActive: row.is_active,
    createdAt: toDisplayDateTime(row.created_at),
    updatedAt: toDisplayDateTime(row.updated_at_display),
    updatedAtIso: row.updated_at
  };
}

function toOptionalPeriodUnit(
  value: string | null | undefined
): PdfQuotaPeriodUnit | null {
  return value && pdfQuotaPeriodUnitValues.includes(value as PdfQuotaPeriodUnit)
    ? (value as PdfQuotaPeriodUnit)
    : null;
}

function mapPolicyHistoryRow(
  row: PdfQuotaPolicyHistoryRow
): PdfQuotaPolicyHistoryEntry {
  return {
    id: row.id ?? `${row.created_at ?? ''}:${row.reason ?? ''}`,
    createdAt: toDisplayDateTime(row.created_at),
    actorName: row.actor_name ?? '',
    actorEmail: row.actor_email ?? '',
    reason: row.reason ?? '',
    limitFrom: row.limit_from,
    limitTo: row.limit_to,
    periodUnitFrom: toOptionalPeriodUnit(row.period_unit_from),
    periodUnitTo: toOptionalPeriodUnit(row.period_unit_to),
    periodTimezoneFrom: row.period_timezone_from,
    periodTimezoneTo: row.period_timezone_to,
    resultLimit: row.result_limit,
    resultPeriodUnit: toOptionalPeriodUnit(row.result_period_unit)
  };
}

function mapResetRow(row: PdfQuotaResetRow): PdfQuotaReset {
  return {
    id: row.id,
    scope: coerceValue<PdfQuotaResetScope>(
      row.reset_scope,
      pdfQuotaResetScopeValues,
      'user'
    ),
    problemId: row.problem_id,
    reason: row.reason ?? '',
    actorEmail: row.actor_email ?? '',
    actorName: row.actor_name ?? '',
    targetCount: row.target_count ?? 0,
    createdAt: toDisplayDateTime(row.created_at)
  };
}

function mapResetUserOptionRow(
  row: PdfQuotaResetUserOptionRow
): PdfQuotaResetUserOption {
  return {
    id: row.user_id,
    email: row.email ?? '',
    displayName: row.display_name ?? '',
    nickname: row.nickname ?? '',
    status: row.status ?? ''
  };
}

export async function loadPdfQuotaPolicies(
  signal?: AbortSignal
): Promise<PdfQuotaPolicy[]> {
  const client = requireClient();
  throwIfAborted(signal);

  const { data, error } = await client.rpc('get_admin_pdf_quota_policies');

  throwIfAborted(signal);
  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as PdfQuotaPolicyRow[]).map(mapPolicyRow);
}

export async function loadPdfQuotaResets(
  input: { page: number; pageSize: number; scope?: PdfQuotaResetScope | null },
  signal?: AbortSignal
): Promise<PdfQuotaResetPage> {
  const client = requireClient();
  throwIfAborted(signal);

  const { data, error } = await client.rpc('get_admin_pdf_quota_resets', {
    p_page: input.page,
    p_page_size: input.pageSize,
    p_scope: input.scope ?? null
  });

  throwIfAborted(signal);
  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as PdfQuotaResetRow[];
  return {
    items: rows.map(mapResetRow),
    totalCount: rows[0]?.total_count ?? 0
  };
}

export async function loadPdfQuotaResetUserOptions(
  input: { search?: string; page: number; pageSize: number },
  signal?: AbortSignal
): Promise<PdfQuotaResetUserOptionPage> {
  const client = requireClient();
  const search = input.search?.trim() ? input.search.trim() : null;
  throwIfAborted(signal);

  const { data, error } = await client.rpc('search_admin_pdf_quota_reset_users', {
    p_search: search,
    p_page: input.page,
    p_page_size: input.pageSize
  });

  throwIfAborted(signal);
  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as PdfQuotaResetUserOptionRow[];
  return {
    items: rows.map(mapResetUserOptionRow),
    totalCount: rows[0]?.total_count ?? 0
  };
}

export async function savePdfQuotaPolicy(
  payload: SavePdfQuotaPolicyPayload,
  signal?: AbortSignal
): Promise<string> {
  const client = requireClient();
  const reason = requireReason(payload.reason);
  throwIfAborted(signal);

  const { data, error } = await client.rpc('admin_save_pdf_quota_policy', {
    p_limit_count: payload.limitCount,
    p_period_unit: payload.periodUnit,
    p_period_timezone: payload.periodTimezone,
    p_reason: reason,
    p_expected_updated_at: payload.expectedUpdatedAt ?? null
  });

  throwIfAborted(signal);
  if (error) {
    throw new Error(error.message);
  }

  return data as string;
}

export async function loadPdfQuotaPolicyHistory(
  input: { page: number; pageSize: number },
  signal?: AbortSignal
): Promise<PdfQuotaPolicyHistoryPage> {
  const client = requireClient();
  throwIfAborted(signal);

  const { data, error } = await client.rpc('get_admin_pdf_quota_policy_history', {
    p_page: input.page,
    p_page_size: input.pageSize
  });

  throwIfAborted(signal);
  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as PdfQuotaPolicyHistoryRow[];
  return {
    items: rows.map(mapPolicyHistoryRow),
    totalCount: rows[0]?.total_count ?? 0
  };
}

export type CreatePdfQuotaResetResult = {
  resetId: string;
  targetCount: number;
};

export async function createPdfQuotaReset(
  payload: CreatePdfQuotaResetPayload,
  signal?: AbortSignal
): Promise<CreatePdfQuotaResetResult> {
  const client = requireClient();
  const reason = requireReason(payload.reason);
  throwIfAborted(signal);

  const { data, error } = await client.rpc('admin_create_pdf_quota_reset', {
    p_scope: payload.scope,
    p_user_id: payload.scope === 'user' ? payload.userId ?? null : null,
    p_group_code: payload.scope === 'group' ? payload.groupCode ?? null : null,
    p_problem_id: payload.problemId ?? null,
    p_reason: reason
  });

  throwIfAborted(signal);
  if (error) {
    throw new Error(error.message);
  }

  const result = (data ?? {}) as { resetId?: string; targetCount?: number };
  return {
    resetId: result.resetId ?? '',
    targetCount: result.targetCount ?? 0
  };
}
