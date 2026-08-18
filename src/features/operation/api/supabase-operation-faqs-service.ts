import {
  faqCategoryValues,
  faqCurationModeValues,
  faqCurationStatusValues,
  faqExposureSurfaceValues
} from '../model/faq-schema';
import type {
  OperationFaq,
  OperationFaqCategory,
  OperationFaqCuration,
  OperationFaqCurationMode,
  OperationFaqCurationStatus,
  OperationFaqExposureSurface,
  OperationFaqMetric,
  OperationFaqStatus
} from '../model/types';
import type {
  SaveFaqCurationPayload,
  SaveFaqPayload,
  ToggleFaqStatusPayload
} from './faqs-service';
import { requireClient, requireReason, throwIfAborted } from '@/shared/api/supabase-service-utils';
import { toDateOnly as toDate, toDateTimeMinutes as toDateTime } from '@/shared/model/date-format';

type OperationFaqRow = {
  id: string;
  question: string;
  answer: string;
  search_keywords: unknown;
  category: string;
  status: string;
  created_at: string | null;
  updated_at: string | null;
  updated_by: string | null;
};

type OperationFaqCurationRow = {
  id: string;
  faq_id: string;
  surface: string;
  curation_mode: string;
  display_rank: number;
  exposure_status: string;
  pinned_start_at: string | null;
  pinned_end_at: string | null;
  updated_at: string | null;
  updated_by: string | null;
};

type OperationFaqMetricRow = {
  faq_id: string;
  view_count: number;
  search_hit_count: number;
  helpful_count: number;
  not_helpful_count: number;
  last_viewed_at: string | null;
};

const DB_FAQ_STATUS_BY_UI: Record<OperationFaqStatus, string> = {
  공개: 'published',
  비공개: 'hidden'
};

const UI_FAQ_STATUS_BY_DB: Record<string, OperationFaqStatus> = {
  published: '공개',
  hidden: '비공개'
};

const DB_FAQ_SURFACE_BY_UI: Record<OperationFaqExposureSurface, string> = {
  help_center: 'help_center',
  home_top: 'home_top',
  payment_help: 'payment_help',
  onboarding: 'onboarding'
};

const DB_FAQ_CURATION_MODE_BY_UI: Record<OperationFaqCurationMode, string> = {
  manual: 'manual',
  auto: 'auto'
};

const DB_FAQ_CURATION_STATUS_BY_UI: Record<OperationFaqCurationStatus, string> = {
  active: 'active',
  paused: 'paused'
};

const FAQ_COLUMNS =
  'id, question, answer, search_keywords, category, status, created_at, updated_at, updated_by';
const FAQ_CURATION_COLUMNS =
  'id, faq_id, surface, curation_mode, display_rank, exposure_status, pinned_start_at, pinned_end_at, updated_at, updated_by';
const FAQ_METRIC_COLUMNS =
  'faq_id, view_count, search_hit_count, helpful_count, not_helpful_count, last_viewed_at';

function toNullableDate(ts: string | null | undefined): string | null {
  return ts ? ts.slice(0, 10) : null;
}

function toNullableDateTime(ts: string | null | undefined): string | null {
  return ts ? ts.slice(0, 16).replace('T', ' ') : null;
}

function coerceValue<T extends string>(
  value: string,
  candidates: readonly T[],
  fallback: T
): T {
  return candidates.includes(value as T) ? (value as T) : fallback;
}

function parseKeywords(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === 'string');
}

function mapFaqRow(row: OperationFaqRow): OperationFaq {
  return {
    id: row.id,
    question: row.question,
    answer: row.answer,
    searchKeywords: parseKeywords(row.search_keywords),
    category: coerceValue<OperationFaqCategory>(
      row.category,
      faqCategoryValues,
      '계정'
    ),
    status: UI_FAQ_STATUS_BY_DB[row.status] ?? '비공개',
    createdAt: toDate(row.created_at),
    updatedAt: toDateTime(row.updated_at),
    updatedBy: row.updated_by ?? 'system'
  };
}

function mapFaqCurationRow(row: OperationFaqCurationRow): OperationFaqCuration {
  return {
    id: row.id,
    faqId: row.faq_id,
    surface: coerceValue<OperationFaqExposureSurface>(
      row.surface,
      faqExposureSurfaceValues,
      'help_center'
    ),
    curationMode: coerceValue<OperationFaqCurationMode>(
      row.curation_mode,
      faqCurationModeValues,
      'manual'
    ),
    displayRank: row.display_rank,
    exposureStatus: coerceValue<OperationFaqCurationStatus>(
      row.exposure_status,
      faqCurationStatusValues,
      'paused'
    ),
    pinnedStartAt: toNullableDate(row.pinned_start_at),
    pinnedEndAt: toNullableDate(row.pinned_end_at),
    updatedAt: toDateTime(row.updated_at),
    updatedBy: row.updated_by ?? 'system'
  };
}

function mapFaqMetricRow(row: OperationFaqMetricRow): OperationFaqMetric {
  return {
    faqId: row.faq_id,
    viewCount: row.view_count,
    searchHitCount: row.search_hit_count,
    helpfulCount: row.helpful_count,
    notHelpfulCount: row.not_helpful_count,
    lastViewedAt: toNullableDateTime(row.last_viewed_at)
  };
}

export async function loadOperationFaqs(
  signal?: AbortSignal
): Promise<OperationFaq[]> {
  const client = requireClient();
  const { data, error } = await client
    .from('operation_faqs')
    .select(FAQ_COLUMNS)
    .order('created_at', { ascending: false });

  throwIfAborted(signal);
  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as unknown as OperationFaqRow[]).map(mapFaqRow);
}

export async function loadOperationFaq(
  faqId: string,
  signal?: AbortSignal
): Promise<OperationFaq | null> {
  const client = requireClient();
  const { data, error } = await client
    .from('operation_faqs')
    .select(FAQ_COLUMNS)
    .eq('id', faqId)
    .maybeSingle();

  throwIfAborted(signal);
  if (error) {
    throw new Error(error.message);
  }

  return data ? mapFaqRow(data as unknown as OperationFaqRow) : null;
}

export async function loadOperationFaqCurations(
  signal?: AbortSignal
): Promise<OperationFaqCuration[]> {
  const client = requireClient();
  const { data, error } = await client
    .from('operation_faq_curations')
    .select(FAQ_CURATION_COLUMNS)
    .order('surface', { ascending: true })
    .order('display_rank', { ascending: true });

  throwIfAborted(signal);
  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as unknown as OperationFaqCurationRow[]).map(
    mapFaqCurationRow
  );
}

export async function loadOperationFaqCuration(
  curationId: string,
  signal?: AbortSignal
): Promise<OperationFaqCuration | null> {
  const client = requireClient();
  const { data, error } = await client
    .from('operation_faq_curations')
    .select(FAQ_CURATION_COLUMNS)
    .eq('id', curationId)
    .maybeSingle();

  throwIfAborted(signal);
  if (error) {
    throw new Error(error.message);
  }

  return data ? mapFaqCurationRow(data as unknown as OperationFaqCurationRow) : null;
}

export async function loadOperationFaqMetrics(
  signal?: AbortSignal
): Promise<OperationFaqMetric[]> {
  const client = requireClient();
  const { data, error } = await client
    .from('operation_faq_metrics')
    .select(FAQ_METRIC_COLUMNS)
    .order('faq_id', { ascending: true });

  throwIfAborted(signal);
  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as unknown as OperationFaqMetricRow[]).map(mapFaqMetricRow);
}

function defaultSaveFaqReason(payload: SaveFaqPayload): string {
  return payload.id ? 'FAQ 원문 수정' : 'FAQ 신규 등록';
}

function defaultSaveFaqCurationReason(payload: SaveFaqCurationPayload): string {
  if (payload.id) {
    return payload.exposureStatus === 'active'
      ? 'FAQ 노출 규칙 수정 또는 재개'
      : 'FAQ 노출 규칙 수정 또는 일시중지';
  }

  return 'FAQ 대표 노출 추가';
}

export async function saveOperationFaq(
  payload: SaveFaqPayload,
  signal?: AbortSignal
): Promise<OperationFaq> {
  const client = requireClient();
  const reason = requireReason(payload.reason ?? defaultSaveFaqReason(payload));

  const { data, error } = await client.rpc('admin_save_operation_faq', {
    p_id: payload.id ?? null,
    p_faq: {
      question: payload.question,
      answer: payload.answer,
      search_keywords: payload.searchKeywords,
      category: payload.category,
      status: DB_FAQ_STATUS_BY_UI[payload.status]
    },
    p_reason: reason
  });

  throwIfAborted(signal);
  if (error) {
    throw new Error(error.message);
  }

  const saved = await loadOperationFaq(String(data), signal);
  if (!saved) {
    throw new Error('저장된 FAQ를 다시 불러오지 못했습니다.');
  }
  return saved;
}

export async function setOperationFaqStatus(
  payload: ToggleFaqStatusPayload,
  signal?: AbortSignal
): Promise<OperationFaq | null> {
  const client = requireClient();
  const reason = requireReason(payload.reason);
  const { error } = await client.rpc('admin_toggle_operation_faq_status', {
    p_faq_id: payload.faqId,
    p_next_status: DB_FAQ_STATUS_BY_UI[payload.nextStatus],
    p_reason: reason
  });

  throwIfAborted(signal);
  if (error) {
    throw new Error(error.message);
  }

  return loadOperationFaq(payload.faqId, signal);
}

export async function deleteOperationFaq(
  faqId: string,
  reason?: string,
  signal?: AbortSignal
): Promise<OperationFaq | null> {
  const client = requireClient();
  const confirmedReason = requireReason(reason);
  const target = await loadOperationFaq(faqId, signal);
  const { error } = await client.rpc('admin_delete_operation_faq', {
    p_faq_id: faqId,
    p_reason: confirmedReason
  });

  throwIfAborted(signal);
  if (error) {
    throw new Error(error.message);
  }

  return target;
}

export async function saveOperationFaqCuration(
  payload: SaveFaqCurationPayload,
  signal?: AbortSignal
): Promise<OperationFaqCuration> {
  const client = requireClient();
  const reason = requireReason(
    payload.reason ?? defaultSaveFaqCurationReason(payload)
  );

  const { data, error } = await client.rpc('admin_save_operation_faq_curation', {
    p_id: payload.id ?? null,
    p_curation: {
      faq_id: payload.faqId,
      surface: DB_FAQ_SURFACE_BY_UI[payload.surface],
      curation_mode: DB_FAQ_CURATION_MODE_BY_UI[payload.curationMode],
      display_rank: payload.displayRank,
      exposure_status: DB_FAQ_CURATION_STATUS_BY_UI[payload.exposureStatus],
      pinned_start_at: payload.pinnedStartAt,
      pinned_end_at: payload.pinnedEndAt
    },
    p_reason: reason
  });

  throwIfAborted(signal);
  if (error) {
    throw new Error(error.message);
  }

  const saved = await loadOperationFaqCuration(String(data), signal);
  if (!saved) {
    throw new Error('저장된 FAQ 노출 규칙을 다시 불러오지 못했습니다.');
  }
  return saved;
}

export async function deleteOperationFaqCuration(
  curationId: string,
  reason?: string,
  signal?: AbortSignal
): Promise<OperationFaqCuration | null> {
  const client = requireClient();
  const confirmedReason = requireReason(reason);
  const target = await loadOperationFaqCuration(curationId, signal);
  const { error } = await client.rpc('admin_delete_operation_faq_curation', {
    p_curation_id: curationId,
    p_reason: confirmedReason
  });

  throwIfAborted(signal);
  if (error) {
    throw new Error(error.message);
  }

  return target;
}
