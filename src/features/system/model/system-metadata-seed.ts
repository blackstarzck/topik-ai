import type {
  SystemMetadataAuditEvent,
  SystemMetadataGroup
} from './system-metadata-types';
import {
  createAdminLocation,
  createHistoryEntry,
  createItem
} from './system-metadata-factories';

// 시스템 메타데이터 초기 시드 — Phase 4 분해로 store 에서 이동(내용 동일).
// store 는 이 시드를 초기 상태로만 사용하고 이후 메모리 상태를 변형한다.

export const initialGroups: SystemMetadataGroup[] = [
  {
    groupId: 'META-GRP-001',
    groupName: '회원 상태',
    description:
      'Users 회원 목록과 상세 탭에서 공통으로 쓰는 회원 상태 코드 테이블입니다.',
    managerType: 'codeTable',
    ownerModule: 'Users',
    ownerRole: 'OPS_ADMIN',
    status: 'active',
    syncStatus: 'live',
    exposureStatus: 'confirmed',
    linkedAdminPages: ['/users', '/users/:userId'],
    linkedAdminLocations: [
      createAdminLocation({
        locationId: 'META-GRP-001-LOC-01',
        route: '/users',
        path: ['회원', '회원 관리', '회원 목록', '상태 필터'],
        note: '목록 필터와 상태 배지가 기준값으로 공통 사용'
      }),
      createAdminLocation({
        locationId: 'META-GRP-001-LOC-02',
        route: '/users/:userId',
        path: ['회원', '회원 관리', '회원 상세', '프로필', '계정 상태'],
        note: '상세 Drawer의 계정 상태 표시'
      })
    ],
    linkedUserSurfaces: [
      '회원 가입 완료 화면',
      '마이페이지 계정 상태 배지'
    ],
    schemaCandidateNotes: [
      'user_status_codes',
      '회원 상태는 감사 로그와 검색 필터에 공통으로 연결되는 code table candidate'
    ],
    itemCodePrefix: 'USER_STATUS',
    items: [
      createItem({
        itemId: 'META-ITEM-001',
        code: 'ACTIVE',
        label: '정상',
        description: '정상 이용이 가능한 회원',
        status: 'active',
        sortOrder: 1,
        isDefault: true,
        exposureStatus: 'confirmed',
        updatedAt: '2026-03-14 09:20:00',
        updatedBy: 'admin_park'
      }),
      createItem({
        itemId: 'META-ITEM-002',
        code: 'SUSPENDED',
        label: '정지',
        description: '운영 조치로 서비스 이용이 제한된 회원',
        status: 'active',
        sortOrder: 2,
        isDefault: false,
        exposureStatus: 'confirmed',
        updatedAt: '2026-03-14 09:20:00',
        updatedBy: 'admin_park'
      }),
      createItem({
        itemId: 'META-ITEM-003',
        code: 'WITHDRAWN',
        label: '탈퇴',
        description: '탈퇴가 완료된 회원',
        status: 'active',
        sortOrder: 3,
        isDefault: false,
        exposureStatus: 'confirmed',
        updatedAt: '2026-03-14 09:20:00',
        updatedBy: 'admin_park'
      })
    ],
    history: [
      createHistoryEntry({
        historyId: 'META-HIS-001',
        action: 'group_created',
        reason: 'Users 상태 필터 기준 정리',
        changedBy: 'admin_park',
        createdAt: '2026-03-14 09:20:00'
      })
    ],
    updatedAt: '2026-03-14 09:20:00',
    updatedBy: 'admin_park',
    lastReviewedAt: '2026-03-18 11:10:00'
  },
  {
    groupId: 'META-GRP-002',
    groupName: '발송 세그먼트 필드',
    description:
      '대상 그룹과 자동 발송 룰에서 공통으로 사용하는 세그먼트 필드 메타데이터입니다.',
    managerType: 'segmentField',
    ownerModule: 'Message',
    ownerRole: 'OPS_ADMIN',
    status: 'active',
    syncStatus: 'review',
    exposureStatus: 'internalOnly',
    linkedAdminPages: ['/messages/groups', '/messages/mail', '/messages/push'],
    linkedAdminLocations: [
      createAdminLocation({
        locationId: 'META-GRP-002-LOC-01',
        route: '/messages/groups',
        path: ['메시지', '대상 그룹', '세그먼트 조건 빌더'],
        note: '대상 그룹 대상 조건 정의'
      }),
      createAdminLocation({
        locationId: 'META-GRP-002-LOC-02',
        route: '/messages/mail',
        path: ['메시지', '메일 발송', '자동 발송 등록', '대상 설정'],
        note: '자동 메일 발송 세그먼트 기준'
      }),
      createAdminLocation({
        locationId: 'META-GRP-002-LOC-03',
        route: '/messages/push',
        path: ['메시지', '푸시 발송', '자동 발송 등록', '대상 설정'],
        note: '자동 푸시 발송 세그먼트 기준'
      })
    ],
    linkedUserSurfaces: [],
    schemaCandidateNotes: [
      'message_group_segment_schema',
      '세그먼트 속성과 1:1 매핑 검증 필요'
    ],
    itemCodePrefix: 'SEGMENT_FIELD',
    items: [
      createItem({
        itemId: 'META-ITEM-004',
        code: 'SHOPPING_GRADE',
        label: '쇼핑 등급',
        description:
          '정기 쿠폰과 메시지 세그먼트가 공통 참조하는 등급 필드',
        status: 'active',
        sortOrder: 1,
        isDefault: false,
        exposureStatus: 'internalOnly',
        updatedAt: '2026-03-19 13:05:00',
        updatedBy: 'admin_kim'
      }),
      createItem({
        itemId: 'META-ITEM-005',
        code: 'INACTIVE_DAYS',
        label: '휴면 일수',
        description: '최근 활동일 기준 휴면 세그먼트 추출값',
        status: 'active',
        sortOrder: 2,
        isDefault: false,
        exposureStatus: 'internalOnly',
        updatedAt: '2026-03-19 13:05:00',
        updatedBy: 'admin_kim'
      })
    ],
    history: [
      createHistoryEntry({
        historyId: 'META-HIS-002',
        action: 'group_created',
        reason: '메시지 대상 그룹 쿼리 빌더 정리',
        changedBy: 'admin_kim',
        createdAt: '2026-03-19 13:05:00'
      })
    ],
    updatedAt: '2026-03-19 13:05:00',
    updatedBy: 'admin_kim',
    lastReviewedAt: '2026-03-22 16:30:00'
  },
  {
    groupId: 'META-GRP-003',
    groupName: 'FAQ 노출 위치',
    description: 'FAQ 큐레이션과 사용자 노출 surface를 묶는 선택 옵션입니다.',
    managerType: 'exposureRule',
    ownerModule: 'Operation',
    ownerRole: 'OPS_ADMIN',
    status: 'active',
    syncStatus: 'live',
    exposureStatus: 'confirmed',
    linkedAdminPages: ['/operation/faq'],
    linkedAdminLocations: [
      createAdminLocation({
        locationId: 'META-GRP-003-LOC-01',
        route: '/operation/faq',
        path: ['운영', 'FAQ', '노출 관리', '노출 위치 설정'],
        note: 'FAQ 큐레이션 노출 위치 선택'
      })
    ],
    linkedUserSurfaces: ['고객센터 홈', '주문 상세 FAQ 블록'],
    schemaCandidateNotes: [
      'operation_faq_curations',
      '노출 위치는 code table candidate'
    ],
    itemCodePrefix: 'FAQ_SURFACE',
    items: [
      createItem({
        itemId: 'META-ITEM-006',
        code: 'HELP_HOME',
        label: '고객센터 홈',
        description: '고객센터 첫 화면 상단 FAQ 큐레이션',
        status: 'active',
        sortOrder: 1,
        isDefault: true,
        exposureStatus: 'confirmed',
        updatedAt: '2026-03-12 08:40:00',
        updatedBy: 'admin_kim'
      }),
      createItem({
        itemId: 'META-ITEM-007',
        code: 'ORDER_DETAIL',
        label: '二쇰Ц 상세',
        description: '주문 상세 하단 FAQ 모듈',
        status: 'active',
        sortOrder: 2,
        isDefault: false,
        exposureStatus: 'inferred',
        updatedAt: '2026-03-12 08:40:00',
        updatedBy: 'admin_kim'
      })
    ],
    history: [
      createHistoryEntry({
        historyId: 'META-HIS-003',
        action: 'group_created',
        reason: 'FAQ 노출 위치 code table 후보 정리',
        changedBy: 'admin_kim',
        createdAt: '2026-03-12 08:40:00'
      })
    ],
    updatedAt: '2026-03-12 08:40:00',
    updatedBy: 'admin_kim',
    lastReviewedAt: '2026-03-20 10:15:00'
  },
  {
    groupId: 'META-GRP-004',
    groupName: '쿠폰 적용 범위',
    description:
      '쿠폰과 정기 쿠폰 템플릿이 공통으로 쓰는 적용 범위 옵션입니다.',
    managerType: 'selectOption',
    ownerModule: 'Commerce',
    ownerRole: 'OPS_ADMIN',
    status: 'active',
    syncStatus: 'live',
    exposureStatus: 'internalOnly',
    linkedAdminPages: ['/commerce/coupons'],
    linkedAdminLocations: [
      createAdminLocation({
        locationId: 'META-GRP-004-LOC-01',
        route: '/commerce/coupons',
        path: ['커머스', '쿠폰 관리', '고객 다운로드 쿠폰 등록', '혜택 설정'],
        note: '쿠폰 생성/수정 시 적용 범위 선택'
      }),
      createAdminLocation({
        locationId: 'META-GRP-004-LOC-02',
        route: '/commerce/coupons',
        path: ['커머스', '쿠폰 관리', '정기 쿠폰 템플릿 등록', '혜택 설정'],
        note: '정기 쿠폰 템플릿 공통 적용 범위'
      })
    ],
    linkedUserSurfaces: [],
    schemaCandidateNotes: [
      'coupon-form-schema.ts',
      '상품/카테고리 참조는 후속 API 연동 필요'
    ],
    itemCodePrefix: 'COUPON_SCOPE',
    items: [
      createItem({
        itemId: 'META-ITEM-008',
        code: 'ALL_PRODUCTS',
        label: '전체 상품',
        description: '모든 상품에 적용',
        status: 'active',
        sortOrder: 1,
        isDefault: true,
        exposureStatus: 'internalOnly',
        updatedAt: '2026-03-21 09:00:00',
        updatedBy: 'admin_han'
      }),
      createItem({
        itemId: 'META-ITEM-009',
        code: 'SPECIFIC_CATEGORY',
        label: '특정 카테고리',
        description: '선택한 카테고리에만 적용',
        status: 'active',
        sortOrder: 2,
        isDefault: false,
        exposureStatus: 'internalOnly',
        updatedAt: '2026-03-21 09:00:00',
        updatedBy: 'admin_han'
      })
    ],
    history: [
      createHistoryEntry({
        historyId: 'META-HIS-004',
        action: 'group_created',
        reason: '쿠폰 적용 범위 분류를 schema candidate에서 분리',
        changedBy: 'admin_han',
        createdAt: '2026-03-21 09:00:00'
      })
    ],
    updatedAt: '2026-03-21 09:00:00',
    updatedBy: 'admin_han',
    lastReviewedAt: '2026-03-21 09:00:00'
  },
  {
    groupId: 'META-GRP-005',
    groupName: '관리자 역할 템플릿',
    description:
      '관리자 권한 목록과 역할 설명에 연결되는 운영 메타데이터입니다.',
    managerType: 'codeTable',
    ownerModule: 'System',
    ownerRole: 'SUPER_ADMIN',
    status: 'active',
    syncStatus: 'review',
    exposureStatus: 'internalOnly',
    linkedAdminPages: ['/system/admins', '/system/permissions'],
    linkedAdminLocations: [
      createAdminLocation({
        locationId: 'META-GRP-005-LOC-01',
        route: '/system/admins',
        path: ['시스템', '관리자 계정', '관리자 등록/수정', '역할 템플릿'],
        note: '관리자 계정 생성 시 기본 역할 선택'
      }),
      createAdminLocation({
        locationId: 'META-GRP-005-LOC-02',
        route: '/system/permissions',
        path: ['시스템', '권한 관리', '권한 그룹 매핑'],
        note: '권한 그룹 설명과 역할 기준 참고'
      })
    ],
    linkedUserSurfaces: [],
    schemaCandidateNotes: [
      'role_catalog',
      '권한 확인 절차가 확정되기 전까지 메타 후보 유지'
    ],
    itemCodePrefix: 'ADMIN_ROLE',
    items: [
      createItem({
        itemId: 'META-ITEM-010',
        code: 'OPS_ADMIN',
        label: '운영 관리자',
        description:
          '운영, 커뮤니티, 메시지, 커머스 권한 묶음',
        status: 'active',
        sortOrder: 1,
        isDefault: false,
        exposureStatus: 'internalOnly',
        updatedAt: '2026-03-17 18:15:00',
        updatedBy: 'admin_park'
      }),
      createItem({
        itemId: 'META-ITEM-011',
        code: 'CONTENT_MANAGER',
        label: '콘텐츠 관리자',
        description: 'Assessment, Content 중심 운영 역할',
        status: 'active',
        sortOrder: 2,
        isDefault: false,
        exposureStatus: 'internalOnly',
        updatedAt: '2026-03-17 18:15:00',
        updatedBy: 'admin_park'
      })
    ],
    history: [
      createHistoryEntry({
        historyId: 'META-HIS-005',
        action: 'group_created',
        reason: '권한 관리 설명과 역할 템플릿 정리',
        changedBy: 'admin_park',
        createdAt: '2026-03-17 18:15:00'
      })
    ],
    updatedAt: '2026-03-17 18:15:00',
    updatedBy: 'admin_park',
    lastReviewedAt: '2026-03-24 09:05:00'
  },
  {
    groupId: 'META-GRP-006',
    groupName: '배지 등급',
    description:
      '콘텐츠 배지 등급과 색상 세트를 관리할 후보 메타 그룹입니다.',
    managerType: 'codeTable',
    ownerModule: 'Content',
    ownerRole: 'CONTENT_MANAGER',
    status: 'inactive',
    syncStatus: 'draft',
    exposureStatus: 'planned',
    linkedAdminPages: ['/content/badges'],
    linkedAdminLocations: [
      createAdminLocation({
        locationId: 'META-GRP-006-LOC-01',
        route: '/content/badges',
        path: ['콘텐츠', '배지 관리', '배지 등급 설정'],
        note: '배지 레벨/색상 세트 설계 초안'
      })
    ],
    linkedUserSurfaces: ['배지 획득 화면'],
    schemaCandidateNotes: [
      'badge_grade_codes',
      'Content 페이지 구현 전까지 초안 유지'
    ],
    itemCodePrefix: 'BADGE_GRADE',
    items: [
      createItem({
        itemId: 'META-ITEM-012',
        code: 'BRONZE',
        label: '브론즈',
        description: '?낅Ц 등급',
        status: 'inactive',
        sortOrder: 1,
        isDefault: true,
        exposureStatus: 'planned',
        updatedAt: '2026-03-10 15:35:00',
        updatedBy: 'admin_han'
      }),
      createItem({
        itemId: 'META-ITEM-013',
        code: 'SILVER',
        label: '실버',
        description: '以묎컙 등급',
        status: 'inactive',
        sortOrder: 2,
        isDefault: false,
        exposureStatus: 'planned',
        updatedAt: '2026-03-10 15:35:00',
        updatedBy: 'admin_han'
      })
    ],
    history: [
      createHistoryEntry({
        historyId: 'META-HIS-006',
        action: 'group_created',
        reason: '콘텐츠 배지 등급 설계 초안',
        changedBy: 'admin_han',
        createdAt: '2026-03-10 15:35:00'
      })
    ],
    updatedAt: '2026-03-10 15:35:00',
    updatedBy: 'admin_han',
    lastReviewedAt: '2026-03-10 15:35:00'
  }
];

export const initialAudits: SystemMetadataAuditEvent[] = initialGroups.flatMap((group, index) =>
  group.history.map((entry, historyIndex) => ({
    id: `AL-META-${String(index * 10 + historyIndex + 1).padStart(4, '0')}`,
    targetType: 'SystemMetadataGroup',
    targetId: group.groupId,
    action: entry.action,
    reason: entry.reason,
    changedBy: entry.changedBy,
    createdAt: entry.createdAt
  }))
);
