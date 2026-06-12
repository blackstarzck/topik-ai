import { toSafeResult, withRetry } from '../../../shared/api/safe-request';
import { messageDataSource } from './message-data-source';
import {
  deleteNotificationGroup,
  deleteNotificationTemplate,
  loadNotificationChannelSnapshot,
  loadNotificationDispatchAttempts,
  loadNotificationDispatches,
  loadNotificationGroup,
  loadNotificationGroups,
  loadNotificationTemplate,
  previewNotificationGroupCount,
  saveNotificationGroup,
  saveNotificationTemplate,
  sendNotification,
  setNotificationTemplateStatus
} from './notification-supabase-adapter';
import { useMessageStore } from '../model/message-store';
import type {
  ChannelSnapshot,
  MessageChannel,
  MessageGroup,
  MessageGroupBuilderMode,
  MessageGroupDefinitionType,
  MessageGroupFilters,
  MessageGroupQueryGroup,
  MessageGroupStatus,
  MessageHistory,
  MessageSendActionType,
  MessageTemplate,
  MessageTemplateStatus
} from '../model/types';

export type MessageOptionSources = {
  groups: MessageGroup[];
  templates: MessageTemplate[];
};

export type SaveMessageTemplatePayload = Omit<
  MessageTemplate,
  'id' | 'updatedAt' | 'updatedBy' | 'lastSentAt'
> & {
  id?: string;
  // supabase 모드 전용 — RPC p_reason(사유) 필수.
  reason?: string;
};

export type ToggleMessageTemplatePayload = {
  templateId: string;
  nextStatus: Extract<MessageTemplateStatus, '활성' | '비활성'>;
  reason?: string;
};

export type SendMessageTemplatePayload = {
  templateId: string;
  channel: MessageChannel;
  groupIds: string[];
  actor: string;
  actionType: MessageSendActionType;
  scheduledAt?: string;
  reason?: string;
  // supabase 모드 전용 — '나에게 보내기'는 'test' (admin_send_notification 계약).
  targetType?: 'group' | 'test';
};

export type SaveMessageGroupPayload = {
  id?: string;
  name: string;
  description: string;
  definitionType: MessageGroupDefinitionType;
  builderMode: MessageGroupBuilderMode;
  channels: MessageChannel[];
  status: MessageGroupStatus;
  staticMembers: string[];
  filters: MessageGroupFilters;
  queryBuilderText?: string;
  queryBuilderConfig?: MessageGroupQueryGroup;
  reason?: string;
};

const isSupabaseSource = messageDataSource === 'supabase';

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Request aborted', 'AbortError'));
      return;
    }

    const timer = window.setTimeout(() => {
      cleanup();
      resolve();
    }, ms);

    const onAbort = (): void => {
      cleanup();
      reject(new DOMException('Request aborted', 'AbortError'));
    };

    const cleanup = (): void => {
      window.clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    };

    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

async function loadChannelSnapshot(
  channel: MessageChannel,
  signal?: AbortSignal
): Promise<ChannelSnapshot> {
  if (isSupabaseSource) {
    return loadNotificationChannelSnapshot(channel, signal);
  }

  await sleep(240, signal);
  const state = useMessageStore.getState();
  return {
    templates: state.templates.filter((template) => template.channel === channel),
    groups: state.groups.filter((group) => group.channels.includes(channel))
  };
}

async function loadGroups(signal?: AbortSignal): Promise<MessageGroup[]> {
  if (isSupabaseSource) {
    return loadNotificationGroups(signal);
  }

  await sleep(220, signal);
  return useMessageStore.getState().groups;
}

async function loadHistories(signal?: AbortSignal): Promise<MessageHistory[]> {
  await sleep(260, signal);
  return useMessageStore.getState().histories;
}

async function loadMessageOptionSources(
  signal?: AbortSignal
): Promise<MessageOptionSources> {
  await sleep(180, signal);
  return getMessageOptionSnapshot();
}

export function getMessageOptionSnapshot(): MessageOptionSources {
  const state = useMessageStore.getState();
  return {
    groups: state.groups.map((group) => ({ ...group })),
    templates: state.templates.map((template) => ({
      ...template,
      targetGroupIds: [...template.targetGroupIds]
    }))
  };
}

async function loadTemplate(templateId: string): Promise<MessageTemplate | null> {
  if (isSupabaseSource) {
    return loadNotificationTemplate(templateId);
  }

  await sleep(120);
  return (
    useMessageStore
      .getState()
      .templates.find((template) => template.id === templateId) ?? null
  );
}

async function saveTemplate(
  payload: SaveMessageTemplatePayload,
  signal?: AbortSignal
): Promise<MessageTemplate> {
  if (isSupabaseSource) {
    return saveNotificationTemplate(payload);
  }

  await sleep(180, signal);
  return useMessageStore.getState().saveTemplate(payload);
}

async function toggleTemplate(
  payload: ToggleMessageTemplatePayload,
  signal?: AbortSignal
): Promise<MessageTemplate | null> {
  if (isSupabaseSource) {
    return setNotificationTemplateStatus(payload);
  }

  await sleep(160, signal);
  return useMessageStore.getState().toggleTemplate(payload);
}

async function deleteTemplate(
  templateId: string,
  reason?: string,
  signal?: AbortSignal
): Promise<MessageTemplate | null> {
  if (isSupabaseSource) {
    return deleteNotificationTemplate(templateId, reason);
  }

  await sleep(160, signal);
  return useMessageStore.getState().deleteTemplate(templateId);
}

async function sendTemplate(
  payload: SendMessageTemplatePayload,
  signal?: AbortSignal
): Promise<{ id: string } | null> {
  if (isSupabaseSource) {
    return sendNotification(payload);
  }

  await sleep(200, signal);
  return useMessageStore.getState().sendTemplate(payload);
}

async function saveGroup(
  payload: SaveMessageGroupPayload,
  signal?: AbortSignal
): Promise<MessageGroup> {
  if (isSupabaseSource) {
    return saveNotificationGroup(payload);
  }

  await sleep(180, signal);
  return useMessageStore.getState().saveGroup(payload);
}

async function previewGroupCount(
  payload: SaveMessageGroupPayload,
  signal?: AbortSignal
): Promise<number | null> {
  if (isSupabaseSource) {
    return previewNotificationGroupCount(payload);
  }

  await sleep(120, signal);
  return useMessageStore.getState().previewGroupCount(payload);
}

async function recalculateGroup(
  groupId: string,
  signal?: AbortSignal
): Promise<MessageGroup | null> {
  if (isSupabaseSource) {
    // 산정 파이프라인 미연동(P2) — 쓰기 없이 최신 행만 다시 읽는다.
    return loadNotificationGroup(groupId);
  }

  await sleep(160, signal);
  return useMessageStore.getState().recalculateGroup(groupId);
}

async function deleteGroup(
  groupId: string,
  reason?: string,
  signal?: AbortSignal
): Promise<MessageGroup | null> {
  if (isSupabaseSource) {
    return deleteNotificationGroup(groupId, reason);
  }

  await sleep(160, signal);
  return useMessageStore.getState().deleteGroup(groupId);
}

async function retryHistory(
  historyId: string,
  actor: string,
  signal?: AbortSignal
): Promise<MessageHistory | null> {
  if (isSupabaseSource) {
    throw new Error('supabase 모드에서 재시도는 발송 파이프라인이 담당합니다.');
  }

  await sleep(180, signal);
  return useMessageStore.getState().retryHistory(historyId, actor);
}

export function fetchChannelSnapshotSafe(
  channel: MessageChannel,
  signal?: AbortSignal
) {
  return toSafeResult(() =>
    withRetry(() => loadChannelSnapshot(channel, signal), { maxRetries: 1 })
  );
}

export function fetchGroupsSafe(signal?: AbortSignal) {
  return toSafeResult(() => withRetry(() => loadGroups(signal), { maxRetries: 1 }));
}

export function fetchHistoriesSafe(signal?: AbortSignal) {
  return toSafeResult(() => withRetry(() => loadHistories(signal), { maxRetries: 1 }));
}

export function fetchMessageOptionSourcesSafe(signal?: AbortSignal) {
  return toSafeResult(() =>
    withRetry(() => loadMessageOptionSources(signal), { maxRetries: 1 })
  );
}

export function getMessageTemplateSafe(templateId: string) {
  return toSafeResult(() => loadTemplate(templateId));
}

export function saveMessageTemplateSafe(
  payload: SaveMessageTemplatePayload,
  signal?: AbortSignal
) {
  return toSafeResult(() => saveTemplate(payload, signal));
}

export function toggleMessageTemplateSafe(
  payload: ToggleMessageTemplatePayload,
  signal?: AbortSignal
) {
  return toSafeResult(() => toggleTemplate(payload, signal));
}

export function deleteMessageTemplateSafe(
  templateId: string,
  reason?: string,
  signal?: AbortSignal
) {
  return toSafeResult(() => deleteTemplate(templateId, reason, signal));
}

export function sendMessageTemplateSafe(
  payload: SendMessageTemplatePayload,
  signal?: AbortSignal
) {
  return toSafeResult(() => sendTemplate(payload, signal));
}

export function saveMessageGroupSafe(
  payload: SaveMessageGroupPayload,
  signal?: AbortSignal
) {
  return toSafeResult(() => saveGroup(payload, signal));
}

export function previewMessageGroupCountSafe(
  payload: SaveMessageGroupPayload,
  signal?: AbortSignal
) {
  return toSafeResult(() => previewGroupCount(payload, signal));
}

export function recalculateMessageGroupSafe(
  groupId: string,
  signal?: AbortSignal
) {
  return toSafeResult(() => recalculateGroup(groupId, signal));
}

export function deleteMessageGroupSafe(
  groupId: string,
  reason?: string,
  signal?: AbortSignal
) {
  return toSafeResult(() => deleteGroup(groupId, reason, signal));
}

export function retryMessageHistorySafe(
  historyId: string,
  actor: string,
  signal?: AbortSignal
) {
  return toSafeResult(() => retryHistory(historyId, actor, signal));
}

// ---------------------------------------------------------------------------
// 발송 이력 (supabase 모드 전용 — notification_dispatches / delivery_attempts)
// ---------------------------------------------------------------------------

export function fetchNotificationDispatchesSafe(signal?: AbortSignal) {
  return toSafeResult(() =>
    withRetry(() => loadNotificationDispatches(signal), { maxRetries: 1 })
  );
}

export function fetchNotificationDispatchAttemptsSafe(
  dispatchId: string,
  signal?: AbortSignal
) {
  return toSafeResult(() =>
    withRetry(() => loadNotificationDispatchAttempts(dispatchId, signal), {
      maxRetries: 1
    })
  );
}
