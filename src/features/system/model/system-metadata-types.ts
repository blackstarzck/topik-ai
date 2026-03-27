export type MetadataModule =
  | 'Users'
  | 'Message'
  | 'Operation'
  | 'Commerce'
  | 'Content'
  | 'System';

export type MetadataManagerType =
  | '코드 테이블'
  | '선택 옵션'
  | '노출 규칙'
  | '세그먼트 필드';

export type MetadataExposureStatus =
  | '확인됨'
  | '운영상 추정'
  | '내부 전용'
  | '노출 예정';

export type MetadataSyncStatus = '운영 중' | '검토 필요' | '초안';
export type MetadataStatus = '활성' | '비활성';

export type SystemMetadataItem = {
  itemId: string;
  code: string;
  label: string;
  description: string;
  status: MetadataStatus;
  sortOrder: number;
  isDefault: boolean;
  exposureStatus: MetadataExposureStatus;
  updatedAt: string;
  updatedBy: string;
};

export type SystemMetadataHistoryEntry = {
  historyId: string;
  action:
    | '그룹 생성'
    | '그룹 수정'
    | '그룹 활성화'
    | '그룹 비활성화'
    | '항목 추가'
    | '항목 수정'
    | '항목 활성화'
    | '항목 비활성화';
  reason: string;
  changedBy: string;
  createdAt: string;
};

export type SystemMetadataGroup = {
  groupId: string;
  groupName: string;
  description: string;
  managerType: MetadataManagerType;
  ownerModule: MetadataModule;
  ownerRole: string;
  status: MetadataStatus;
  syncStatus: MetadataSyncStatus;
  exposureStatus: MetadataExposureStatus;
  linkedAdminPages: string[];
  linkedUserSurfaces: string[];
  schemaCandidateNotes: string[];
  itemCodePrefix: string;
  items: SystemMetadataItem[];
  history: SystemMetadataHistoryEntry[];
  updatedAt: string;
  updatedBy: string;
  lastReviewedAt: string;
};

export type SystemMetadataAuditEvent = {
  id: string;
  targetType: 'SystemMetadataGroup';
  targetId: string;
  action: SystemMetadataHistoryEntry['action'];
  reason: string;
  changedBy: string;
  createdAt: string;
};

export const metadataManagerTypeOptions: Array<{
  label: MetadataManagerType;
  value: MetadataManagerType;
}> = [
  { label: '코드 테이블', value: '코드 테이블' },
  { label: '선택 옵션', value: '선택 옵션' },
  { label: '노출 규칙', value: '노출 규칙' },
  { label: '세그먼트 필드', value: '세그먼트 필드' }
];

export const metadataOwnerModuleOptions: Array<{
  label: MetadataModule;
  value: MetadataModule;
}> = [
  { label: 'Users', value: 'Users' },
  { label: 'Message', value: 'Message' },
  { label: 'Operation', value: 'Operation' },
  { label: 'Commerce', value: 'Commerce' },
  { label: 'Content', value: 'Content' },
  { label: 'System', value: 'System' }
];

export const metadataExposureStatusOptions: Array<{
  label: MetadataExposureStatus;
  value: MetadataExposureStatus;
}> = [
  { label: '확인됨', value: '확인됨' },
  { label: '운영상 추정', value: '운영상 추정' },
  { label: '내부 전용', value: '내부 전용' },
  { label: '노출 예정', value: '노출 예정' }
];

export const metadataSyncStatusOptions: Array<{
  label: MetadataSyncStatus;
  value: MetadataSyncStatus;
}> = [
  { label: '운영 중', value: '운영 중' },
  { label: '검토 필요', value: '검토 필요' },
  { label: '초안', value: '초안' }
];

export const metadataStatusOptions: Array<{
  label: MetadataStatus;
  value: MetadataStatus;
}> = [
  { label: '활성', value: '활성' },
  { label: '비활성', value: '비활성' }
];
