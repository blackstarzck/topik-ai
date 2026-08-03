export type MessageTemplateChannel = 'mail' | 'push' | 'in_app';

export type AdminPlaceholderRouteContent = {
  title: string;
  summary: string;
  ownerRole: string;
  supportingRoles?: string[];
  capabilities?: string[];
  notes?: string[];
};

export type SimplePageRouteKey =
  | 'dashboard'
  | 'users'
  | 'user-detail'
  | 'instructor-management'
  | 'users-referrals'
  | 'institution-codes'
  | 'institution-code-create'
  | 'institution-code-detail'
  | 'community-posts'
  | 'community-reports'
  | 'message-mail'
  | 'message-push'
  | 'message-inapp'
  | 'message-groups'
  | 'message-history'
  | 'operation-notices'
  | 'operation-notice-create'
  | 'operation-faq'
  | 'operation-events'
  | 'operation-event-create'
  | 'operation-policies'
  | 'operation-policy-create'
  | 'operation-pdf-quota'
  | 'billing-payments'
  | 'billing-refunds'
  | 'commerce-coupons'
  | 'commerce-coupon-create'
  | 'commerce-coupon-template-create'
  | 'commerce-points'
  | 'assessment-question-bank'
  | 'assessment-question-detail'
  | 'assessment-imported-tasks'
  | 'analytics-overview'
  | 'analytics-learning'
  | 'system-admins'
  | 'system-permissions'
  | 'system-metadata'
  | 'system-backups'
  | 'system-audit-logs'
  | 'system-logs'
  | 'system-reports';

export type SimplePageRouteDefinition = {
  kind: 'page';
  path: string;
  page: SimplePageRouteKey;
};

export type MessageTemplatePageRouteDefinition = {
  kind: 'page';
  path: string;
  page: 'message-template-create';
  channel: MessageTemplateChannel;
};

export type PageRouteDefinition =
  | SimplePageRouteDefinition
  | MessageTemplatePageRouteDefinition;

export type PlaceholderRouteDefinition = {
  kind: 'placeholder';
  path: string;
  placeholder: AdminPlaceholderRouteContent;
};

export type RedirectRouteDefinition = {
  kind: 'redirect';
  path: string;
  to: string;
};

export type AdminRouteDefinition =
  | PageRouteDefinition
  | PlaceholderRouteDefinition
  | RedirectRouteDefinition;

export const adminRouteDefinitions = [
  { kind: 'page', path: '/dashboard', page: 'dashboard' },

  { kind: 'page', path: '/users', page: 'users' },
  { kind: 'page', path: '/users/:userId', page: 'user-detail' },
  { kind: 'page', path: '/users/groups', page: 'instructor-management' },
  { kind: 'page', path: '/users/referrals', page: 'users-referrals' },
  { kind: 'page', path: '/users/institution-codes', page: 'institution-codes' },
  // 정적 `create` 세그먼트가 동적 `:code` 보다 우선 매칭된다(React Router v6 랭킹).
  // 코드 정규식이 `create` 를 허용하므로 생성 폼에서 예약어로 거부한다.
  {
    kind: 'page',
    path: '/users/institution-codes/create',
    page: 'institution-code-create'
  },
  {
    kind: 'page',
    path: '/users/institution-codes/:code',
    page: 'institution-code-detail'
  },

  { kind: 'page', path: '/community/posts', page: 'community-posts' },
  { kind: 'page', path: '/community/reports', page: 'community-reports' },

  { kind: 'page', path: '/messages/mail', page: 'message-mail' },
  {
    kind: 'page',
    path: '/messages/mail/create',
    page: 'message-template-create',
    channel: 'mail'
  },
  {
    kind: 'page',
    path: '/messages/mail/create/:templateId',
    page: 'message-template-create',
    channel: 'mail'
  },
  { kind: 'page', path: '/messages/push', page: 'message-push' },
  {
    kind: 'page',
    path: '/messages/push/create',
    page: 'message-template-create',
    channel: 'push'
  },
  {
    kind: 'page',
    path: '/messages/push/create/:templateId',
    page: 'message-template-create',
    channel: 'push'
  },
  { kind: 'page', path: '/messages/in-app', page: 'message-inapp' },
  {
    kind: 'page',
    path: '/messages/in-app/create',
    page: 'message-template-create',
    channel: 'in_app'
  },
  {
    kind: 'page',
    path: '/messages/in-app/create/:templateId',
    page: 'message-template-create',
    channel: 'in_app'
  },
  { kind: 'page', path: '/messages/groups', page: 'message-groups' },
  { kind: 'page', path: '/messages/history', page: 'message-history' },

  { kind: 'page', path: '/operation/notices', page: 'operation-notices' },
  {
    kind: 'page',
    path: '/operation/notices/create',
    page: 'operation-notice-create'
  },
  {
    kind: 'page',
    path: '/operation/notices/create/:noticeId',
    page: 'operation-notice-create'
  },
  { kind: 'page', path: '/operation/faq', page: 'operation-faq' },
  { kind: 'page', path: '/operation/events', page: 'operation-events' },
  {
    kind: 'page',
    path: '/operation/events/create',
    page: 'operation-event-create'
  },
  {
    kind: 'page',
    path: '/operation/events/create/:eventId',
    page: 'operation-event-create'
  },
  { kind: 'page', path: '/operation/policies', page: 'operation-policies' },
  {
    kind: 'page',
    path: '/operation/policies/create',
    page: 'operation-policy-create'
  },
  {
    kind: 'page',
    path: '/operation/policies/create/:policyId',
    page: 'operation-policy-create'
  },
  { kind: 'page', path: '/operation/pdf-quota', page: 'operation-pdf-quota' },
  {
    kind: 'placeholder',
    path: '/operation/chatbot',
    placeholder: {
      title: '챗봇 설정',
      summary:
        '운영 챗봇의 시나리오와 연결 정책을 정의할 수 있도록 준비한 자리입니다.',
      ownerRole: 'OPS_ADMIN',
      supportingRoles: ['SUPER_ADMIN', 'CONTENT_MANAGER'],
      capabilities: [
        '시나리오 버전 관리',
        '유입 채널별 응답 정책',
        '상담 전환 조건과 로그 추적'
      ],
      notes: ['기능 정의가 아직 부족해 설정 중심 placeholder로 시작합니다.']
    }
  },

  { kind: 'page', path: '/commerce/payments', page: 'billing-payments' },
  { kind: 'page', path: '/commerce/refunds', page: 'billing-refunds' },
  { kind: 'page', path: '/commerce/coupons', page: 'commerce-coupons' },
  {
    kind: 'page',
    path: '/commerce/coupons/create',
    page: 'commerce-coupon-create'
  },
  {
    kind: 'page',
    path: '/commerce/coupons/create/:couponId',
    page: 'commerce-coupon-create'
  },
  {
    kind: 'page',
    path: '/commerce/coupons/template/create',
    page: 'commerce-coupon-template-create'
  },
  {
    kind: 'page',
    path: '/commerce/coupons/template/create/:templateId',
    page: 'commerce-coupon-template-create'
  },
  { kind: 'page', path: '/commerce/points', page: 'commerce-points' },
  {
    kind: 'placeholder',
    path: '/commerce/store',
    placeholder: {
      title: '이커머스 관리',
      summary: '상품과 패키지 판매 운영을 위한 화면 자리입니다.',
      ownerRole: 'OPS_ADMIN',
      supportingRoles: ['SUPER_ADMIN'],
      capabilities: [
        '상품/패키지 카탈로그 관리',
        '판매 상태 및 노출 제어',
        '쿠폰/포인트 정책과 연결'
      ]
    }
  },

  {
    kind: 'page',
    path: '/assessment/question-bank',
    page: 'assessment-question-bank'
  },
  {
    kind: 'page',
    path: '/assessment/question-bank/imported',
    page: 'assessment-imported-tasks'
  },
  {
    kind: 'page',
    path: '/assessment/question-bank/:questionId',
    page: 'assessment-question-detail'
  },
  {
    kind: 'placeholder',
    path: '/assessment/question-bank/eps-topik',
    placeholder: {
      title: 'EPS TOPIK',
      summary: 'EPS TOPIK 전용 문제 세트와 운영 구성을 관리하기 위한 하위 자리입니다.',
      ownerRole: 'CONTENT_MANAGER',
      supportingRoles: ['SUPER_ADMIN'],
      capabilities: [
        '시험 회차별 세트 관리',
        '문항 배정과 노출 설정',
        '시험 템플릿 운영 규칙 정의'
      ]
    }
  },
  {
    kind: 'placeholder',
    path: '/assessment/level-tests',
    placeholder: {
      title: '레벨 테스트',
      summary: '레벨 테스트 구성과 평가 기준을 관리하는 자리입니다.',
      ownerRole: 'CONTENT_MANAGER',
      supportingRoles: ['SUPER_ADMIN'],
      capabilities: [
        '레벨 테스트 세트 관리',
        '배점/결과 정책 설정',
        '콘텐츠 추천과의 연결'
      ]
    }
  },

  {
    kind: 'placeholder',
    path: '/content/library',
    placeholder: {
      title: '콘텐츠 관리',
      summary:
        '콘텐츠 카탈로그와 운영 메타데이터를 관리하기 위한 Content 모듈의 시작점입니다.',
      ownerRole: 'CONTENT_MANAGER',
      supportingRoles: ['SUPER_ADMIN'],
      capabilities: [
        '콘텐츠 상태/분류 관리',
        '운영 노출 메타데이터 편집',
        '하위 콘텐츠 도메인 진입 허브'
      ]
    }
  },
  {
    kind: 'placeholder',
    path: '/content/badges',
    placeholder: {
      title: '배지',
      summary: '배지 정의와 노출 규칙을 관리하기 위한 자리입니다.',
      ownerRole: 'CONTENT_MANAGER',
      supportingRoles: ['SUPER_ADMIN'],
      capabilities: ['배지 유형/등급 관리', '획득 조건 정의', '회원 노출 규칙과 연결']
    }
  },
  {
    kind: 'placeholder',
    path: '/content/vocabulary',
    placeholder: {
      title: '단어장',
      summary: '단어장 카테고리와 학습 항목을 관리하는 기본 자리입니다.',
      ownerRole: 'CONTENT_MANAGER',
      supportingRoles: ['SUPER_ADMIN'],
      capabilities: [
        '단어장 카테고리 관리',
        '학습 항목 메타데이터 편집',
        '하위 콘텐츠 타입 진입 허브'
      ]
    }
  },
  {
    kind: 'placeholder',
    path: '/content/vocabulary/sonagi',
    placeholder: {
      title: '소나기',
      summary: '단어장 하위의 소나기 콘텐츠 유형을 위한 자리입니다.',
      ownerRole: 'CONTENT_MANAGER',
      supportingRoles: ['SUPER_ADMIN'],
      capabilities: [
        '콘텐츠 템플릿 관리',
        '출제/노출 규칙 정의',
        '단어장 카테고리와 연동'
      ]
    }
  },
  {
    kind: 'placeholder',
    path: '/content/vocabulary/multiple-choice',
    placeholder: {
      title: '객관식 선택',
      summary: '단어장 하위의 객관식 선택 콘텐츠 유형을 위한 자리입니다.',
      ownerRole: 'CONTENT_MANAGER',
      supportingRoles: ['SUPER_ADMIN'],
      capabilities: [
        '보기 구성 관리',
        '정답 및 피드백 규칙 정의',
        '콘텐츠 검수 흐름 반영'
      ]
    }
  },
  {
    kind: 'placeholder',
    path: '/content/missions',
    placeholder: {
      title: '학습 미션',
      summary: '학습 미션과 보상 규칙을 관리하기 위한 자리입니다.',
      ownerRole: 'CONTENT_MANAGER',
      supportingRoles: ['SUPER_ADMIN'],
      capabilities: [
        '미션 정의와 활성화 상태 관리',
        '보상/배지 연결',
        '회원 도달률과 운영 메모 추적'
      ]
    }
  },

  { kind: 'page', path: '/analytics/overview', page: 'analytics-overview' },
  { kind: 'page', path: '/analytics/learning', page: 'analytics-learning' },

  { kind: 'page', path: '/system/admins', page: 'system-admins' },
  { kind: 'page', path: '/system/permissions', page: 'system-permissions' },
  { kind: 'page', path: '/system/metadata', page: 'system-metadata' },
  { kind: 'page', path: '/system/backups', page: 'system-backups' },
  { kind: 'page', path: '/system/audit-logs', page: 'system-audit-logs' },
  { kind: 'page', path: '/system/logs', page: 'system-logs' },
  { kind: 'page', path: '/system/reports', page: 'system-reports' },

  {
    kind: 'redirect',
    path: '/notification/send',
    to: '/messages/mail?tab=manual'
  },
  {
    kind: 'redirect',
    path: '/notification/history',
    to: '/messages/history?channel=mail'
  },
  {
    kind: 'redirect',
    path: '/billing/payments',
    to: '/commerce/payments'
  },
  { kind: 'redirect', path: '/billing/refunds', to: '/commerce/refunds' },
  { kind: 'redirect', path: '/commerce', to: '/commerce/payments' },
  {
    kind: 'redirect',
    path: '/assessment/question-bank/manage',
    to: '/assessment/question-bank'
  },
  {
    kind: 'redirect',
    path: '/assessment',
    to: '/assessment/question-bank'
  },
  { kind: 'redirect', path: '/content', to: '/content/library' }
] as const satisfies readonly AdminRouteDefinition[];
