export type AdminStatus = '활성' | '비활성';

export type RoleKey =
  | 'SUPER_ADMIN'
  | 'OPS_ADMIN'
  | 'CONTENT_MANAGER'
  | 'CS_MANAGER'
  | 'READ_ONLY';

export type PermissionRisk = 'low' | 'medium' | 'high';

export type PermissionDefinition = {
  key: string;
  name: string;
  module: string;
  scopeDescription: string;
  risk: PermissionRisk;
};

export type RoleDefinition = {
  key: RoleKey;
  name: string;
  description: string;
  defaultPermissions: string[];
};

export type AdminPermissionAssignment = {
  adminId: string;
  name: string;
  status: AdminStatus;
  lastLoginAt: string;
  role: RoleKey;
  permissions: string[];
  updatedAt: string;
  updatedBy: string;
};

export type PermissionAuditEvent = {
  id: string;
  targetType: 'Admin';
  targetId: string;
  action: '권한 부여' | '권한 수정' | '권한 회수';
  reason: string;
  changedBy: string;
  beforeRole: RoleKey;
  afterRole: RoleKey;
  beforePermissions: string[];
  afterPermissions: string[];
  createdAt: string;
};

export const permissionCatalog: PermissionDefinition[] = [
  {
    key: 'dashboard.read',
    name: '대시보드 조회',
    module: '대시보드',
    scopeDescription: '대시보드 요약 위젯을 조회합니다.',
    risk: 'low'
  },
  {
    key: 'users.read',
    name: '회원 조회',
    module: '회원',
    scopeDescription: '회원 목록과 상세 탭을 조회합니다.',
    risk: 'low'
  },
  {
    key: 'users.groups.manage',
    name: '강사 관리',
    module: '회원',
    scopeDescription: '강사 관리 화면에서 할당/상태 조치를 수행합니다.',
    risk: 'medium'
  },
  {
    key: 'users.referrals.manage',
    name: '추천인 관리',
    module: '회원',
    scopeDescription: '추천인 정보와 보상 관련 조치를 수행합니다.',
    risk: 'medium'
  },
  {
    key: 'community.posts.hide',
    name: '게시글 숨김',
    module: '커뮤니티',
    scopeDescription: '신고 또는 정책 사유로 게시글을 숨김 처리합니다.',
    risk: 'high'
  },
  {
    key: 'community.posts.delete',
    name: '게시글 삭제',
    module: '커뮤니티',
    scopeDescription: '커뮤니티 게시글을 영구 삭제합니다.',
    risk: 'high'
  },
  {
    key: 'community.reports.resolve',
    name: '신고 처리',
    module: '커뮤니티',
    scopeDescription: '신고 건을 확인하고 처리 결과를 기록합니다.',
    risk: 'medium'
  },
  {
    key: 'message.mail.manage',
    name: '메일 발송 관리',
    module: '메시지',
    scopeDescription: '메일 템플릿이나 자동 발송을 관리합니다.',
    risk: 'medium'
  },
  {
    key: 'message.push.manage',
    name: '푸시 발송 관리',
    module: '메시지',
    scopeDescription: '푸시 템플릿이나 자동 발송을 관리합니다.',
    risk: 'medium'
  },
  {
    key: 'message.groups.manage',
    name: '대상 그룹 관리',
    module: '메시지',
    scopeDescription: '대상 그룹 세그먼트와 발송 조건을 관리합니다.',
    risk: 'medium'
  },
  {
    key: 'message.history.read',
    name: '발송 이력 조회',
    module: '메시지',
    scopeDescription: '메일/푸시/그룹 발송 이력을 조회합니다.',
    risk: 'low'
  },
  {
    key: 'operation.notices.manage',
    name: '공지사항 관리',
    module: '운영',
    scopeDescription: '공지사항 등록/수정/게시 상태를 관리합니다.',
    risk: 'medium'
  },
  {
    key: 'operation.faq.manage',
    name: 'FAQ 관리',
    module: '운영',
    scopeDescription: 'FAQ 콘텐츠와 노출 큐레이션을 관리합니다.',
    risk: 'medium'
  },
  {
    key: 'operation.events.manage',
    name: '이벤트 관리',
    module: '운영',
    scopeDescription: '이벤트 정책 및 노출 일정을 관리합니다.',
    risk: 'medium'
  },
  {
    key: 'operation.policies.manage',
    name: '정책 관리',
    module: '운영',
    scopeDescription: '약관/정책 문서의 버전과 게시 상태를 관리합니다.',
    risk: 'high'
  },
  {
    key: 'operation.chatbot.manage',
    name: '챗봇 설정',
    module: '운영',
    scopeDescription: '운영 챗봇 시나리오와 전환 조건을 관리합니다.',
    risk: 'medium'
  },
  {
    key: 'commerce.payments.read',
    name: '결제 내역 조회',
    module: '커머스',
    scopeDescription: '결제 내역과 상세 결제 정보를 조회합니다.',
    risk: 'low'
  },
  {
    key: 'commerce.refunds.approve',
    name: '환불 승인',
    module: '커머스',
    scopeDescription: '환불 요청을 승인/반려합니다.',
    risk: 'high'
  },
  {
    key: 'commerce.coupons.manage',
    name: '쿠폰 관리',
    module: '커머스',
    scopeDescription: '쿠폰과 정기 쿠폰 템플릿을 관리합니다.',
    risk: 'medium'
  },
  {
    key: 'commerce.points.manage',
    name: '포인트 관리',
    module: '커머스',
    scopeDescription: '포인트 정책과 조정 권한을 관리합니다.',
    risk: 'high'
  },
  {
    key: 'commerce.store.manage',
    name: '이커머스 관리',
    module: '커머스',
    scopeDescription: '상품/패키지 판매 구성을 관리합니다.',
    risk: 'medium'
  },
  {
    key: 'assessment.question-bank.manage',
    name: '문제은행 관리',
    module: '평가',
    scopeDescription: '문항 풀과 출제 기준을 관리합니다.',
    risk: 'medium'
  },
  {
    key: 'assessment.eps-topik.manage',
    name: 'EPS TOPIK 관리',
    module: '평가',
    scopeDescription: 'EPS TOPIK 전용 시험 구성을 관리합니다.',
    risk: 'medium'
  },
  {
    key: 'assessment.level-tests.manage',
    name: '레벨 테스트 관리',
    module: '평가',
    scopeDescription: '레벨 테스트 세트과 결과 기준을 관리합니다.',
    risk: 'medium'
  },
  {
    key: 'content.library.manage',
    name: '콘텐츠 관리',
    module: '콘텐츠',
    scopeDescription: '콘텐츠 카탈로그와 노출 상태를 관리합니다.',
    risk: 'medium'
  },
  {
    key: 'content.badges.manage',
    name: '배지 관리',
    module: '콘텐츠',
    scopeDescription: '배지 정의와 획득 조건을 관리합니다.',
    risk: 'medium'
  },
  {
    key: 'content.vocabulary.manage',
    name: '단어장 관리',
    module: '콘텐츠',
    scopeDescription: '단어장 상위 카테고리와 운영 메타를 관리합니다.',
    risk: 'medium'
  },
  {
    key: 'content.vocabulary.sonagi.manage',
    name: '소나기 관리',
    module: '콘텐츠',
    scopeDescription: '소나기 유형 콘텐츠와 출제 규칙을 관리합니다.',
    risk: 'medium'
  },
  {
    key: 'content.vocabulary.multiple-choice.manage',
    name: '객관식 선택 관리',
    module: '콘텐츠',
    scopeDescription: '객관식 선택 유형 콘텐츠와 보기 정책을 관리합니다.',
    risk: 'medium'
  },
  {
    key: 'content.missions.manage',
    name: '학습 미션 관리',
    module: '콘텐츠',
    scopeDescription: '미션 구성과 보상 구성을 관리합니다.',
    risk: 'medium'
  },
  {
    key: 'analytics.read',
    name: '통계 조회',
    module: '통계',
    scopeDescription: '주요 지표와 보드 지표를 조회합니다.',
    risk: 'low'
  },
  {
    key: 'system.admins.manage',
    name: '관리자 계정 관리',
    module: '시스템',
    scopeDescription: '관리자 계정 역할과 상태를 관리합니다.',
    risk: 'high'
  },
  {
    key: 'system.permissions.manage',
    name: '권한 관리',
    module: '시스템',
    scopeDescription: '관리자 권한 부여/수정/회수 조치를 수행합니다.',
    risk: 'high'
  },
  {
    key: 'system.metadata.manage',
    name: '메타데이터 관리',
    module: '시스템',
    scopeDescription: '운영 코드 테이블, 노출 규칙, 세그먼트 필드 메타데이터를 관리합니다.',
    risk: 'high'
  },
  {
    key: 'system.audit.read',
    name: '감사 로그 조회',
    module: '시스템',
    scopeDescription: '관리자 조치 이력을 감사 로그에서 조회합니다.',
    risk: 'medium'
  },
  {
    key: 'system.logs.read',
    name: '시스템 로그 조회',
    module: '시스템',
    scopeDescription: '기술 로그 및 장애 탐지 정보를 조회합니다.',
    risk: 'medium'
  }
];

const allPermissionKeys = permissionCatalog.map((permission) => permission.key);

export const roleCatalog: RoleDefinition[] = [
  {
    key: 'SUPER_ADMIN',
    name: '슈퍼 관리자',
    description: '시스템 전체 권한과 배포/조치 추적 책임을 가집니다.',
    defaultPermissions: allPermissionKeys
  },
  {
    key: 'OPS_ADMIN',
    name: '운영 관리자',
    description: '회원, 메시지, 운영, 커머스 운영을 담당합니다.',
    defaultPermissions: [
      'dashboard.read',
      'users.read',
      'users.groups.manage',
      'users.referrals.manage',
      'community.posts.hide',
      'community.posts.delete',
      'community.reports.resolve',
      'message.mail.manage',
      'message.push.manage',
      'message.groups.manage',
      'message.history.read',
      'operation.notices.manage',
      'operation.faq.manage',
      'operation.events.manage',
      'operation.policies.manage',
      'operation.chatbot.manage',
      'commerce.payments.read',
      'commerce.refunds.approve',
      'commerce.coupons.manage',
      'commerce.points.manage',
      'commerce.store.manage',
      'analytics.read',
      'system.metadata.manage',
      'system.audit.read'
    ]
  },
  {
    key: 'CONTENT_MANAGER',
    name: '콘텐츠 관리자',
    description: '평가/콘텐츠 도메인의 운영 구성을 담당합니다.',
    defaultPermissions: [
      'dashboard.read',
      'operation.faq.manage',
      'assessment.question-bank.manage',
      'assessment.eps-topik.manage',
      'assessment.level-tests.manage',
      'content.library.manage',
      'content.badges.manage',
      'content.vocabulary.manage',
      'content.vocabulary.sonagi.manage',
      'content.vocabulary.multiple-choice.manage',
      'content.missions.manage',
      'analytics.read',
      'system.audit.read'
    ]
  },
  {
    key: 'CS_MANAGER',
    name: 'CS 담당자',
    description: '회원 문의, 신고, FAQ 운영을 담당합니다.',
    defaultPermissions: [
      'dashboard.read',
      'users.read',
      'community.reports.resolve',
      'message.history.read',
      'operation.notices.manage',
      'operation.faq.manage',
      'analytics.read',
      'system.audit.read'
    ]
  },
  {
    key: 'READ_ONLY',
    name: '조회 전용',
    description: '조회 전용으로 관리 화면을 확인합니다.',
    defaultPermissions: [
      'dashboard.read',
      'users.read',
      'message.history.read',
      'commerce.payments.read',
      'analytics.read',
      'system.audit.read',
      'system.logs.read'
    ]
  }
];
