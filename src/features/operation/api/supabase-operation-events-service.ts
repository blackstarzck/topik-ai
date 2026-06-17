import { supabaseClient } from '../../../shared/api/supabase-client';
import {
  operationEventBannerSourceTypeValues,
  operationEventExposureChannelValues,
  operationEventIndexingPolicyValues,
  operationEventRewardTypeValues,
  operationEventTypeValues,
  type OperationEvent,
  type OperationEventBannerImage,
  type OperationEventExposureChannel
} from '../model/types';
import type { EventActionPayload, SaveEventPayload } from './events-service';

type OperationEventRow = {
  id: string;
  title: string;
  summary: string | null;
  body_html: string;
  slug: string | null;
  event_type: string;
  visibility_status: string;
  progress_status: string;
  start_at: string | null;
  end_at: string | null;
  exposure_channels: unknown;
  target_group_id: string | null;
  target_group_name: string | null;
  participant_count: number;
  participant_limit: number | null;
  reward_type: string | null;
  reward_policy_id: string | null;
  reward_policy_name: string | null;
  message_template_id: string | null;
  message_template_name: string | null;
  banner_image_url: string | null;
  banner_image_source_type: string | null;
  banner_image_file_name: string | null;
  banner_images: unknown;
  landing_url: string | null;
  meta_title: string | null;
  meta_description: string | null;
  og_image_url: string | null;
  canonical_url: string | null;
  indexing_policy: string | null;
  admin_memo: string | null;
  created_at: string | null;
  updated_at: string | null;
  updated_by: string | null;
};

const DB_VISIBILITY_STATUS_BY_UI: Record<
  OperationEvent['visibilityStatus'],
  string
> = {
  노출: 'exposed',
  숨김: 'hidden',
  예약: 'scheduled'
};

const UI_VISIBILITY_STATUS_BY_DB: Record<
  string,
  OperationEvent['visibilityStatus']
> = {
  exposed: '노출',
  hidden: '숨김',
  scheduled: '예약'
};

const UI_PROGRESS_STATUS_BY_DB: Record<
  string,
  OperationEvent['progressStatus']
> = {
  ongoing: '진행 중',
  upcoming: '예정',
  ended: '종료'
};

const EVENT_COLUMNS = [
  'id',
  'title',
  'summary',
  'body_html',
  'slug',
  'event_type',
  'visibility_status',
  'progress_status',
  'start_at',
  'end_at',
  'exposure_channels',
  'target_group_id',
  'target_group_name',
  'participant_count',
  'participant_limit',
  'reward_type',
  'reward_policy_id',
  'reward_policy_name',
  'message_template_id',
  'message_template_name',
  'banner_image_url',
  'banner_image_source_type',
  'banner_image_file_name',
  'banner_images',
  'landing_url',
  'meta_title',
  'meta_description',
  'og_image_url',
  'canonical_url',
  'indexing_policy',
  'admin_memo',
  'created_at',
  'updated_at',
  'updated_by'
].join(', ');

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

function toDate(value: string | null | undefined): string {
  return value ? value.slice(0, 10) : '';
}

function toDateTime(value: string | null | undefined): string {
  return value ? value.slice(0, 16).replace('T', ' ') : '';
}

function formatToday(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function coerceValue<T extends string>(
  value: string | null | undefined,
  candidates: readonly T[],
  fallback: T
): T {
  return value && candidates.includes(value as T) ? (value as T) : fallback;
}

function parseExposureChannels(value: unknown): OperationEventExposureChannel[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is OperationEventExposureChannel =>
    operationEventExposureChannelValues.includes(
      item as OperationEventExposureChannel
    )
  );
}

function parseBannerImages(value: unknown): OperationEventBannerImage[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      const candidate = item as Partial<Record<'uid' | 'name' | 'url', unknown>>;
      const uid = typeof candidate.uid === 'string' ? candidate.uid : '';
      const name = typeof candidate.name === 'string' ? candidate.name : '';
      const url = typeof candidate.url === 'string' ? candidate.url : '';

      if (!uid || !url) {
        return null;
      }

      return { uid, name, url };
    })
    .filter(
      (bannerImage): bannerImage is OperationEventBannerImage =>
        bannerImage !== null
    );
}

function buildRewardPolicySummary(
  rewardType: OperationEvent['rewardType'],
  rewardPolicyName: string
): string {
  if (rewardType === '없음') {
    return '보상 없음';
  }

  return rewardPolicyName ? `${rewardType} · ${rewardPolicyName}` : rewardType;
}

function deriveProgressStatus(
  startAt: string,
  endAt: string,
  storedStatus: string
): OperationEvent['progressStatus'] {
  if (storedStatus === 'ended') {
    return '종료';
  }

  const today = formatToday();
  if (endAt && today > endAt) {
    return '종료';
  }
  if (startAt && today < startAt) {
    return '예정';
  }
  if (!startAt && !endAt) {
    return UI_PROGRESS_STATUS_BY_DB[storedStatus] ?? '예정';
  }

  return '진행 중';
}

function mapEventRow(row: OperationEventRow): OperationEvent {
  const startAt = toDate(row.start_at);
  const endAt = toDate(row.end_at);
  const rewardType = coerceValue(
    row.reward_type,
    operationEventRewardTypeValues,
    '없음'
  );
  const rewardPolicyName = row.reward_policy_name ?? '';

  return {
    id: row.id,
    title: row.title,
    summary: row.summary ?? '',
    bodyHtml: row.body_html,
    slug: row.slug ?? '',
    eventType: coerceValue(row.event_type, operationEventTypeValues, '프로모션'),
    progressStatus: deriveProgressStatus(startAt, endAt, row.progress_status),
    visibilityStatus: UI_VISIBILITY_STATUS_BY_DB[row.visibility_status] ?? '숨김',
    startAt,
    endAt,
    exposureChannels: parseExposureChannels(row.exposure_channels),
    targetGroupId: row.target_group_id ?? '',
    targetGroupName: row.target_group_name ?? '',
    participantCount: row.participant_count,
    participantLimit: row.participant_limit,
    rewardType,
    rewardPolicyId: row.reward_policy_id ?? '',
    rewardPolicyName,
    rewardPolicySummary: buildRewardPolicySummary(rewardType, rewardPolicyName),
    messageTemplateId: row.message_template_id ?? '',
    bannerImages: parseBannerImages(row.banner_images),
    bannerImageUrl: row.banner_image_url ?? '',
    bannerImageSourceType: coerceValue(
      row.banner_image_source_type,
      operationEventBannerSourceTypeValues,
      'file'
    ),
    bannerImageFileName: row.banner_image_file_name ?? '',
    landingUrl: row.landing_url ?? '',
    messageTemplateName: row.message_template_name ?? '',
    metaTitle: row.meta_title ?? '',
    metaDescription: row.meta_description ?? '',
    ogImageUrl: row.og_image_url ?? '',
    canonicalUrl: row.canonical_url ?? '',
    indexingPolicy: coerceValue(
      row.indexing_policy,
      operationEventIndexingPolicyValues,
      'index'
    ),
    adminMemo: row.admin_memo ?? '',
    createdAt: toDate(row.created_at),
    updatedAt: toDateTime(row.updated_at),
    updatedBy: row.updated_by ?? 'system'
  };
}

export async function loadOperationEvents(
  signal?: AbortSignal
): Promise<OperationEvent[]> {
  const client = requireClient();
  const { data, error } = await client
    .from('operation_events')
    .select(EVENT_COLUMNS)
    .order('created_at', { ascending: false });

  throwIfAborted(signal);
  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as unknown as OperationEventRow[]).map(mapEventRow);
}

export async function loadOperationEvent(
  eventId: string,
  signal?: AbortSignal
): Promise<OperationEvent | null> {
  const client = requireClient();
  const { data, error } = await client
    .from('operation_events')
    .select(EVENT_COLUMNS)
    .eq('id', eventId)
    .maybeSingle();

  throwIfAborted(signal);
  if (error) {
    throw new Error(error.message);
  }

  return data ? mapEventRow(data as unknown as OperationEventRow) : null;
}

function defaultSaveEventReason(payload: SaveEventPayload): string {
  return payload.id ? '이벤트 정보 수정' : '이벤트 신규 임시 저장';
}

function defaultActionReason(action: 'schedule' | 'publish' | 'end'): string {
  if (action === 'schedule') {
    return '이벤트 게시 예약 실행';
  }
  if (action === 'publish') {
    return '이벤트 즉시 게시 실행';
  }
  return '이벤트 종료 실행';
}

export async function saveOperationEvent(
  payload: SaveEventPayload,
  signal?: AbortSignal
): Promise<OperationEvent> {
  const client = requireClient();
  const reason = requireReason(payload.reason ?? defaultSaveEventReason(payload));

  const { data, error } = await client.rpc('admin_save_operation_event', {
    p_id: payload.id ?? null,
    p_event: {
      title: payload.title,
      summary: payload.summary,
      body_html: payload.bodyHtml,
      slug: payload.slug,
      event_type: payload.eventType,
      visibility_status: DB_VISIBILITY_STATUS_BY_UI[payload.visibilityStatus],
      start_at: payload.startAt,
      end_at: payload.endAt,
      exposure_channels: payload.exposureChannels,
      target_group_id: payload.targetGroupId,
      target_group_name: payload.targetGroupName,
      participant_limit: payload.participantLimit,
      reward_type: payload.rewardType,
      reward_policy_id: payload.rewardPolicyId,
      reward_policy_name: payload.rewardPolicyName,
      message_template_id: payload.messageTemplateId,
      message_template_name: payload.messageTemplateName,
      banner_image_url: payload.bannerImageUrl,
      banner_image_source_type: payload.bannerImageSourceType,
      banner_image_file_name: payload.bannerImageFileName,
      banner_images: payload.bannerImages,
      landing_url: payload.landingUrl,
      meta_title: payload.metaTitle,
      meta_description: payload.metaDescription,
      og_image_url: payload.ogImageUrl,
      canonical_url: payload.canonicalUrl,
      indexing_policy: payload.indexingPolicy,
      admin_memo: payload.adminMemo
    },
    p_reason: reason
  });

  throwIfAborted(signal);
  if (error) {
    throw new Error(error.message);
  }

  const saved = await loadOperationEvent(String(data), signal);
  if (!saved) {
    throw new Error('저장된 이벤트를 다시 불러오지 못했습니다.');
  }
  return saved;
}

export async function scheduleOperationEvent(
  payload: EventActionPayload,
  signal?: AbortSignal
): Promise<OperationEvent | null> {
  const client = requireClient();
  const reason = requireReason(payload.reason ?? defaultActionReason('schedule'));
  const { error } = await client.rpc('admin_schedule_operation_event', {
    p_event_id: payload.eventId,
    p_reason: reason
  });

  throwIfAborted(signal);
  if (error) {
    throw new Error(error.message);
  }

  return loadOperationEvent(payload.eventId, signal);
}

export async function publishOperationEvent(
  payload: EventActionPayload,
  signal?: AbortSignal
): Promise<OperationEvent | null> {
  const client = requireClient();
  const reason = requireReason(payload.reason ?? defaultActionReason('publish'));
  const { error } = await client.rpc('admin_publish_operation_event', {
    p_event_id: payload.eventId,
    p_reason: reason
  });

  throwIfAborted(signal);
  if (error) {
    throw new Error(error.message);
  }

  return loadOperationEvent(payload.eventId, signal);
}

export async function endOperationEvent(
  payload: EventActionPayload,
  signal?: AbortSignal
): Promise<OperationEvent | null> {
  const client = requireClient();
  const reason = requireReason(payload.reason ?? defaultActionReason('end'));
  const { error } = await client.rpc('admin_end_operation_event', {
    p_event_id: payload.eventId,
    p_reason: reason
  });

  throwIfAborted(signal);
  if (error) {
    throw new Error(error.message);
  }

  return loadOperationEvent(payload.eventId, signal);
}
