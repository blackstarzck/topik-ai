export type AdminStatus = '활성' | '비활성';

export type RoleKey =
  | 'SUPER_ADMIN'
  | 'OPS_ADMIN'
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
    scopeDescription: '대시보드 지표 카드와 운영 요약 정보를 조회할 수 있습니다.',
    risk: 'low'
  },
  {
    key: 'users.read',
    name: '사용자 조회',
    module: 'Users',
    scopeDescription: 'Users 목록/상세 조회, 검색, 필터 사용이 가능합니다.',
    risk: 'low'
  },
  {
    key: 'users.suspend',
    name: '사용자 정지/해제',
    module: 'Users',
    scopeDescription: '회원 상태를 정상/정지로 변경할 수 있습니다.',
    risk: 'high'
  },
  {
    key: 'users.memo.write',
    name: '관리자 메모 작성',
    module: 'Users',
    scopeDescription: '회원 상세의 Admin Memo 탭에서 운영 메모를 작성/수정할 수 있습니다.',
    risk: 'medium'
  },
  {
    key: 'community.posts.hide',
    name: '게시글 숨김',
    module: 'Community',
    scopeDescription: '커뮤니티 게시글을 숨김 처리하여 노출을 중단할 수 있습니다.',
    risk: 'high'
  },
  {
    key: 'community.posts.delete',
    name: '게시글 삭제',
    module: 'Community',
    scopeDescription: '커뮤니티 게시글을 삭제할 수 있습니다.',
    risk: 'high'
  },
  {
    key: 'community.reports.resolve',
    name: '신고 처리',
    module: 'Community',
    scopeDescription: '신고를 처리 완료로 변경하고 연계 조치를 수행할 수 있습니다.',
    risk: 'medium'
  },
  {
    key: 'notification.send',
    name: '알림 발송',
    module: 'Notification',
    scopeDescription: '즉시 발송/예약 발송을 실행할 수 있습니다.',
    risk: 'high'
  },
  {
    key: 'operation.notices.manage',
    name: '공지 관리',
    module: 'Operation',
    scopeDescription: '공지 등록/수정/숨김/삭제를 수행할 수 있습니다.',
    risk: 'medium'
  },
  {
    key: 'billing.payments.read',
    name: '결제 조회',
    module: 'Billing',
    scopeDescription: '결제 목록과 상태를 조회할 수 있습니다.',
    risk: 'low'
  },
  {
    key: 'billing.refunds.approve',
    name: '환불 처리',
    module: 'Billing',
    scopeDescription: '환불 승인/취소 등 결제 상태 변경을 수행할 수 있습니다.',
    risk: 'high'
  },
  {
    key: 'analytics.read',
    name: '분석 조회',
    module: 'Analytics',
    scopeDescription: '분석 대시보드의 통계 리포트를 조회할 수 있습니다.',
    risk: 'low'
  },
  {
    key: 'system.admins.manage',
    name: '관리자 계정 관리',
    module: 'System',
    scopeDescription: '관리자 계정 활성/비활성 및 계정 정보 변경을 수행할 수 있습니다.',
    risk: 'high'
  },
  {
    key: 'system.permissions.manage',
    name: '권한 관리',
    module: 'System',
    scopeDescription: '관리자 권한 부여/수정/회수 및 역할 변경을 수행할 수 있습니다.',
    risk: 'high'
  },
  {
    key: 'system.audit.read',
    name: '감사 로그 조회',
    module: 'System',
    scopeDescription: '감사 로그에서 조치 이력을 조회할 수 있습니다.',
    risk: 'medium'
  },
  {
    key: 'system.logs.read',
    name: '시스템 로그 조회',
    module: 'System',
    scopeDescription: '시스템 로그(기술 로그)를 조회할 수 있습니다.',
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
      '운영 액션(사용자/커뮤니티/공지/환불)을 수행하며 시스템 권한 변경은 제외됩니다.',
    defaultPermissions: [
      'dashboard.read',
      'users.read',
      'users.suspend',
      'users.memo.write',
      'community.posts.hide',
      'community.posts.delete',
      'community.reports.resolve',
      'notification.send',
      'operation.notices.manage',
      'billing.payments.read',
      'billing.refunds.approve',
      'analytics.read',
      'system.audit.read',
      'system.logs.read'
    ]
  },
  {
    key: 'CS_MANAGER',
    name: 'CS 담당자',
    description:
      '사용자 조회/메모와 신고 처리 권한을 가지며 고위험 결제 액션은 제한됩니다.',
    defaultPermissions: [
      'dashboard.read',
      'users.read',
      'users.memo.write',
      'community.reports.resolve',
      'notification.send',
      'billing.payments.read',
      'system.audit.read'
    ]
  },
  {
    key: 'READ_ONLY',
    name: '조회 전용',
    description: '조회 권한만 가지며 데이터 변경 액션은 수행할 수 없습니다.',
    defaultPermissions: [
      'dashboard.read',
      'users.read',
      'billing.payments.read',
      'analytics.read',
      'system.audit.read',
      'system.logs.read'
    ]
  }
];
