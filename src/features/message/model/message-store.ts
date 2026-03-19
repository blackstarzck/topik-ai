import { create } from 'zustand';

import { mockUsers } from '../../users/api/mock-users';
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

const DEFAULT_FILTERS: MessageGroupFilters = {
  country: '한국 (KR)',
  memberTypes: ['학생'],
  genders: ['남성', '여성'],
  ageRange: [18, 34],
  signupMethods: ['이메일', '구글'],
  signupDateRange: {
    start: '2025-01-01',
    end: '2025-03-10'
  },
  subscriptionStates: ['구독'],
  activityStates: ['활동']
};

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

function createGroup(seed: Omit<MessageGroup, 'memberCount' | 'ruleSummary' | 'lastCalculatedAt' | 'updatedAt' | 'updatedBy'> & {
  updatedAt: string;
  updatedBy: string;
  lastCalculatedAt: string;
}): MessageGroup {
  const payload: SaveGroupPayload = {
    id: seed.id,
    name: seed.name,
    description: seed.description,
    definitionType: seed.definitionType,
    builderMode: seed.builderMode,
    channels: seed.channels,
    status: seed.status,
    staticMembers: seed.staticMembers,
    filters: seed.filters,
    queryBuilderText: seed.queryBuilderText
  };

  return {
    ...seed,
    memberCount: estimateGroupCount(payload),
    ruleSummary: buildRuleSummary(payload),
    lastCalculatedAt: seed.lastCalculatedAt,
    updatedAt: seed.updatedAt,
    updatedBy: seed.updatedBy
  };
}

const initialGroups: MessageGroup[] = [
  createGroup({
    id: 'GRP-001',
    name: '활성 학습자',
    description: '최근 90일 내 학습 활동이 있는 학생 중심 그룹',
    definitionType: '조건 기반 그룹',
    builderMode: 'simple',
    channels: ['mail', 'push'],
    status: '사용중',
    staticMembers: [],
    filters: {
      country: '한국 (KR)',
      memberTypes: ['학생'],
      genders: ['남성', '여성'],
      ageRange: [18, 30],
      signupMethods: ['이메일', '구글'],
      signupDateRange: {
        start: '2025-03-10',
        end: '2026-03-10'
      },
      subscriptionStates: ['구독'],
      activityStates: ['활동']
    },
    updatedAt: '2026-03-10 09:10',
    updatedBy: 'admin_park',
    lastCalculatedAt: '2026-03-10 09:08'
  }),
  createGroup({
    id: 'GRP-002',
    name: '휴면 예정 강사',
    description: '결제 상태는 정상이나 최근 접속이 없는 강사 그룹',
    definitionType: '조건 기반 그룹',
    builderMode: 'query-builder',
    channels: ['mail', 'push'],
    status: '사용중',
    staticMembers: [],
    filters: {
      country: '미국 (US)',
      memberTypes: ['강사'],
      genders: ['남성', '여성'],
      ageRange: [25, 50],
      signupMethods: ['구글', '페이스북'],
      signupDateRange: {
        start: '2024-09-01',
        end: '2025-12-31'
      },
      subscriptionStates: ['구독'],
      activityStates: ['비활동']
    },
    queryBuilderText:
      "country = 'US' AND member_type = '강사' AND last_login_at <= NOW() - INTERVAL '25 day' AND subscription_state = '구독'",
    updatedAt: '2026-03-09 15:40',
    updatedBy: 'admin_kim',
    lastCalculatedAt: '2026-03-09 15:32'
  }),
  createGroup({
    id: 'GRP-003',
    name: 'VIP 고객',
    description: '운영팀이 직접 관리하는 정적 VIP 대상 그룹',
    definitionType: '정적 그룹',
    builderMode: 'simple',
    channels: ['mail', 'push'],
    status: '사용중',
    staticMembers: [
      'vip-01@example.com',
      'vip-02@example.com',
      'vip-03@example.com',
      'vip-04@example.com',
      'vip-05@example.com'
    ],
    filters: DEFAULT_FILTERS,
    updatedAt: '2026-03-08 14:15',
    updatedBy: 'admin_lee',
    lastCalculatedAt: '2026-03-08 14:15'
  }),
  createGroup({
    id: 'GRP-004',
    name: '운영 공지 구독자',
    description: '운영 공지 수신 동의 및 최근 활동 이력이 있는 전체 그룹',
    definitionType: '조건 기반 그룹',
    builderMode: 'simple',
    channels: ['mail', 'push'],
    status: '사용중',
    staticMembers: [],
    filters: {
      country: '한국 (KR)',
      memberTypes: ['학생', '강사', '파트너'],
      genders: ['남성', '여성'],
      ageRange: [18, 45],
      signupMethods: ['이메일', '구글', '카카오'],
      signupDateRange: {
        start: '2024-01-01',
        end: '2026-03-10'
      },
      subscriptionStates: ['구독'],
      activityStates: ['활동', '비활동']
    },
    updatedAt: '2026-03-07 10:05',
    updatedBy: 'admin_park',
    lastCalculatedAt: '2026-03-07 10:02'
  })
];

const initialTemplates: MessageTemplate[] = [
  {
    id: 'MAIL-AUTO-001',
    channel: 'mail',
    mode: 'auto',
    category: '온보딩',
    name: '가입 환영 메일',
    summary: '회원 가입 직후 발송하는 기본 환영 메일입니다.',
    subject: '[TOPIK AI] 가입을 환영합니다.',
    targetGroupIds: ['GRP-001'],
    status: '활성',
    triggerLabel: '회원 가입 직후',
    bodyHtml:
      '<h2>TOPIK AI에 오신 것을 환영합니다</h2><p>가입 후 7일 동안 주요 기능 안내를 순차 발송합니다.</p>',
    bodyJson: JSON.stringify(
      {
        blocks: [
          { type: 'heading', data: { level: 2, text: 'TOPIK AI에 오신 것을 환영합니다' } },
          { type: 'paragraph', data: { text: '가입 후 7일 동안 주요 기능 안내를 순차 발송합니다.' } }
        ]
      },
      null,
      2
    ),
    lastSentAt: '2026-03-10 09:10',
    updatedAt: '2026-03-09 18:20',
    updatedBy: 'admin_park'
  },
  {
    id: 'MAIL-AUTO-002',
    channel: 'mail',
    mode: 'auto',
    category: '결제',
    name: '결제 실패 리마인드',
    summary: '정기 결제 실패 후 1시간 뒤 자동 발송합니다.',
    subject: '[TOPIK AI] 결제 정보를 다시 확인해주세요.',
    targetGroupIds: ['GRP-002'],
    status: '활성',
    triggerLabel: '결제 실패 후 1시간',
    bodyHtml:
      '<p>결제가 정상 처리되지 않았습니다.</p><p>카드 정보를 확인한 뒤 다시 시도해주세요.</p>',
    bodyJson: JSON.stringify(
      {
        blocks: [
          { type: 'paragraph', data: { text: '결제가 정상 처리되지 않았습니다.' } },
          { type: 'paragraph', data: { text: '카드 정보를 확인한 뒤 다시 시도해주세요.' } }
        ]
      },
      null,
      2
    ),
    lastSentAt: '2026-03-10 08:30',
    updatedAt: '2026-03-08 13:10',
    updatedBy: 'admin_kim'
  },
  {
    id: 'MAIL-MAN-001',
    channel: 'mail',
    mode: 'manual',
    category: '마케팅',
    name: '월간 뉴스레터',
    summary: '이번 달 주요 소식과 기능 업데이트를 모아 발송하는 템플릿입니다.',
    subject: '[TOPIK AI] 월간 뉴스레터 3월호',
    targetGroupIds: ['GRP-001', 'GRP-004'],
    status: '초안',
    bodyHtml:
      '<h3>3월 주요 업데이트</h3><ul><li>메시지 센터 개편</li><li>학습 대시보드 개선</li></ul>',
    bodyJson: JSON.stringify(
      {
        blocks: [
          { type: 'heading', data: { level: 3, text: '3월 주요 업데이트' } },
          { type: 'list', data: { style: 'unordered', items: ['메시지 센터 개편', '학습 대시보드 개선'] } }
        ]
      },
      null,
      2
    ),
    lastSentAt: '2026-02-28 10:20',
    updatedAt: '2026-03-10 09:30',
    updatedBy: 'admin_park'
  },
  {
    id: 'MAIL-MAN-002',
    channel: 'mail',
    mode: 'manual',
    category: '고객 안내',
    name: 'VIP 행사 초대 메일',
    summary: 'VIP 고객 대상으로 오프라인 설명회 초대 메일을 보냅니다.',
    subject: '[TOPIK AI] VIP 행사 초대',
    targetGroupIds: ['GRP-003'],
    status: '활성',
    bodyHtml:
      '<p>VIP 고객님을 위한 오프라인 설명회에 초대드립니다.</p><p>아래 버튼으로 참석 여부를 알려주세요.</p>',
    bodyJson: JSON.stringify(
      {
        blocks: [
          { type: 'paragraph', data: { text: 'VIP 고객님을 위한 오프라인 설명회에 초대드립니다.' } },
          { type: 'paragraph', data: { text: '아래 버튼으로 참석 여부를 알려주세요.' } }
        ]
      },
      null,
      2
    ),
    lastSentAt: '2026-03-04 16:30',
    updatedAt: '2026-03-09 12:00',
    updatedBy: 'admin_lee'
  },
  {
    id: 'PUSH-AUTO-001',
    channel: 'push',
    mode: 'auto',
    category: '커뮤니티',
    name: '댓글 답변 알림',
    summary: '내 게시글에 새 댓글이 달리면 즉시 푸시합니다.',
    subject: '새 댓글이 도착했습니다.',
    targetGroupIds: ['GRP-001'],
    status: '활성',
    triggerLabel: '새 댓글 등록 직후',
    bodyHtml: '<p>새 댓글이 도착했습니다. 운영 화면에서 바로 확인해보세요.</p>',
    bodyJson: JSON.stringify(
      {
        blocks: [{ type: 'paragraph', data: { text: '새 댓글이 도착했습니다. 운영 화면에서 바로 확인해보세요.' } }]
      },
      null,
      2
    ),
    lastSentAt: '2026-03-10 09:45',
    updatedAt: '2026-03-08 14:05',
    updatedBy: 'admin_kim'
  },
  {
    id: 'PUSH-AUTO-002',
    channel: 'push',
    mode: 'auto',
    category: '결제',
    name: '정기 결제 예정 알림',
    summary: '결제 예정 하루 전에 푸시를 보냅니다.',
    subject: '정기 결제 예정 안내',
    targetGroupIds: ['GRP-001'],
    status: '활성',
    triggerLabel: '결제 예정 하루 전',
    bodyHtml: '<p>내일 정기 결제가 예정되어 있습니다.</p>',
    bodyJson: JSON.stringify(
      {
        blocks: [{ type: 'paragraph', data: { text: '내일 정기 결제가 예정되어 있습니다.' } }]
      },
      null,
      2
    ),
    lastSentAt: '2026-03-09 19:00',
    updatedAt: '2026-03-08 10:25',
    updatedBy: 'admin_park'
  },
  {
    id: 'PUSH-MAN-001',
    channel: 'push',
    mode: 'manual',
    category: '운영',
    name: '점검 공지 푸시',
    summary: '긴급 점검 공지를 푸시로 전달합니다.',
    subject: '서비스 점검 안내',
    targetGroupIds: ['GRP-004'],
    status: '활성',
    bodyHtml: '<p>오늘 23:00부터 23:30까지 긴급 점검을 진행합니다.</p>',
    bodyJson: JSON.stringify(
      {
        blocks: [{ type: 'paragraph', data: { text: '오늘 23:00부터 23:30까지 긴급 점검을 진행합니다.' } }]
      },
      null,
      2
    ),
    lastSentAt: '2026-03-03 22:10',
    updatedAt: '2026-03-09 08:20',
    updatedBy: 'admin_park'
  },
  {
    id: 'PUSH-MAN-002',
    channel: 'push',
    mode: 'manual',
    category: '마케팅',
    name: '주말 캠페인 안내',
    summary: '주말 한정 프로모션 안내 수동 푸시입니다.',
    subject: '이번 주말 한정 혜택',
    targetGroupIds: ['GRP-001', 'GRP-003'],
    status: '초안',
    bodyHtml: '<p>주말 한정 프로모션이 시작되었습니다. 앱에서 바로 확인해보세요.</p>',
    bodyJson: JSON.stringify(
      {
        blocks: [
          { type: 'paragraph', data: { text: '주말 한정 프로모션이 시작되었습니다. 앱에서 바로 확인해보세요.' } }
        ]
      },
      null,
      2
    ),
    lastSentAt: '2026-03-01 09:40',
    updatedAt: '2026-03-10 09:00',
    updatedBy: 'admin_lee'
  }
];

function createHistory(seed: Omit<MessageHistory, 'recipients'>): MessageHistory {
  return {
    ...seed,
    recipients: createRecipients({
      historyId: seed.id,
      channel: seed.channel,
      mode: seed.mode,
      templateName: seed.templateName,
      targetCount: seed.targetCount,
      successCount: seed.successCount,
      failureCount: seed.failureCount,
      status: seed.status,
      sentAt: seed.sentAt,
      scheduledAt: seed.scheduledAt
    })
  };
}

const initialHistories: MessageHistory[] = [
  createHistory({
    id: 'MSG-HIS-0001',
    channel: 'mail',
    mode: 'manual',
    templateId: 'MAIL-MAN-001',
    templateName: '월간 뉴스레터',
    groupIds: ['GRP-001', 'GRP-004'],
    groupName: buildGroupName(initialGroups, ['GRP-001', 'GRP-004']),
    targetCount: buildTargetCount(initialGroups, ['GRP-001', 'GRP-004']),
    successCount: buildTargetCount(initialGroups, ['GRP-001', 'GRP-004']) - 148,
    failureCount: 148,
    status: '부분 실패',
    actionType: '즉시 발송',
    sentAt: '2026-03-08 10:15',
    actor: 'admin_park'
  }),
  createHistory({
    id: 'MSG-HIS-0002',
    channel: 'mail',
    mode: 'auto',
    templateId: 'MAIL-AUTO-001',
    templateName: '가입 환영 메일',
    groupIds: ['GRP-001'],
    groupName: buildGroupName(initialGroups, ['GRP-001']),
    targetCount: 21,
    successCount: 19,
    failureCount: 2,
    status: '부분 실패',
    actionType: '즉시 발송',
    sentAt: '2026-03-10 09:10',
    actor: 'system'
  }),
  createHistory({
    id: 'MSG-HIS-0003',
    channel: 'push',
    mode: 'manual',
    templateId: 'PUSH-MAN-001',
    templateName: '점검 공지 푸시',
    groupIds: ['GRP-004'],
    groupName: buildGroupName(initialGroups, ['GRP-004']),
    targetCount: buildTargetCount(initialGroups, ['GRP-004']),
    successCount: buildTargetCount(initialGroups, ['GRP-004']),
    failureCount: 0,
    status: '완료',
    actionType: '즉시 발송',
    sentAt: '2026-03-03 22:10',
    actor: 'admin_park'
  }),
  createHistory({
    id: 'MSG-HIS-0004',
    channel: 'push',
    mode: 'auto',
    templateId: 'PUSH-AUTO-002',
    templateName: '정기 결제 예정 알림',
    groupIds: ['GRP-001'],
    groupName: buildGroupName(initialGroups, ['GRP-001']),
    targetCount: 910,
    successCount: 0,
    failureCount: 910,
    status: '실패',
    actionType: '즉시 발송',
    sentAt: '2026-03-07 19:00',
    actor: 'system'
  }),
  createHistory({
    id: 'MSG-HIS-0005',
    channel: 'mail',
    mode: 'manual',
    templateId: 'MAIL-MAN-002',
    templateName: 'VIP 행사 초대 메일',
    groupIds: ['GRP-003'],
    groupName: buildGroupName(initialGroups, ['GRP-003']),
    targetCount: buildTargetCount(initialGroups, ['GRP-003']),
    successCount: 0,
    failureCount: 0,
    status: '예약',
    actionType: '예약 발송',
    scheduledAt: '2026-03-12 09:00',
    sentAt: '2026-03-10 08:50',
    actor: 'admin_lee'
  })
];

export const useMessageStore = create<MessageStore>((set, get) => ({
  templates: initialTemplates,
  groups: initialGroups,
  histories: initialHistories,
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
      queryBuilderText: target.queryBuilderText
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
