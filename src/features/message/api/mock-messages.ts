import { createDefaultMessageGroupFilters } from '../model/message-group-segment-schema';
import type {
  MessageChannel,
  MessageGroup,
  MessageGroupFilters,
  MessageHistory,
  MessageHistoryRecipient,
  MessageHistoryStatus,
  MessageTemplate,
  MessageTemplateMode
} from '../model/types';

const DEFAULT_FILTERS: MessageGroupFilters = createDefaultMessageGroupFilters('2026-03-10');

type SampleRecipient = {
  userId: string;
  userName: string;
};

const SAMPLE_RECIPIENTS: SampleRecipient[] = [
  { userId: 'U00021', userName: '김서윤' },
  { userId: 'U00032', userName: '이도윤' },
  { userId: 'U00047', userName: '박하준' },
  { userId: 'U00058', userName: '최서연' },
  { userId: 'U00063', userName: '정유진' },
  { userId: 'U00071', userName: '신현우' }
];

function createBodyJson(text: string): string {
  return JSON.stringify(
    {
      blocks: [{ type: 'paragraph', data: { text } }]
    },
    null,
    2
  );
}

function cloneGroup(group: MessageGroup): MessageGroup {
  return {
    ...group,
    channels: [...group.channels],
    staticMembers: [...group.staticMembers],
    filters: {
      ...group.filters,
      memberTypes: [...group.filters.memberTypes],
      genders: [...group.filters.genders],
      ageRange: [...group.filters.ageRange],
      signupMethods: [...group.filters.signupMethods],
      signupDateRange: { ...group.filters.signupDateRange },
      subscriptionStates: [...group.filters.subscriptionStates],
      activityStates: [...group.filters.activityStates]
    },
    queryBuilderConfig: group.queryBuilderConfig
      ? JSON.parse(JSON.stringify(group.queryBuilderConfig))
      : undefined
  };
}

function cloneTemplate(template: MessageTemplate): MessageTemplate {
  return {
    ...template,
    targetGroupIds: [...template.targetGroupIds]
  };
}

function cloneHistory(history: MessageHistory): MessageHistory {
  return {
    ...history,
    groupIds: [...history.groupIds],
    recipients: history.recipients.map((recipient) => ({ ...recipient }))
  };
}

const initialGroups: MessageGroup[] = [
  {
    id: 'GRP-001',
    name: '활성 학습자',
    description: '최근 90일 내 학습 활동이 있는 학생 중심 그룹',
    definitionType: '조건 기반 그룹',
    builderMode: 'simple',
    channels: ['mail', 'push'],
    memberCount: 5172,
    ruleSummary: '한국 (KR) · 학생 · 18-30세 · 이메일, 구글 · 활동',
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
    lastCalculatedAt: '2026-03-10 09:08',
    updatedAt: '2026-03-10 09:10',
    updatedBy: 'admin_park'
  },
  {
    id: 'GRP-002',
    name: '이탈 예정 강사',
    description: '결제 상태는 정상이나 최근 접속이 없는 강사 그룹',
    definitionType: '조건 기반 그룹',
    builderMode: 'query-builder',
    channels: ['mail', 'push'],
    memberCount: 842,
    ruleSummary:
      "country = '미국 (US)' AND member_type = '강사' AND activity_state = '비활동' AND subscription_state = '구독'",
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
      "country = '미국 (US)' AND member_type = '강사' AND activity_state = '비활동' AND subscription_state = '구독'",
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
          value: '미국 (US)'
        },
        {
          type: 'rule',
          id: 'rule-seed-002-member-type',
          field: 'memberType',
          operator: 'equals',
          value: '강사'
        },
        {
          type: 'rule',
          id: 'rule-seed-002-activity',
          field: 'activityState',
          operator: 'equals',
          value: '비활동'
        }
      ]
    },
    lastCalculatedAt: '2026-03-09 15:32',
    updatedAt: '2026-03-09 15:40',
    updatedBy: 'admin_kim'
  },
  {
    id: 'GRP-003',
    name: 'VIP 고객',
    description: '운영팀이 직접 관리하는 정적 VIP 대상 그룹',
    definitionType: '정적 그룹',
    builderMode: 'simple',
    channels: ['mail', 'push'],
    memberCount: 5,
    ruleSummary: '정적 대상 5명',
    status: '사용중',
    staticMembers: [
      'vip-01@example.com',
      'vip-02@example.com',
      'vip-03@example.com',
      'vip-04@example.com',
      'vip-05@example.com'
    ],
    filters: DEFAULT_FILTERS,
    lastCalculatedAt: '2026-03-08 14:15',
    updatedAt: '2026-03-08 14:15',
    updatedBy: 'admin_lee'
  },
  {
    id: 'GRP-004',
    name: '운영 공지 구독자',
    description: '운영 공지 수신 동의와 최근 활동 이력이 있는 전체 그룹',
    definitionType: '조건 기반 그룹',
    builderMode: 'simple',
    channels: ['mail', 'push'],
    memberCount: 11620,
    ruleSummary: '한국 (KR) · 학생, 강사, 파트너 · 18-45세 · 이메일, 구글, 카카오 · 활동, 비활동',
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
    lastCalculatedAt: '2026-03-07 10:02',
    updatedAt: '2026-03-07 10:05',
    updatedBy: 'admin_park'
  }
];

const initialTemplates: MessageTemplate[] = [
  {
    id: 'MAIL-AUTO-001',
    channel: 'mail',
    mode: 'auto',
    category: '온보딩',
    name: '가입 환영 메일',
    summary: '회원 가입 직후 발송하는 기본 환영 메일입니다.',
    subject: '[TOPIK AI] 가입을 환영합니다',
    targetGroupIds: ['GRP-001'],
    status: '활성',
    triggerLabel: '회원 가입 직후',
    bodyHtml: '<h2>TOPIK AI에 오신 것을 환영합니다</h2><p>가입 후 7일 동안 주요 기능 안내를 순차 발송합니다.</p>',
    bodyJson: createBodyJson('가입 후 7일 동안 주요 기능 안내를 순차 발송합니다.'),
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
    subject: '[TOPIK AI] 결제 정보를 다시 확인해 주세요',
    targetGroupIds: ['GRP-002'],
    status: '활성',
    triggerLabel: '결제 실패 후 1시간',
    bodyHtml: '<p>결제가 정상 처리되지 않았습니다. 카드 정보를 확인한 뒤 다시 시도해 주세요.</p>',
    bodyJson: createBodyJson('결제가 정상 처리되지 않았습니다. 카드 정보를 확인한 뒤 다시 시도해 주세요.'),
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
    bodyHtml: '<h3>3월 주요 업데이트</h3><ul><li>메시지 센터 개편</li><li>학습 대시보드 개선</li></ul>',
    bodyJson: createBodyJson('3월 주요 업데이트: 메시지 센터 개편, 학습 대시보드 개선'),
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
    summary: 'VIP 고객 대상 오프라인 설명회 초대 메일을 보냅니다.',
    subject: '[TOPIK AI] VIP 행사 초대',
    targetGroupIds: ['GRP-003'],
    status: '활성',
    bodyHtml: '<p>VIP 고객님을 위한 오프라인 설명회에 초대합니다.</p>',
    bodyJson: createBodyJson('VIP 고객님을 위한 오프라인 설명회에 초대합니다.'),
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
    summary: '내 게시글에 댓글이 달리면 즉시 푸시합니다.',
    subject: '새 댓글이 도착했습니다',
    targetGroupIds: ['GRP-001'],
    status: '활성',
    triggerLabel: '새 댓글 등록 직후',
    bodyHtml: '<p>새 댓글이 도착했습니다. 운영 화면에서 바로 확인해 보세요.</p>',
    bodyJson: createBodyJson('새 댓글이 도착했습니다. 운영 화면에서 바로 확인해 보세요.'),
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
    bodyJson: createBodyJson('내일 정기 결제가 예정되어 있습니다.'),
    lastSentAt: '2026-03-09 19:00',
    updatedAt: '2026-03-08 10:25',
    updatedBy: 'admin_park'
  },
  {
    id: 'PUSH-MAN-001',
    channel: 'push',
    mode: 'manual',
    category: '운영',
    name: '장애 공지 푸시',
    summary: '긴급 장애 공지를 푸시로 전달합니다.',
    subject: '서비스 장애 안내',
    targetGroupIds: ['GRP-004'],
    status: '활성',
    bodyHtml: '<p>오늘 23:00부터 23:30까지 긴급 점검을 진행합니다.</p>',
    bodyJson: createBodyJson('오늘 23:00부터 23:30까지 긴급 점검을 진행합니다.'),
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
    summary: '주말 한정 프로모션 안내용 수동 푸시입니다.',
    subject: '이번 주말 한정 혜택',
    targetGroupIds: ['GRP-001', 'GRP-003'],
    status: '초안',
    bodyHtml: '<p>주말 한정 프로모션이 시작되었습니다. 앱에서 바로 확인해 보세요.</p>',
    bodyJson: createBodyJson('주말 한정 프로모션이 시작되었습니다. 앱에서 바로 확인해 보세요.'),
    lastSentAt: '2026-03-01 09:40',
    updatedAt: '2026-03-10 09:00',
    updatedBy: 'admin_lee'
  }
];

function buildGroupName(groupIds: string[]): string {
  return initialGroups
    .filter((group) => groupIds.includes(group.id))
    .map((group) => group.name)
    .join(', ');
}

function buildTargetCount(groupIds: string[]): number {
  return initialGroups
    .filter((group) => groupIds.includes(group.id))
    .reduce((total, group) => total + group.memberCount, 0);
}

function createRecipients(options: {
  historyId: string;
  channel: MessageChannel;
  mode: MessageTemplateMode;
  templateName: string;
  targetCount: number;
  failureCount: number;
  status: MessageHistoryStatus;
  sentAt: string;
  scheduledAt?: string;
}): MessageHistoryRecipient[] {
  const sampleSize = Math.min(SAMPLE_RECIPIENTS.length, Math.max(options.targetCount, 1));
  const failureSamples =
    options.status === '예약' ? 0 : Math.min(options.failureCount, Math.max(Math.round(sampleSize * 0.3), 1));

  return Array.from({ length: sampleSize }, (_, index) => {
    const recipient = SAMPLE_RECIPIENTS[index % SAMPLE_RECIPIENTS.length];
    const isFailure = index < failureSamples;
    const destinationId = `${options.historyId.replaceAll('-', '').toLowerCase()}-${String(index + 1).padStart(2, '0')}`;

    return {
      id: `${options.historyId}-REC-${String(index + 1).padStart(3, '0')}`,
      userId: recipient.userId,
      userName: recipient.userName,
      destination:
        options.channel === 'mail'
          ? `${destinationId}@example.com`
          : `device-${destinationId}`,
      mode: options.mode,
      templateName: options.templateName,
      status: options.status === '예약' ? '예약' : isFailure ? '실패' : '성공',
      sentAt: options.status === '예약' ? options.scheduledAt ?? options.sentAt : options.sentAt,
      failureReason: isFailure ? '수신 채널 응답 지연으로 재시도 필요' : undefined
    };
  });
}

function createHistory(seed: Omit<MessageHistory, 'recipients'>): MessageHistory {
  return {
    ...seed,
    recipients: createRecipients({
      historyId: seed.id,
      channel: seed.channel,
      mode: seed.mode,
      templateName: seed.templateName,
      targetCount: seed.targetCount,
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
    groupName: buildGroupName(['GRP-001', 'GRP-004']),
    targetCount: buildTargetCount(['GRP-001', 'GRP-004']),
    successCount: buildTargetCount(['GRP-001', 'GRP-004']) - 148,
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
    groupName: buildGroupName(['GRP-001']),
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
    templateName: '장애 공지 푸시',
    groupIds: ['GRP-004'],
    groupName: buildGroupName(['GRP-004']),
    targetCount: buildTargetCount(['GRP-004']),
    successCount: buildTargetCount(['GRP-004']),
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
    groupName: buildGroupName(['GRP-001']),
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
    groupName: buildGroupName(['GRP-003']),
    targetCount: buildTargetCount(['GRP-003']),
    successCount: 0,
    failureCount: 0,
    status: '예약',
    actionType: '예약 발송',
    scheduledAt: '2026-03-12 09:00',
    sentAt: '2026-03-10 08:50',
    actor: 'admin_lee'
  })
];

export function createInitialMessageGroups(): MessageGroup[] {
  return initialGroups.map(cloneGroup);
}

export function createInitialMessageTemplates(): MessageTemplate[] {
  return initialTemplates.map(cloneTemplate);
}

export function createInitialMessageHistories(): MessageHistory[] {
  return initialHistories.map(cloneHistory);
}
