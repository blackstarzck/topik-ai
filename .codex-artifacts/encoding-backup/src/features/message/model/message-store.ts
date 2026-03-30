import { create } from 'zustand';

import { mockUsers } from '../../users/api/mock-users';
import { createDefaultMessageGroupFilters } from './message-group-segment-schema';
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
  '?쒓뎅 (KR)': 0.58,
  '誘멸뎅 (US)': 0.24,
  '踰좏듃??(VN)': 0.18
};

const GROUP_MEMBER_TYPE_WEIGHTS: Record<MessageGroupMemberType, number> = {
  ?숈깮: 0.62,
  媛뺤궗: 0.23,
  ?뚰듃?? 0.15
};

const GROUP_GENDER_WEIGHTS: Record<MessageGroupGender, number> = {
  ?⑥꽦: 0.49,
  ?ъ꽦: 0.51
};

const GROUP_SIGNUP_METHOD_WEIGHTS: Record<MessageGroupSignupMethod, number> = {
  이메일 0.44,
  援ш?: 0.28,
  ?섏씠?ㅻ턿: 0.11,
  移댁뭅?? 0.17
};

const GROUP_SUBSCRIPTION_WEIGHTS: Record<MessageGroupSubscriptionState, number> = {
  구독: 0.73,
  구독?댁?: 0.27
};

const GROUP_ACTIVITY_WEIGHTS: Record<MessageGroupActivityState, number> = {
  활동: 0.82,
  비활성 0.18
};

const SAMPLE_NAMES = [
  '源?쒖쑄',
  '?대룄??,
  '諛뺥븯以',
  '理쒖꽌??,
  '?뺤쑀吏?,
  '?좏쁽??,
  '議곕?以',
  '?ㅼ?誘?,
  '媛뺤삁由?,
  '?쒖???,
  '?쒕룄??,
  '?ㅼ콈??
];

const DEFAULT_FILTERS: MessageGroupFilters = createDefaultMessageGroupFilters('2026-03-10');

type SaveTemplatePayload = Omit<
  MessageTemplate,
  'id' | 'updatedAt' | 'updatedBy' | 'lastSentAt'
> & {
  id?: string;
};

type ToggleTemplatePayload = {
  templateId: string;
  nextStatus: Extract<MessageTemplateStatus, '활성' | '비활성>;
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
  if (payload.definitionType === '?뺤쟻 洹몃９') {
    return `?뺤쟻 대상${payload.staticMembers.length.toLocaleString()}紐?;
  }

  if (payload.queryBuilderText?.trim()) {
    return payload.queryBuilderText.trim().slice(0, 120);
  }

  const memberTypes =
    payload.filters.memberTypes.length > 0 ? payload.filters.memberTypes.join(', ') : '전체 회원';
  const signupMethods =
    payload.filters.signupMethods.length > 0 ? payload.filters.signupMethods.join(', ') : '전체 媛??諛⑹떇';
  const activityStates =
    payload.filters.activityStates.length > 0 ? payload.filters.activityStates.join(', ') : '전체 활동 상태';

  return `${payload.filters.country} 쨌 ${memberTypes} 쨌 ${payload.filters.ageRange[0]}-${payload.filters.ageRange[1]}??쨌 ${signupMethods} 쨌 ${activityStates}`;
}

function estimateGroupCount(payload: SaveGroupPayload): number {
  if (payload.definitionType === '?뺤쟻 洹몃９') {
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
      failureReason: isFailure ? '?섏떊 梨꾨꼸 ?묐떟 吏?곗쑝濡??ъ떆???꾩슂' : undefined
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
    queryBuilderText: seed.queryBuilderText,
    queryBuilderConfig: seed.queryBuilderConfig
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
    name: '활성 ?숈뒿??,
    description: '理쒓렐 90?????숈뒿 활동???덈뒗 ?숈깮 以묒떖 洹몃９',
    definitionType: '議곌굔 湲곕컲 洹몃９',
    builderMode: 'simple',
    channels: ['mail', 'push'],
    status: '?ъ슜以?,
    staticMembers: [],
    filters: {
      country: '?쒓뎅 (KR)',
      memberTypes: ['?숈깮'],
      genders: ['?⑥꽦', '?ъ꽦'],
      ageRange: [18, 30],
      signupMethods: ['이메일, '援ш?'],
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
    name: '?대㈃ ?덉젙 媛뺤궗',
    description: '결제 상태??정상?대굹 최근 접속???녿뒗 媛뺤궗 洹몃９',
    definitionType: '議곌굔 湲곕컲 洹몃９',
    builderMode: 'query-builder',
    channels: ['mail', 'push'],
    status: '?ъ슜以?,
    staticMembers: [],
    filters: {
      country: '誘멸뎅 (US)',
      memberTypes: ['媛뺤궗'],
      genders: ['?⑥꽦', '?ъ꽦'],
      ageRange: [25, 50],
      signupMethods: ['援ш?', '?섏씠?ㅻ턿'],
      signupDateRange: {
        start: '2024-09-01',
        end: '2025-12-31'
      },
      subscriptionStates: ['구독'],
      activityStates: ['비활성]
    },
    queryBuilderText:
      "country = 'US' AND member_type = '媛뺤궗' AND activity_state = '비활성 AND subscription_state = '구독'",
    queryBuilderConfig: {
      type: 'group',
      id: 'group-seed-002',
      combinator: 'and',
      children: [
        {
          type: 'rule',
          id: 'rule-seed-002-country',
          field: 'country',
          operator: 'equals',
          value: '誘멸뎅 (US)'
        },
        {
          type: 'rule',
          id: 'rule-seed-002-member-type',
          field: 'memberType',
          operator: 'equals',
          value: '媛뺤궗'
        },
        {
          type: 'rule',
          id: 'rule-seed-002-activity',
          field: 'activityState',
          operator: 'equals',
          value: '비활성
        },
        {
          type: 'rule',
          id: 'rule-seed-002-subscription',
          field: 'subscriptionState',
          operator: 'equals',
          value: '구독'
        }
      ]
    },
    updatedAt: '2026-03-09 15:40',
    updatedBy: 'admin_kim',
    lastCalculatedAt: '2026-03-09 15:32'
  }),
  createGroup({
    id: 'GRP-003',
    name: 'VIP 怨좉컼',
    description: '운영대상吏곸젒 愿由ы븯???뺤쟻 VIP 대상洹몃９',
    definitionType: '?뺤쟻 洹몃９',
    builderMode: 'simple',
    channels: ['mail', 'push'],
    status: '?ъ슜以?,
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
    name: '운영 공지 구독??,
    description: '운영 공지 ?섏떊 ?숈쓽 諛?理쒓렐 활동 ?대젰???덈뒗 전체 洹몃９',
    definitionType: '議곌굔 湲곕컲 洹몃９',
    builderMode: 'simple',
    channels: ['mail', 'push'],
    status: '?ъ슜以?,
    staticMembers: [],
    filters: {
      country: '?쒓뎅 (KR)',
      memberTypes: ['?숈깮', '媛뺤궗', '?뚰듃??],
      genders: ['?⑥꽦', '?ъ꽦'],
      ageRange: [18, 45],
      signupMethods: ['이메일, '援ш?', '移댁뭅??],
      signupDateRange: {
        start: '2024-01-01',
        end: '2026-03-10'
      },
      subscriptionStates: ['구독'],
      activityStates: ['활동', '비활성]
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
    category: '?⑤낫??,
    name: '媛???섏쁺 硫붿씪',
    summary: '회원 媛??吏곹썑 발송?섎뒗 湲곕낯 ?섏쁺 硫붿씪?낅땲??',
    subject: '[TOPIK AI] 媛?낆쓣 ?섏쁺?⑸땲??',
    targetGroupIds: ['GRP-001'],
    status: '활성',
    triggerLabel: '회원 媛??吏곹썑',
    bodyHtml:
      '<h2>TOPIK AI???ㅼ떊 寃껋쓣 ?섏쁺?⑸땲??/h2><p>媛????7???숈븞 二쇱슂 湲곕뒫 ?덈궡瑜??쒖감 발송?⑸땲??</p>',
    bodyJson: JSON.stringify(
      {
        blocks: [
          { type: 'heading', data: { level: 2, text: 'TOPIK AI???ㅼ떊 寃껋쓣 ?섏쁺?⑸땲?? } },
          { type: 'paragraph', data: { text: '媛????7???숈븞 二쇱슂 湲곕뒫 ?덈궡瑜??쒖감 발송?⑸땲??' } }
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
    name: '결제 실패 由щ쭏?몃뱶',
    summary: '?뺢린 결제 실패 수1?쒓컙 ???먮룞 발송?⑸땲??',
    subject: '[TOPIK AI] 결제 ?뺣낫瑜??ㅼ떆 ?뺤씤?댁＜?몄슂.',
    targetGroupIds: ['GRP-002'],
    status: '활성',
    triggerLabel: '결제 실패 수1?쒓컙',
    bodyHtml:
      '<p>결제媛 정상 泥섎━?섏? ?딆븯?듬땲??</p><p>移대뱶 ?뺣낫瑜??뺤씤?????ㅼ떆 ?쒕룄?댁＜?몄슂.</p>',
    bodyJson: JSON.stringify(
      {
        blocks: [
          { type: 'paragraph', data: { text: '결제媛 정상 泥섎━?섏? ?딆븯?듬땲??' } },
          { type: 'paragraph', data: { text: '移대뱶 ?뺣낫瑜??뺤씤?????ㅼ떆 ?쒕룄?댁＜?몄슂.' } }
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
    category: '留덉???,
    name: '?붽컙 ?댁뒪?덊꽣',
    summary: '?대쾲 ??二쇱슂 ?뚯떇怨?湲곕뒫 ?낅뜲?댄듃瑜?紐⑥븘 발송?섎뒗 ?쒗뵆由우엯?덈떎.',
    subject: '[TOPIK AI] ?붽컙 ?댁뒪?덊꽣 3?뷀샇',
    targetGroupIds: ['GRP-001', 'GRP-004'],
    status: '珥덉븞',
    bodyHtml:
      '<h3>3??二쇱슂 ?낅뜲?댄듃</h3><ul><li>硫붿떆吏 ?쇳꽣 媛쒗렪</li><li>?숈뒿 대시보드媛쒖꽑</li></ul>',
    bodyJson: JSON.stringify(
      {
        blocks: [
          { type: 'heading', data: { level: 3, text: '3??二쇱슂 ?낅뜲?댄듃' } },
          { type: 'list', data: { style: 'unordered', items: ['硫붿떆吏 ?쇳꽣 媛쒗렪', '?숈뒿 대시보드媛쒖꽑'] } }
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
    category: '怨좉컼 ?덈궡',
    name: 'VIP ?됱궗 珥덈? 硫붿씪',
    summary: 'VIP 怨좉컼 ??곸쑝濡??ㅽ봽?쇱씤 설명??珥덈? 硫붿씪??蹂대깄?덈떎.',
    subject: '[TOPIK AI] VIP ?됱궗 珥덈?',
    targetGroupIds: ['GRP-003'],
    status: '활성',
    bodyHtml:
      '<p>VIP 怨좉컼?섏쓣 ?꾪븳 ?ㅽ봽?쇱씤 설명?뚯뿉 珥덈??쒕┰?덈떎.</p><p>?꾨옒 踰꾪듉?쇰줈 李몄꽍 ?щ?瑜??뚮젮二쇱꽭??</p>',
    bodyJson: JSON.stringify(
      {
        blocks: [
          { type: 'paragraph', data: { text: 'VIP 怨좉컼?섏쓣 ?꾪븳 ?ㅽ봽?쇱씤 설명?뚯뿉 珥덈??쒕┰?덈떎.' } },
          { type: 'paragraph', data: { text: '?꾨옒 踰꾪듉?쇰줈 李몄꽍 ?щ?瑜??뚮젮二쇱꽭??' } }
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
    name: '?볤? ?듬? 알림',
    summary: '??게시글?????볤????щ━硫?즉시 ?몄떆?⑸땲??',
    subject: '???볤????꾩갑?덉뒿?덈떎.',
    targetGroupIds: ['GRP-001'],
    status: '활성',
    triggerLabel: '???볤? ?깅줉 吏곹썑',
    bodyHtml: '<p>???볤????꾩갑?덉뒿?덈떎. 운영 ?붾㈃?먯꽌 諛붾줈 ?뺤씤?대낫?몄슂.</p>',
    bodyJson: JSON.stringify(
      {
        blocks: [{ type: 'paragraph', data: { text: '???볤????꾩갑?덉뒿?덈떎. 운영 ?붾㈃?먯꽌 諛붾줈 ?뺤씤?대낫?몄슂.' } }]
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
    name: '?뺢린 결제 ?덉젙 알림',
    summary: '결제 ?덉젙 ?섎（ ?꾩뿉 ?몄떆瑜?蹂대깄?덈떎.',
    subject: '?뺢린 결제 ?덉젙 ?덈궡',
    targetGroupIds: ['GRP-001'],
    status: '활성',
    triggerLabel: '결제 ?덉젙 ?섎（ ??,
    bodyHtml: '<p>?댁씪 ?뺢린 결제媛 ?덉젙?섏뼱 ?덉뒿?덈떎.</p>',
    bodyJson: JSON.stringify(
      {
        blocks: [{ type: 'paragraph', data: { text: '?댁씪 ?뺢린 결제媛 ?덉젙?섏뼱 ?덉뒿?덈떎.' } }]
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
    name: '?먭? 공지 ?몄떆',
    summary: '湲닿툒 ?먭? 공지瑜??몄떆濡??꾨떖?⑸땲??',
    subject: '?쒕퉬???먭? ?덈궡',
    targetGroupIds: ['GRP-004'],
    status: '활성',
    bodyHtml: '<p>?ㅻ뒛 23:00遺??23:30源뚯? 湲닿툒 ?먭???吏꾪뻾?⑸땲??</p>',
    bodyJson: JSON.stringify(
      {
        blocks: [{ type: 'paragraph', data: { text: '?ㅻ뒛 23:00遺??23:30源뚯? 湲닿툒 ?먭???吏꾪뻾?⑸땲??' } }]
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
    category: '留덉???,
    name: '二쇰쭚 罹좏럹???덈궡',
    summary: '二쇰쭚 ?쒖젙 ?꾨줈紐⑥뀡 ?덈궡 ?섎룞 ?몄떆?낅땲??',
    subject: '?대쾲 二쇰쭚 ?쒖젙 ?쒗깮',
    targetGroupIds: ['GRP-001', 'GRP-003'],
    status: '珥덉븞',
    bodyHtml: '<p>二쇰쭚 ?쒖젙 ?꾨줈紐⑥뀡???쒖옉?섏뿀?듬땲?? ?깆뿉??諛붾줈 ?뺤씤?대낫?몄슂.</p>',
    bodyJson: JSON.stringify(
      {
        blocks: [
          { type: 'paragraph', data: { text: '二쇰쭚 ?쒖젙 ?꾨줈紐⑥뀡???쒖옉?섏뿀?듬땲?? ?깆뿉??諛붾줈 ?뺤씤?대낫?몄슂.' } }
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
    templateName: '?붽컙 ?댁뒪?덊꽣',
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
    templateName: '媛???섏쁺 硫붿씪',
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
    templateName: '?먭? 공지 ?몄떆',
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
    templateName: '?뺢린 결제 ?덉젙 알림',
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
    templateName: 'VIP ?됱궗 珥덈? 硫붿씪',
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
              status: item.status === '珥덉븞' ? '활성' : item.status
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
      actionType: '?ъ떆??
    });
  }
}));


