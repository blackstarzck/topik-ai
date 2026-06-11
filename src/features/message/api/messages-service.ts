import { toSafeResult, withRetry } from '../../../shared/api/safe-request';
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
};

export type ToggleMessageTemplatePayload = {
  templateId: string;
  nextStatus: Extract<MessageTemplateStatus, '활성' | '비활성'>;
};

export type SendMessageTemplatePayload = {
  templateId: string;
  channel: MessageChannel;
  groupIds: string[];
  actor: string;
  actionType: MessageSendActionType;
  scheduledAt?: string;
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
};

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
  await sleep(240, signal);
  const state = useMessageStore.getState();
  return {
    templates: state.templates.filter((template) => template.channel === channel),
    groups: state.groups.filter((group) => group.channels.includes(channel))
  };
}

async function loadGroups(signal?: AbortSignal): Promise<MessageGroup[]> {
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
  await sleep(180, signal);
  return useMessageStore.getState().saveTemplate(payload);
}

async function toggleTemplate(
  payload: ToggleMessageTemplatePayload,
  signal?: AbortSignal
): Promise<MessageTemplate | null> {
  await sleep(160, signal);
  return useMessageStore.getState().toggleTemplate(payload);
}

async function deleteTemplate(
  templateId: string,
  signal?: AbortSignal
): Promise<MessageTemplate | null> {
  await sleep(160, signal);
  return useMessageStore.getState().deleteTemplate(templateId);
}

async function sendTemplate(
  payload: SendMessageTemplatePayload,
  signal?: AbortSignal
): Promise<MessageHistory | null> {
  await sleep(200, signal);
  return useMessageStore.getState().sendTemplate(payload);
}

async function saveGroup(
  payload: SaveMessageGroupPayload,
  signal?: AbortSignal
): Promise<MessageGroup> {
  await sleep(180, signal);
  return useMessageStore.getState().saveGroup(payload);
}

async function previewGroupCount(
  payload: SaveMessageGroupPayload,
  signal?: AbortSignal
): Promise<number> {
  await sleep(120, signal);
  return useMessageStore.getState().previewGroupCount(payload);
}

async function recalculateGroup(
  groupId: string,
  signal?: AbortSignal
): Promise<MessageGroup | null> {
  await sleep(160, signal);
  return useMessageStore.getState().recalculateGroup(groupId);
}

async function deleteGroup(
  groupId: string,
  signal?: AbortSignal
): Promise<MessageGroup | null> {
  await sleep(160, signal);
  return useMessageStore.getState().deleteGroup(groupId);
}

async function retryHistory(
  historyId: string,
  actor: string,
  signal?: AbortSignal
): Promise<MessageHistory | null> {
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
  signal?: AbortSignal
) {
  return toSafeResult(() => deleteTemplate(templateId, signal));
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

export function deleteMessageGroupSafe(groupId: string, signal?: AbortSignal) {
  return toSafeResult(() => deleteGroup(groupId, signal));
}

export function retryMessageHistorySafe(
  historyId: string,
  actor: string,
  signal?: AbortSignal
) {
  return toSafeResult(() => retryHistory(historyId, actor, signal));
}
