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
    module: 'Dashboard',
    scopeDescription: '대시보드의 운영 요약 카드와 현황 지표를 조회합니다.',
    risk: 'low'
  },
  {
    key: 'users.read',
    name: '회원 조회',
    module: 'Users',
    scopeDescription: '회원 목록, 상세, 필터와 검색 결과를 조회합니다.',
    risk: 'low'
  },
  {
    key: 'users.suspend',
    name: '회원 상태 조치',
    module: 'Users',
    scopeDescription: '회원 상태를 정상, 정지로 변경하고 운영 사유를 남깁니다.',
    risk: 'high'
  },
  {
    key: 'users.memo.write',
    name: '관리자 메모 작성',
    module: 'Users',
    scopeDescription: '회원 상세의 관리자 메모를 작성하거나 수정합니다.',
    risk: 'medium'
  },
  {
    key: 'users.groups.manage',
    name: '강사 관리',
    module: 'Users',
    scopeDescription: '강사 목록, 소속 정보, 담당 과정과 운영 상태를 관리합니다.',
    risk: 'medium'
  },
  {
    key: 'users.referrals.manage',
    name: '추천인 관리',
    module: 'Users',
    scopeDescription: '추천인 관계와 추천 보상 정책을 조회하고 조정합니다.',
    risk: 'medium'
  },
  {
    key: 'community.posts.hide',
    name: '게시글 숨김',
    module: 'Community',
    scopeDescription: '커뮤니티 게시글을 숨김 처리하고 노출을 중단합니다.',
    risk: 'high'
  },
  {
    key: 'community.posts.delete',
    name: '게시글 삭제',
    module: 'Community',
    scopeDescription: '커뮤니티 게시글을 삭제합니다.',
    risk: 'high'
  },
  {
    key: 'community.reports.resolve',
    name: '신고 처리',
    module: 'Community',
    scopeDescription: '신고를 처리 완료로 변경하고 후속 조치를 남깁니다.',
    risk: 'medium'
  },
  {
    key: 'message.mail.manage',
    name: '메일 발송 관리',
    module: 'Message',
    scopeDescription: '메일 자동/수동 발송 템플릿을 관리하고 실제 발송을 실행합니다.',
    risk: 'high'
  },
  {
    key: 'message.push.manage',
    name: '푸시 발송 관리',
    module: 'Message',
    scopeDescription: '푸시 자동/수동 발송 템플릿을 관리하고 실제 발송을 실행합니다.',
    risk: 'high'
  },
  {
    key: 'message.groups.manage',
    name: '대상 그룹 관리',
    module: 'Message',
    scopeDescription: '메일/푸시 공용 대상 그룹을 생성, 수정, 삭제합니다.',
    risk: 'medium'
  },
  {
    key: 'message.history.read',
    name: '발송 이력 조회',
    module: 'Message',
    scopeDescription: '채널별 발송 이력을 조회하고 재시도를 수행합니다.',
    risk: 'medium'
  },
  {
    key: 'operation.notices.manage',
    name: '공지사항 관리',
    module: 'Operation',
    scopeDescription: '공지사항을 등록, 수정, 게시, 삭제합니다.',
    risk: 'medium'
  },
  {
    key: 'operation.faq.manage',
    name: 'FAQ 관리',
    module: 'Operation',
    scopeDescription: '자주 묻는 질문을 등록, 분류, 수정합니다.',
    risk: 'medium'
  },
  {
    key: 'operation.events.manage',
    name: '이벤트 관리',
    module: 'Operation',
    scopeDescription: '이벤트 페이지와 운영용 행사 콘텐츠를 관리합니다.',
    risk: 'medium'
  },
  {
    key: 'operation.policies.manage',
    name: '정책 관리',
    module: 'Operation',
    scopeDescription:
      '이용약관, 개인정보 처리방침, 결제ㆍ환불 정책 등 법적/운영 정책 문서를 관리합니다.',
    risk: 'high'
  },
  {
    key: 'operation.chatbot.manage',
    name: '챗봇 설정 관리',
    module: 'Operation',
    scopeDescription: '운영 챗봇 시나리오, 연결 규칙, 상태를 설정합니다.',
    risk: 'medium'
  },
  {
    key: 'commerce.payments.read',
    name: '결제 조회',
    module: 'Commerce',
    scopeDescription: '결제 내역과 결제 상태를 조회합니다.',
    risk: 'low'
  },
  {
    key: 'commerce.refunds.approve',
    name: '환불 처리',
    module: 'Commerce',
    scopeDescription: '환불 승인 또는 거절로 결제 상태를 변경합니다.',
    risk: 'high'
  },
  {
    key: 'commerce.coupons.manage',
    name: '쿠폰 관리',
    module: 'Commerce',
    scopeDescription: '쿠폰 정책, 발급 상태, 노출 범위를 관리합니다.',
    risk: 'medium'
  },
  {
    key: 'commerce.points.manage',
    name: '포인트 관리',
    module: 'Commerce',
    scopeDescription: '포인트 정책과 적립/차감 기준을 관리합니다.',
    risk: 'medium'
  },
  {
    key: 'commerce.store.manage',
    name: '이커머스 관리',
    module: 'Commerce',
    scopeDescription: '상품, 패키지, 판매 노출 상태를 관리합니다.',
    risk: 'medium'
  },
  {
    key: 'assessment.question-bank.manage',
    name: '문제은행 관리',
    module: 'Assessment',
    scopeDescription: '문항 풀, 카테고리, 출제 기준을 관리합니다.',
    risk: 'medium'
  },
  {
    key: 'assessment.eps-topik.manage',
    name: 'EPS TOPIK 관리',
    module: 'Assessment',
    scopeDescription: 'EPS TOPIK 전용 문제 세트와 운영 구성을 관리합니다.',
    risk: 'medium'
  },
  {
    key: 'assessment.level-tests.manage',
    name: '레벨 테스트 관리',
    module: 'Assessment',
    scopeDescription: '레벨 테스트 세트, 배점, 결과 노출 규칙을 관리합니다.',
    risk: 'medium'
  },
  {
    key: 'content.library.manage',
    name: '콘텐츠 관리',
    module: 'Content',
    scopeDescription: '콘텐츠 카탈로그와 운영 메타데이터를 관리합니다.',
    risk: 'medium'
  },
  {
    key: 'content.badges.manage',
    name: '배지 관리',
    module: 'Content',
    scopeDescription: '배지 정의, 노출 조건, 수여 규칙을 관리합니다.',
    risk: 'medium'
  },
  {
    key: 'content.vocabulary.manage',
    name: '단어장 관리',
    module: 'Content',
    scopeDescription: '단어장 카테고리와 학습 항목을 관리합니다.',
    risk: 'medium'
  },
  {
    key: 'content.vocabulary.sonagi.manage',
    name: '소나기 관리',
    module: 'Content',
    scopeDescription: '단어장 하위의 소나기 콘텐츠 세트를 관리합니다.',
    risk: 'medium'
  },
  {
    key: 'content.vocabulary.multiple-choice.manage',
    name: '객관식 선택 관리',
    module: 'Content',
    scopeDescription: '단어장 하위의 객관식 선택 콘텐츠를 관리합니다.',
    risk: 'medium'
  },
  {
    key: 'content.missions.manage',
    name: '학습 미션 관리',
    module: 'Content',
    scopeDescription: '학습 미션 정의와 보상 규칙을 관리합니다.',
    risk: 'medium'
  },
  {
    key: 'analytics.read',
    name: '분석 조회',
    module: 'Analytics',
    scopeDescription: '분석 개요와 리포트를 조회합니다.',
    risk: 'low'
  },
  {
    key: 'system.admins.manage',
    name: '관리자 계정 관리',
    module: 'System',
    scopeDescription: '관리자 계정을 생성, 비활성화, 수정합니다.',
    risk: 'high'
  },
  {
    key: 'system.permissions.manage',
    name: '권한 관리',
    module: 'System',
    scopeDescription: '역할과 세부 권한을 부여, 수정, 회수합니다.',
    risk: 'high'
  },
  {
    key: 'system.audit.read',
    name: '감사 로그 조회',
    module: 'System',
    scopeDescription: '관리자 조치 이력을 조회하고 추적합니다.',
    risk: 'medium'
  },
  {
    key: 'system.logs.read',
    name: '시스템 로그 조회',
    module: 'System',
    scopeDescription: '기술 로그와 배치 상태를 조회합니다.',
    risk: 'medium'
  }
];

const allPermissionKeys = permissionCatalog.map((permission) => permission.key);

export const roleCatalog: RoleDefinition[] = [
  {
    key: 'SUPER_ADMIN',
    name: '슈퍼 관리자',
    description: '모든 모듈과 고위험 액션을 포함한 전체 권한을 가집니다.',
    defaultPermissions: allPermissionKeys
  },
  {
    key: 'OPS_ADMIN',
    name: '운영 관리자',
    description:
      '회원, 커뮤니티, 메시지, 운영, 커머스 중심의 운영 액션을 수행하며 시스템 권한 변경은 제외됩니다.',
    defaultPermissions: [
      'dashboard.read',
      'users.read',
      'users.suspend',
      'users.memo.write',
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
      'system.audit.read',
      'system.logs.read'
    ]
  },
  {
    key: 'CONTENT_MANAGER',
    name: '콘텐츠 관리자',
    description:
      'Assessment와 Content 모듈을 중심으로 문제, 시험, 콘텐츠 운영을 담당합니다.',
    defaultPermissions: [
      'dashboard.read',
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
    description:
      '회원 조회/메모, 신고 처리, 발송 이력 확인을 담당하며 고위험 결제 액션은 제한됩니다.',
    defaultPermissions: [
      'dashboard.read',
      'users.read',
      'users.memo.write',
      'community.reports.resolve',
      'message.history.read',
      'commerce.payments.read',
      'system.audit.read'
    ]
  },
  {
    key: 'READ_ONLY',
    name: '조회 전용',
    description: '조회 권한만 가지며 데이터 변경 액션은 수행하지 않습니다.',
    defaultPermissions: [
      'dashboard.read',
      'users.read',
      'commerce.payments.read',
      'analytics.read',
      'message.history.read',
      'system.audit.read',
      'system.logs.read'
    ]
  }
];
