import { create } from 'zustand';

import { mockUsers } from '../../users/api/mock-users';
import {
  createInitialMessageGroups,
  createInitialMessageHistories,
  createInitialMessageTemplates
} from '../api/mock-messages';
import type {
  MessageChannel,
  MessageGroup,
  MessageGroupActivityState,
  MessageGroupBuilderMode,
  MessageGroupCountry,
  MessageGroupDefinitionType,
  MessageGroupFilters,
  MessageGroupGender,
  MessageGroupMemberType,
  MessageGroupQueryGroup,
  MessageGroupSignupMethod,
  MessageGroupStatus,
  MessageGroupSubscriptionState,
  MessageHistory,
  MessageHistoryRecipient,
  MessageHistoryStatus,
  MessageSendActionType,
  MessageTemplate,
  MessageTemplateMode,
  MessageTemplateStatus
} from './types';

const CURRENT_ACTOR = 'admin_current';

const GROUP_COUNTRY_WEIGHTS: Record<MessageGroupCountry, number> = {
  '한국 (KR)': 0.58,
  '미국 (US)': 0.24,
  '베트남 (VN)': 0.18
};

const GROUP_MEMBER_TYPE_WEIGHTS: Record<MessageGroupMemberType, number> = {
  학생: 0.62,
  강사: 0.23,
  파트너: 0.15
};

const GROUP_GENDER_WEIGHTS: Record<MessageGroupGender, number> = {
  남성: 0.49,
  여성: 0.51
};

const GROUP_SIGNUP_METHOD_WEIGHTS: Record<MessageGroupSignupMethod, number> = {
  이메일: 0.44,
  구글: 0.28,
  페이스북: 0.11,
  카카오: 0.17
};

const GROUP_SUBSCRIPTION_WEIGHTS: Record<MessageGroupSubscriptionState, number> = {
  구독: 0.73,
  구독해지: 0.27
};

const GROUP_ACTIVITY_WEIGHTS: Record<MessageGroupActivityState, number> = {
  활동: 0.82,
  비활동: 0.18
};

const SAMPLE_NAMES = [
  '김서윤',
  '이도윤',
  '박하준',
  '최서연',
  '정유진',
  '신현우',
  '조민준',
  '윤지민',
  '강예린',
  '서지훈',
  '한도현',
  '오채원'
];

type SaveTemplatePayload = Omit<
  MessageTemplate,
  'id' | 'updatedAt' | 'updatedBy' | 'lastSentAt'
> & {
  id?: string;
};

type ToggleTemplatePayload = {
  templateId: string;
  nextStatus: Extract<MessageTemplateStatus, '활성' | '비활성'>;
};

type SaveGroupPayload = {
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

type SendTemplatePayload = {
  templateId: string;
  channel: MessageChannel;
  groupIds: string[];
  actor: string;
  actionType: MessageSendActionType;
  scheduledAt?: string;
};

type MessageStore = {
  templates: MessageTemplate[];
  groups: MessageGroup[];
  histories: MessageHistory[];
  saveTemplate: (payload: SaveTemplatePayload) => MessageTemplate;
  toggleTemplate: (payload: ToggleTemplatePayload) => MessageTemplate | null;
  deleteTemplate: (templateId: string) => MessageTemplate | null;
  previewGroupCount: (payload: SaveGroupPayload) => number;
  saveGroup: (payload: SaveGroupPayload) => MessageGroup;
  recalculateGroup: (groupId: string) => MessageGroup | null;
  deleteGroup: (groupId: string) => MessageGroup | null;
  sendTemplate: (payload: SendTemplatePayload) => MessageHistory | null;
  retryHistory: (historyId: string, actor: string) => MessageHistory | null;
};

function formatNow(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const mi = String(now.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

function sumWeights<T extends string>(values: T[], weightMap: Record<T, number>, fallback = 1): number {
  if (values.length === 0) {
    return fallback;
  }

  const total = Object.values(weightMap).reduce((sum, weight) => sum + weight, 0);
  const selected = values.reduce((sum, value) => sum + weightMap[value], 0);
  return Math.max(selected / total, 0.08);
}

function getDateRangeFactor(dateRange?: { start?: string; end?: string }): number {
  if (!dateRange?.start || !dateRange?.end) {
    return 1;
  }

  const start = new Date(dateRange.start);
  const end = new Date(dateRange.end);
  const diff = Math.abs(end.getTime() - start.getTime());
  const days = Math.max(Math.round(diff / (1000 * 60 * 60 * 24)), 1);
  return Math.min(Math.max(days / 365, 0.12), 1);
}

function buildRuleSummary(payload: Pick<SaveGroupPayload, 'definitionType' | 'filters' | 'staticMembers' | 'queryBuilderText'>): string {
  if (payload.definitionType === '정적 그룹') {
    return `정적 대상 ${payload.staticMembers.length.toLocaleString()}명`;
  }

  if (payload.queryBuilderText?.trim()) {
    return payload.queryBuilderText.trim().slice(0, 120);
  }

  const memberTypes =
    payload.filters.memberTypes.length > 0 ? payload.filters.memberTypes.join(', ') : '전체 회원';
  const signupMethods =
    payload.filters.signupMethods.length > 0 ? payload.filters.signupMethods.join(', ') : '전체 가입 방식';
  const activityStates =
    payload.filters.activityStates.length > 0 ? payload.filters.activityStates.join(', ') : '전체 활동 상태';

  return `${payload.filters.country} · ${memberTypes} · ${payload.filters.ageRange[0]}-${payload.filters.ageRange[1]}세 · ${signupMethods} · ${activityStates}`;
}

function estimateGroupCount(payload: SaveGroupPayload): number {
  if (payload.definitionType === '정적 그룹') {
    return payload.staticMembers.filter((member) => member.trim().length > 0).length;
  }

  let estimate = 24500;
  estimate *= GROUP_COUNTRY_WEIGHTS[payload.filters.country];
  estimate *= sumWeights(payload.filters.memberTypes, GROUP_MEMBER_TYPE_WEIGHTS);
  estimate *= sumWeights(payload.filters.genders, GROUP_GENDER_WEIGHTS);
  estimate *= Math.max((payload.filters.ageRange[1] - payload.filters.ageRange[0] + 1) / 43, 0.1);
  estimate *= sumWeights(payload.filters.signupMethods, GROUP_SIGNUP_METHOD_WEIGHTS);
  estimate *= getDateRangeFactor(payload.filters.signupDateRange);
  estimate *= sumWeights(payload.filters.subscriptionStates, GROUP_SUBSCRIPTION_WEIGHTS);
  estimate *= sumWeights(payload.filters.activityStates, GROUP_ACTIVITY_WEIGHTS);

  if (payload.builderMode === 'query-builder' && payload.queryBuilderText?.trim()) {
    estimate *= 0.78;
  }

  return Math.max(Math.round(estimate), 17);
}

function getNextTemplateId(
  templates: MessageTemplate[],
  channel: MessageChannel,
  mode: MessageTemplateMode
): string {
  const prefix = `${channel.toUpperCase()}-${mode === 'auto' ? 'AUTO' : 'MAN'}`;
  const sequence =
    templates
      .filter((template) => template.id.startsWith(prefix))
      .map((template) => Number(template.id.split('-')[2] ?? '0'))
      .reduce((max, value) => Math.max(max, value), 0) + 1;

  return `${prefix}-${String(sequence).padStart(3, '0')}`;
}

function getNextGroupId(groups: MessageGroup[]): string {
  const sequence =
    groups
      .map((group) => Number(group.id.split('-')[1] ?? '0'))
      .reduce((max, value) => Math.max(max, value), 0) + 1;
  return `GRP-${String(sequence).padStart(3, '0')}`;
}

function getNextHistoryId(histories: MessageHistory[]): string {
  const sequence =
    histories
      .map((history) => Number(history.id.split('-')[2] ?? '0'))
      .reduce((max, value) => Math.max(max, value), 0) + 1;
  return `MSG-HIS-${String(sequence).padStart(4, '0')}`;
}

function buildGroupName(groups: MessageGroup[], groupIds: string[]): string {
  return groups
    .filter((group) => groupIds.includes(group.id))
    .map((group) => group.name)
    .join(', ');
}

function buildTargetCount(groups: MessageGroup[], groupIds: string[]): number {
  return groups
    .filter((group) => groupIds.includes(group.id))
    .reduce((total, group) => total + group.memberCount, 0);
}

function buildSendResult(
  targetCount: number,
  actionType: MessageSendActionType,
  scheduledAt?: string
): Pick<MessageHistory, 'status' | 'successCount' | 'failureCount' | 'scheduledAt'> {
  if (actionType === '예약 발송') {
    return {
      status: '예약',
      successCount: 0,
      failureCount: 0,
      scheduledAt
    };
  }

  if (targetCount >= 10000) {
    return {
      status: '부분 실패',
      successCount: targetCount - 148,
      failureCount: 148
    };
  }

  if (targetCount >= 2500) {
    return {
      status: '부분 실패',
      successCount: targetCount - 19,
      failureCount: 19
    };
  }

  return {
    status: '완료',
    successCount: targetCount,
    failureCount: 0
  };
}

function createRecipients(options: {
  historyId: string;
  channel: MessageChannel;
  mode: MessageTemplateMode;
  templateName: string;
  targetCount: number;
  successCount: number;
  failureCount: number;
  status: MessageHistoryStatus;
  sentAt: string;
  scheduledAt?: string;
}): MessageHistoryRecipient[] {
  const sampleSize = Math.min(Math.max(options.failureCount > 0 ? 18 : 12, 1), options.targetCount, 24);
  const failureSamples =
    options.status === '예약'
      ? 0
      : Math.min(options.failureCount, sampleSize > 1 ? Math.max(Math.round(sampleSize * 0.18), 1) : 0);

  return Array.from({ length: sampleSize }, (_, index) => {
    const isFailure = failureSamples > 0 && index < failureSamples;
    const sampleUser =
      mockUsers[
        (options.historyId.length + options.targetCount + index) % mockUsers.length
      ];
    const userId = sampleUser.id;
    const normalizedId = `${options.historyId.replaceAll('-', '').toLowerCase()}${String(index + 1).padStart(2, '0')}`;

    return {
      id: `${options.historyId}-REC-${String(index + 1).padStart(3, '0')}`,
      userId,
      userName: sampleUser.realName || SAMPLE_NAMES[index % SAMPLE_NAMES.length],
      destination:
        options.channel === 'mail'
          ? `${normalizedId}@example.com`
          : `device-${normalizedId}`,
      mode: options.mode,
      templateName: options.templateName,
      status: options.status === '예약' ? '예약' : isFailure ? '실패' : '성공',
      sentAt: options.status === '예약' ? options.scheduledAt ?? options.sentAt : options.sentAt,
      failureReason: isFailure ? '수신 채널 응답 지연으로 재시도 필요' : undefined
    };
  });
}

export const useMessageStore = create<MessageStore>((set, get) => ({
  templates: createInitialMessageTemplates(),
  groups: createInitialMessageGroups(),
  histories: createInitialMessageHistories(),
  saveTemplate: (payload) => {
    const now = formatNow();
    const nextTemplate: MessageTemplate = {
      ...payload,
      id: payload.id ?? getNextTemplateId(get().templates, payload.channel, payload.mode),
      lastSentAt:
        get().templates.find((template) => template.id === payload.id)?.lastSentAt ?? undefined,
      updatedAt: now,
      updatedBy: CURRENT_ACTOR
    };

    set((state) => {
      const exists = state.templates.some((template) => template.id === nextTemplate.id);
      return {
        templates: exists
          ? state.templates.map((template) =>
              template.id === nextTemplate.id ? nextTemplate : template
            )
          : [nextTemplate, ...state.templates]
      };
    });

    return nextTemplate;
  },
  toggleTemplate: ({ templateId, nextStatus }) => {
    const target = get().templates.find((template) => template.id === templateId);
    if (!target) {
      return null;
    }

    const nextTemplate: MessageTemplate = {
      ...target,
      status: nextStatus,
      updatedAt: formatNow(),
      updatedBy: CURRENT_ACTOR
    };

    set((state) => ({
      templates: state.templates.map((template) =>
        template.id === templateId ? nextTemplate : template
      )
    }));

    return nextTemplate;
  },
  deleteTemplate: (templateId) => {
    const target = get().templates.find((template) => template.id === templateId);
    if (!target) {
      return null;
    }

    set((state) => ({
      templates: state.templates.filter((template) => template.id !== templateId)
    }));

    return target;
  },
  previewGroupCount: (payload) => estimateGroupCount(payload),
  saveGroup: (payload) => {
    const now = formatNow();
    const nextGroup: MessageGroup = {
      ...payload,
      id: payload.id ?? getNextGroupId(get().groups),
      memberCount: estimateGroupCount(payload),
      ruleSummary: buildRuleSummary(payload),
      lastCalculatedAt: now,
      updatedAt: now,
      updatedBy: CURRENT_ACTOR
    };

    set((state) => {
      const exists = state.groups.some((group) => group.id === nextGroup.id);
      return {
        groups: exists
          ? state.groups.map((group) => (group.id === nextGroup.id ? nextGroup : group))
          : [nextGroup, ...state.groups]
      };
    });

    return nextGroup;
  },
  recalculateGroup: (groupId) => {
    const target = get().groups.find((group) => group.id === groupId);
    if (!target) {
      return null;
    }

      const payload: SaveGroupPayload = {
        id: target.id,
        name: target.name,
        description: target.description,
      definitionType: target.definitionType,
      builderMode: target.builderMode,
      channels: target.channels,
        status: target.status,
        staticMembers: target.staticMembers,
        filters: target.filters,
        queryBuilderText: target.queryBuilderText,
        queryBuilderConfig: target.queryBuilderConfig
      };

    const refreshed: MessageGroup = {
      ...target,
      memberCount: estimateGroupCount(payload),
      ruleSummary: buildRuleSummary(payload),
      lastCalculatedAt: formatNow(),
      updatedAt: formatNow(),
      updatedBy: CURRENT_ACTOR
    };

    set((state) => ({
      groups: state.groups.map((group) => (group.id === groupId ? refreshed : group))
    }));

    return refreshed;
  },
  deleteGroup: (groupId) => {
    const target = get().groups.find((group) => group.id === groupId);
    if (!target) {
      return null;
    }

    set((state) => ({
      groups: state.groups.filter((group) => group.id !== groupId)
    }));

    return target;
  },
  sendTemplate: ({ templateId, channel, groupIds, actor, actionType, scheduledAt }) => {
    const template = get().templates.find((item) => item.id === templateId);
    if (!template) {
      return null;
    }

    const groups = get().groups;
    const targetCount = buildTargetCount(groups, groupIds);
    const sendResult = buildSendResult(targetCount, actionType, scheduledAt);
    const historyId = getNextHistoryId(get().histories);
    const sentAt = formatNow();
    const history: MessageHistory = {
      id: historyId,
      channel,
      mode: template.mode,
      templateId: template.id,
      templateName: template.name,
      groupIds,
      groupName: buildGroupName(groups, groupIds),
      targetCount,
      successCount: sendResult.successCount,
      failureCount: sendResult.failureCount,
      status: sendResult.status,
      actionType,
      scheduledAt: sendResult.scheduledAt,
      sentAt,
      actor,
      recipients: createRecipients({
        historyId,
        channel,
        mode: template.mode,
        templateName: template.name,
        targetCount,
        successCount: sendResult.successCount,
        failureCount: sendResult.failureCount,
        status: sendResult.status,
        sentAt,
        scheduledAt: sendResult.scheduledAt
      })
    };

    set((state) => ({
      histories: [history, ...state.histories],
      templates: state.templates.map((item) =>
        item.id === templateId
          ? {
              ...item,
              lastSentAt: history.status === '예약' ? item.lastSentAt : history.sentAt,
              updatedAt: history.sentAt,
              updatedBy: actor,
              status: item.status === '초안' ? '활성' : item.status
            }
          : item
      )
    }));

    return history;
  },
  retryHistory: (historyId, actor) => {
    const history = get().histories.find((item) => item.id === historyId);
    if (!history) {
      return null;
    }

    return get().sendTemplate({
      templateId: history.templateId,
      channel: history.channel,
      groupIds: history.groupIds,
      actor,
      actionType: '재시도'
    });
  }
}));
