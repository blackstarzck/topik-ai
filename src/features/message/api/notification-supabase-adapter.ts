import { createDefaultMessageGroupFilters } from '../model/message-group-segment-schema';
import type {
  ChannelSnapshot,
  MessageChannel,
  MessageGroup,
  MessageGroupDefinitionType,
  MessageGroupFilters,
  MessageGroupQueryGroup,
  MessageGroupStatus,
  MessageTemplate,
  MessageTemplateStatus,
  NotificationTemplateClass
} from '../model/types';
import type {
  SaveMessageGroupPayload,
  SaveMessageTemplatePayload,
  SendMessageTemplatePayload
} from './messages-service';
import { coerceStringArray as toStringArray, requireClient, requireReason, throwIfAborted } from '@/shared/api/supabase-service-utils';
import { toDateTimeMinutes as toDateTime } from '@/shared/model/date-format';

/**
 * Supabase 어댑터 (WP2-2/2-3 — docs/specs/notification-contract.md).
 *
 * DB는 ASCII enum(active/static/email …)을 저장하고 UI는 한글 라벨을 유지한다.
 * 양방향 매핑은 전부 이 모듈에 모은다. 쓰기는 admin RPC 6종 단일 경로이며
 * (직접 write는 RLS 차단) 모든 RPC는 p_reason(사유) 필수 — 빈 값은 서버가
 * 거부하므로 클라이언트에서도 선제 차단한다.
 */

// ---------------------------------------------------------------------------
// enum 매핑
// ---------------------------------------------------------------------------

const DB_CHANNEL_BY_UI: Record<MessageChannel, string> = {
  mail: 'email',
  push: 'push',
  in_app: 'in_app'
};

const UI_CHANNEL_BY_DB: Record<string, MessageChannel> = {
  email: 'mail',
  push: 'push',
  in_app: 'in_app'
};

const DB_TEMPLATE_STATUS_BY_UI: Record<MessageTemplateStatus, string> = {
  활성: 'active',
  비활성: 'inactive',
  초안: 'draft'
};

const UI_TEMPLATE_STATUS_BY_DB: Record<string, MessageTemplateStatus> = {
  active: '활성',
  inactive: '비활성',
  draft: '초안'
};

const DB_GROUP_DEFINITION_TYPE_BY_UI: Record<MessageGroupDefinitionType, string> = {
  '정적 그룹': 'static',
  '조건 기반 그룹': 'query'
};

const UI_GROUP_DEFINITION_TYPE_BY_DB: Record<string, MessageGroupDefinitionType> = {
  static: '정적 그룹',
  query: '조건 기반 그룹'
};

const DB_GROUP_STATUS_BY_UI: Record<MessageGroupStatus, string> = {
  사용중: 'active',
  초안: 'draft'
};

const UI_GROUP_STATUS_BY_DB: Record<string, MessageGroupStatus> = {
  active: '사용중',
  draft: '초안'
};

export function dbChannelOfUi(channel: MessageChannel): string {
  return DB_CHANNEL_BY_UI[channel];
}

export type NotificationDispatchStatus =
  | 'draft'
  | 'scheduled'
  | 'running'
  | 'completed'
  | 'partial_failed'
  | 'failed'
  | 'canceled';

export type NotificationAttemptStatus =
  | 'pending'
  | 'sent'
  | 'failed'
  | 'skipped'
  | 'opted_out'
  | 'deduped';

export type NotificationDispatchTargetType = 'group' | 'schedule' | 'event' | 'test';

export const notificationDispatchStatusLabels: Record<NotificationDispatchStatus, string> = {
  draft: '초안',
  scheduled: '예약',
  running: '실행 중',
  completed: '완료',
  partial_failed: '부분 실패',
  failed: '실패',
  canceled: '취소'
};

export const notificationAttemptStatusLabels: Record<NotificationAttemptStatus, string> = {
  pending: '대기',
  sent: '성공',
  failed: '실패',
  skipped: '건너뜀',
  opted_out: '수신 거부',
  deduped: '중복 제외'
};

export const notificationDispatchTargetTypeLabels: Record<
  NotificationDispatchTargetType,
  string
> = {
  group: '그룹 발송',
  schedule: '스케줄',
  event: '이벤트',
  test: '테스트'
};

export const notificationDbChannelLabels: Record<string, string> = {
  in_app: '인앱',
  email: '메일',
  push: '푸시',
  zalo: 'Zalo'
};

export type NotificationDispatchListItem = {
  id: string;
  createdAt: string;
  templateKey: string;
  channels: string[];
  targetType: NotificationDispatchTargetType;
  targetGroupIds: string[];
  recipientCount: number;
  status: NotificationDispatchStatus;
  actorId: string;
  reason: string;
  scheduledAt?: string;
  startedAt?: string;
  completedAt?: string;
};

export type NotificationDeliveryAttemptItem = {
  id: string;
  userId: string;
  channel: string;
  templateKey: string;
  status: NotificationAttemptStatus;
  errorCode?: string;
  errorMessage?: string;
  retryCount: number;
  sentAt?: string;
  createdAt: string;
};

// ---------------------------------------------------------------------------
// row 타입 + 공통 헬퍼
// ---------------------------------------------------------------------------

type TemplateRow = {
  id: string;
  template_key: string;
  channel: string;
  class: string;
  mandatory: boolean;
  mode: string;
  category: string;
  name: string;
  summary: string;
  subject: string;
  body_html: string;
  body_json: unknown;
  variables: unknown;
  trigger_key: string | null;
  target_group_ids: unknown;
  status: string;
  link_url: string | null;
  cta_label: string | null;
  last_sent_at: string | null;
  updated_by: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type GroupRow = {
  id: string;
  name: string;
  description: string;
  definition_type: string;
  builder_mode: string;
  channels: unknown;
  member_count: number;
  rule_summary: string;
  filters: unknown;
  query_config: unknown;
  static_member_ids: unknown;
  status: string;
  last_calculated_at: string | null;
  updated_by: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type DispatchRow = {
  id: string;
  template_id: string | null;
  template_key: string;
  channels: unknown;
  target_type: string;
  target_group_ids: unknown;
  recipient_count: number;
  status: string;
  actor_id: string | null;
  reason: string | null;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string | null;
};

type AttemptRow = {
  id: string;
  dispatch_id: string;
  user_id: string;
  channel: string;
  template_key: string | null;
  status: string;
  error_code: string | null;
  error_message: string | null;
  retry_count: number;
  sent_at: string | null;
  created_at: string | null;
};

const TEMPLATE_COLUMNS =
  'id, template_key, channel, class, mandatory, mode, category, name, summary, ' +
  'subject, body_html, body_json, variables, trigger_key, target_group_ids, ' +
  'status, link_url, cta_label, last_sent_at, updated_by, created_at, updated_at';

const GROUP_COLUMNS =
  'id, name, description, definition_type, builder_mode, channels, member_count, ' +
  'rule_summary, filters, query_config, static_member_ids, status, ' +
  'last_calculated_at, updated_by, created_at, updated_at';

const DISPATCH_COLUMNS =
  'id, template_id, template_key, channels, target_type, target_group_ids, ' +
  'recipient_count, status, actor_id, reason, scheduled_at, started_at, ' +
  'completed_at, created_at';

const ATTEMPT_COLUMNS =
  'id, dispatch_id, user_id, channel, template_key, status, error_code, ' +
  'error_message, retry_count, sent_at, created_at';

function toUiChannels(value: unknown): MessageChannel[] {
  return toStringArray(value)
    .map((channel) => UI_CHANNEL_BY_DB[channel])
    .filter((channel): channel is MessageChannel => Boolean(channel));
}

function toBodyJsonText(value: unknown): string {
  if (value === null || value === undefined) {
    return JSON.stringify({ blocks: [] }, null, 2);
  }
  return JSON.stringify(value, null, 2);
}

function parseBodyJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

// 시드/외부 적재 행의 filters가 UI 스키마와 다를 수 있어 기본값으로 보정한다.
function normalizeFilters(value: unknown): MessageGroupFilters {
  const defaults = createDefaultMessageGroupFilters();
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return defaults;
  }

  const raw = value as Partial<MessageGroupFilters>;
  return {
    country: raw.country ?? defaults.country,
    memberTypes: Array.isArray(raw.memberTypes) ? raw.memberTypes : defaults.memberTypes,
    genders: Array.isArray(raw.genders) ? raw.genders : defaults.genders,
    ageRange:
      Array.isArray(raw.ageRange) && raw.ageRange.length === 2
        ? [Number(raw.ageRange[0]), Number(raw.ageRange[1])]
        : defaults.ageRange,
    signupMethods: Array.isArray(raw.signupMethods)
      ? raw.signupMethods
      : defaults.signupMethods,
    signupDateRange: raw.signupDateRange,
    subscriptionStates: Array.isArray(raw.subscriptionStates)
      ? raw.subscriptionStates
      : defaults.subscriptionStates,
    activityStates: Array.isArray(raw.activityStates)
      ? raw.activityStates
      : defaults.activityStates
  };
}

function mapTemplateRow(row: TemplateRow): MessageTemplate {
  return {
    id: row.id,
    channel: UI_CHANNEL_BY_DB[row.channel] ?? 'mail',
    mode: row.mode === 'auto' ? 'auto' : 'manual',
    category: row.category,
    name: row.name,
    summary: row.summary,
    subject: row.subject,
    targetGroupIds: toStringArray(row.target_group_ids),
    status: UI_TEMPLATE_STATUS_BY_DB[row.status] ?? '초안',
    triggerLabel: row.trigger_key ?? undefined,
    bodyHtml: row.body_html,
    bodyJson: toBodyJsonText(row.body_json),
    lastSentAt: row.last_sent_at ? toDateTime(row.last_sent_at) : undefined,
    updatedAt: toDateTime(row.updated_at),
    updatedBy: row.updated_by ?? '',
    templateKey: row.template_key,
    templateClass: row.class as NotificationTemplateClass,
    mandatory: row.mandatory,
    linkUrl: row.link_url ?? '',
    ctaLabel: row.cta_label ?? ''
  };
}

function mapGroupRow(row: GroupRow): MessageGroup {
  const builderMode = row.builder_mode === 'query-builder' ? 'query-builder' : 'simple';
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    definitionType: UI_GROUP_DEFINITION_TYPE_BY_DB[row.definition_type] ?? '정적 그룹',
    builderMode,
    channels: toUiChannels(row.channels),
    memberCount: row.member_count,
    ruleSummary: row.rule_summary,
    status: UI_GROUP_STATUS_BY_DB[row.status] ?? '초안',
    staticMembers: toStringArray(row.static_member_ids),
    filters: normalizeFilters(row.filters),
    queryBuilderText: builderMode === 'query-builder' ? row.rule_summary : undefined,
    queryBuilderConfig:
      row.query_config && typeof row.query_config === 'object'
        ? (row.query_config as MessageGroupQueryGroup)
        : undefined,
    lastCalculatedAt: toDateTime(row.last_calculated_at),
    updatedAt: toDateTime(row.updated_at),
    updatedBy: row.updated_by ?? ''
  };
}

function mapDispatchRow(row: DispatchRow): NotificationDispatchListItem {
  return {
    id: row.id,
    createdAt: toDateTime(row.created_at),
    templateKey: row.template_key,
    channels: toStringArray(row.channels),
    targetType: (row.target_type as NotificationDispatchTargetType) ?? 'group',
    targetGroupIds: toStringArray(row.target_group_ids),
    recipientCount: row.recipient_count,
    status: (row.status as NotificationDispatchStatus) ?? 'draft',
    actorId: row.actor_id ?? '',
    reason: row.reason ?? '',
    scheduledAt: row.scheduled_at ? toDateTime(row.scheduled_at) : undefined,
    startedAt: row.started_at ? toDateTime(row.started_at) : undefined,
    completedAt: row.completed_at ? toDateTime(row.completed_at) : undefined
  };
}

function mapAttemptRow(row: AttemptRow): NotificationDeliveryAttemptItem {
  return {
    id: row.id,
    userId: row.user_id,
    channel: row.channel,
    templateKey: row.template_key ?? '',
    status: (row.status as NotificationAttemptStatus) ?? 'pending',
    errorCode: row.error_code ?? undefined,
    errorMessage: row.error_message ?? undefined,
    retryCount: row.retry_count,
    sentAt: row.sent_at ? toDateTime(row.sent_at) : undefined,
    createdAt: toDateTime(row.created_at)
  };
}

// ---------------------------------------------------------------------------
// 읽기
// ---------------------------------------------------------------------------

export async function loadNotificationTemplates(
  channel: MessageChannel,
  signal?: AbortSignal
): Promise<MessageTemplate[]> {
  const client = requireClient();
  const { data, error } = await client
    .from('notification_templates')
    .select(TEMPLATE_COLUMNS)
    .eq('channel', DB_CHANNEL_BY_UI[channel])
    .order('updated_at', { ascending: false });
  throwIfAborted(signal);
  if (error) {
    throw new Error(error.message);
  }
  return ((data ?? []) as unknown as TemplateRow[]).map(mapTemplateRow);
}

export async function loadNotificationTemplate(
  templateId: string
): Promise<MessageTemplate | null> {
  const client = requireClient();
  const { data, error } = await client
    .from('notification_templates')
    .select(TEMPLATE_COLUMNS)
    .eq('id', templateId)
    .maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  return data ? mapTemplateRow(data as unknown as TemplateRow) : null;
}

export async function loadNotificationGroups(
  signal?: AbortSignal
): Promise<MessageGroup[]> {
  const client = requireClient();
  const { data, error } = await client
    .from('notification_groups')
    .select(GROUP_COLUMNS)
    .order('updated_at', { ascending: false });
  throwIfAborted(signal);
  if (error) {
    throw new Error(error.message);
  }
  return ((data ?? []) as unknown as GroupRow[]).map(mapGroupRow);
}

export async function loadNotificationGroup(
  groupId: string
): Promise<MessageGroup | null> {
  const client = requireClient();
  const { data, error } = await client
    .from('notification_groups')
    .select(GROUP_COLUMNS)
    .eq('id', groupId)
    .maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  return data ? mapGroupRow(data as unknown as GroupRow) : null;
}

export async function loadNotificationChannelSnapshot(
  channel: MessageChannel,
  signal?: AbortSignal
): Promise<ChannelSnapshot> {
  const [templates, groups] = await Promise.all([
    loadNotificationTemplates(channel, signal),
    loadNotificationGroups(signal)
  ]);
  return { templates, groups };
}

export async function loadNotificationDispatches(
  signal?: AbortSignal
): Promise<NotificationDispatchListItem[]> {
  const client = requireClient();
  const { data, error } = await client
    .from('notification_dispatches')
    .select(DISPATCH_COLUMNS)
    .order('created_at', { ascending: false })
    .limit(200);
  throwIfAborted(signal);
  if (error) {
    throw new Error(error.message);
  }
  return ((data ?? []) as unknown as DispatchRow[]).map(mapDispatchRow);
}

export async function loadNotificationDispatchAttempts(
  dispatchId: string,
  signal?: AbortSignal
): Promise<NotificationDeliveryAttemptItem[]> {
  const client = requireClient();
  const { data, error } = await client
    .from('notification_delivery_attempts')
    .select(ATTEMPT_COLUMNS)
    .eq('dispatch_id', dispatchId)
    .order('created_at', { ascending: true });
  throwIfAborted(signal);
  if (error) {
    throw new Error(error.message);
  }
  return ((data ?? []) as unknown as AttemptRow[]).map(mapAttemptRow);
}

// ---------------------------------------------------------------------------
// 쓰기 — admin RPC 단일 경로
// ---------------------------------------------------------------------------

export async function saveNotificationTemplate(
  payload: SaveMessageTemplatePayload
): Promise<MessageTemplate> {
  const client = requireClient();
  const reason = requireReason(payload.reason);
  const templateClass = payload.templateClass ?? 'operational';
  const bodyJson = parseBodyJson(payload.bodyJson);

  const template: Record<string, unknown> = {
    template_key: payload.templateKey,
    channel: DB_CHANNEL_BY_UI[payload.channel],
    class: templateClass,
    // DB CHECK: marketing+mandatory 저장 차단 (contract §2) — UI에서도 강제.
    mandatory: templateClass === 'marketing' ? false : payload.mandatory ?? false,
    mode: payload.mode,
    category: payload.category,
    name: payload.name,
    summary: payload.summary,
    subject: payload.subject,
    body_html: payload.bodyHtml,
    trigger_key: payload.triggerLabel,
    target_group_ids: payload.targetGroupIds,
    status: DB_TEMPLATE_STATUS_BY_UI[payload.status],
    link_url: payload.linkUrl ?? '',
    cta_label: payload.ctaLabel ?? ''
  };
  if (bodyJson !== undefined) {
    template.body_json = bodyJson;
  }

  const { data, error } = await client.rpc('admin_save_notification_template', {
    p_id: payload.id ?? null,
    p_template: template,
    p_reason: reason
  });
  if (error) {
    throw new Error(error.message);
  }

  const saved = await loadNotificationTemplate(String(data));
  if (!saved) {
    throw new Error('저장된 템플릿을 다시 불러오지 못했습니다.');
  }
  return saved;
}

export async function setNotificationTemplateStatus(payload: {
  templateId: string;
  nextStatus: Extract<MessageTemplateStatus, '활성' | '비활성'>;
  reason?: string;
}): Promise<MessageTemplate | null> {
  const client = requireClient();
  const reason = requireReason(payload.reason);
  const { error } = await client.rpc('admin_set_notification_template_status', {
    p_id: payload.templateId,
    p_next: DB_TEMPLATE_STATUS_BY_UI[payload.nextStatus],
    p_reason: reason
  });
  if (error) {
    throw new Error(error.message);
  }
  return loadNotificationTemplate(payload.templateId);
}

export async function deleteNotificationTemplate(
  templateId: string,
  reason?: string
): Promise<MessageTemplate | null> {
  const client = requireClient();
  const confirmedReason = requireReason(reason);
  const target = await loadNotificationTemplate(templateId);
  const { error } = await client.rpc('admin_delete_notification_template', {
    p_id: templateId,
    p_reason: confirmedReason
  });
  if (error) {
    throw new Error(error.message);
  }
  return target;
}

// mock의 buildRuleSummary와 동일 포맷 — 목록 표기 일관성 유지.
function buildGroupRuleSummary(payload: SaveMessageGroupPayload): string {
  if (payload.definitionType === '정적 그룹') {
    return `정적 대상 ${payload.staticMembers.length.toLocaleString()}명`;
  }

  if (payload.queryBuilderText?.trim()) {
    return payload.queryBuilderText.trim().slice(0, 120);
  }

  const memberTypes =
    payload.filters.memberTypes.length > 0
      ? payload.filters.memberTypes.join(', ')
      : '전체 회원';
  const signupMethods =
    payload.filters.signupMethods.length > 0
      ? payload.filters.signupMethods.join(', ')
      : '전체 가입 방식';
  const activityStates =
    payload.filters.activityStates.length > 0
      ? payload.filters.activityStates.join(', ')
      : '전체 활동 상태';

  return `${payload.filters.country} · ${memberTypes} · ${payload.filters.ageRange[0]}-${payload.filters.ageRange[1]}세 · ${signupMethods} · ${activityStates}`;
}

export async function saveNotificationGroup(
  payload: SaveMessageGroupPayload
): Promise<MessageGroup> {
  const client = requireClient();
  const reason = requireReason(payload.reason);
  const isStatic = payload.definitionType === '정적 그룹';
  const staticMembers = payload.staticMembers.filter((member) => member.trim().length > 0);

  const group: Record<string, unknown> = {
    name: payload.name,
    description: payload.description,
    definition_type: DB_GROUP_DEFINITION_TYPE_BY_UI[payload.definitionType],
    builder_mode: payload.builderMode,
    channels: payload.channels.map((channel) => DB_CHANNEL_BY_UI[channel]),
    rule_summary: buildGroupRuleSummary(payload),
    filters: payload.filters,
    static_member_ids: staticMembers,
    status: DB_GROUP_STATUS_BY_UI[payload.status]
  };
  if (isStatic) {
    group.member_count = staticMembers.length;
  }
  if (payload.queryBuilderConfig) {
    group.query_config = payload.queryBuilderConfig;
  }

  const { data, error } = await client.rpc('admin_save_notification_group', {
    p_id: payload.id ?? null,
    p_group: group,
    p_reason: reason
  });
  if (error) {
    throw new Error(error.message);
  }

  const saved = await loadNotificationGroup(String(data));
  if (!saved) {
    throw new Error('저장된 대상 그룹을 다시 불러오지 못했습니다.');
  }
  return saved;
}

export async function deleteNotificationGroup(
  groupId: string,
  reason?: string
): Promise<MessageGroup | null> {
  const client = requireClient();
  const confirmedReason = requireReason(reason);
  const target = await loadNotificationGroup(groupId);
  const { error } = await client.rpc('admin_delete_notification_group', {
    p_id: groupId,
    p_reason: confirmedReason
  });
  if (error) {
    throw new Error(error.message);
  }
  return target;
}

function toScheduledAtIso(scheduledAt: string | undefined): string | null {
  if (!scheduledAt) {
    return null;
  }
  // 'YYYY-MM-DD HH:mm' (관리자 로컬 시각) → timestamptz ISO.
  const parsed = new Date(`${scheduledAt.replace(' ', 'T')}:00`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('예약 시각 형식이 올바르지 않습니다.');
  }
  return parsed.toISOString();
}

export async function sendNotification(
  payload: SendMessageTemplatePayload
): Promise<{ id: string }> {
  const client = requireClient();
  const reason = requireReason(payload.reason);
  const targetType = payload.targetType ?? 'group';
  const { data, error } = await client.rpc('admin_send_notification', {
    p_template_id: payload.templateId,
    p_group_ids: targetType === 'test' ? [] : payload.groupIds,
    p_scheduled_at: toScheduledAtIso(payload.scheduledAt),
    p_reason: reason,
    p_target_type: targetType
  });
  if (error) {
    throw new Error(error.message);
  }
  return { id: String(data) };
}

// 예약(scheduled) 발송 실행 취소 — QA N-ADM-11. scheduled 상태만 허용(서버 가드).
// 취소 후 파이프라인이 집행하지 않으므로 발송 0건.
export async function cancelNotificationDispatch(
  dispatchId: string,
  reason?: string
): Promise<{ id: string }> {
  const client = requireClient();
  const confirmedReason = requireReason(reason);
  const { error } = await client.rpc('admin_cancel_notification_dispatch', {
    p_dispatch_id: dispatchId,
    p_reason: confirmedReason
  });
  if (error) {
    throw new Error(error.message);
  }
  return { id: dispatchId };
}

// 정적 그룹은 명단 길이, 조건 기반은 산정 파이프라인 미연동(P2) — null 반환.
export function previewNotificationGroupCount(
  payload: SaveMessageGroupPayload
): number | null {
  if (payload.definitionType === '정적 그룹') {
    return payload.staticMembers.filter((member) => member.trim().length > 0).length;
  }
  return null;
}
