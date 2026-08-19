import type {
  MetadataExposureStatus,
  MetadataHistoryAction,
  MetadataModule,
  MetadataManagerType,
  MetadataStatus,
  MetadataSyncStatus,
  SystemMetadataGroup,
  SystemMetadataItem
} from './system-metadata-types';
import {
  metadataExposureStatusOptions,
  metadataManagerTypeOptions,
  metadataOwnerModuleOptions,
  metadataStatusOptions,
  metadataSyncStatusOptions
} from './system-metadata-types';
import { DRAWER_TABLE_PAGINATION } from '@/shared/ui/table/drawer-table';

// 운영 설정 카탈로그 페이지 스키마 — Phase 4 분해로 페이지 모듈 상단에서 이동(동작 동일).
// 화면 카피·라벨/선택 옵션·요약 필터·에디터 상태 타입·폼 타입·순수 함수를 담는다.

export const TEXT = {
  pageTitle: '운영 설정 카탈로그',
  toolbarSummary: '총',
  createGroup: '설정 추가',
  editGroup: '설정 수정',
  createItem: '운영 값 추가',
  editItem: '운영 값 수정',
  drawerTitle: '운영 설정 상세',
  active: '활성',
  inactive: '비활성',
  confirmed: '확인됨',
  inferred: '운영상 추정',
  internalOnly: '내부 전용',
  planned: '노출 예정',
  live: '운영 중',
  review: '검토 필요',
  draft: '초안',
  reason: '사유/근거',
  none: '없음',
  defaultValue: '기본값'
} as const;

export const MODULE_LABELS: Record<MetadataModule, string> = {
  Users: '회원/권한',
  Message: '메시지 발송',
  Operation: '운영/노출',
  Commerce: '커머스/혜택',
  Content: '콘텐츠',
  System: '시스템'
};

export const MANAGER_TYPE_LABELS: Record<MetadataManagerType, string> = {
  codeTable: '코드 테이블',
  selectOption: '선택 옵션',
  exposureRule: '노출 규칙',
  segmentField: '세그먼트 필드'
};

export const EXPOSURE_LABELS: Record<MetadataExposureStatus, string> = {
  confirmed: TEXT.confirmed,
  inferred: TEXT.inferred,
  internalOnly: TEXT.internalOnly,
  planned: TEXT.planned
};

export const SYNC_LABELS: Record<MetadataSyncStatus, string> = {
  live: TEXT.live,
  review: TEXT.review,
  draft: TEXT.draft
};

export const STATUS_LABELS: Record<MetadataStatus, string> = {
  active: TEXT.active,
  inactive: TEXT.inactive
};

export const MANAGER_TYPE_SELECT_OPTIONS = metadataManagerTypeOptions.map((option) => ({
  value: option.value,
  label: MANAGER_TYPE_LABELS[option.value]
}));

export const OWNER_MODULE_SELECT_OPTIONS = metadataOwnerModuleOptions.map((option) => ({
  value: option.value,
  label: MODULE_LABELS[option.value]
}));

export const SYNC_STATUS_SELECT_OPTIONS = metadataSyncStatusOptions.map((option) => ({
  value: option.value,
  label: SYNC_LABELS[option.value]
}));

export const EXPOSURE_STATUS_SELECT_OPTIONS = metadataExposureStatusOptions.map((option) => ({
  value: option.value,
  label: EXPOSURE_LABELS[option.value]
}));

export const STATUS_SELECT_OPTIONS = metadataStatusOptions.map((option) => ({
  value: option.value,
  label: STATUS_LABELS[option.value]
}));

export const DEFAULT_VALUE_SELECT_OPTIONS = [
  { value: 'yes', label: TEXT.defaultValue },
  { value: 'no', label: '기본값 아님' }
] as const;

export const DRAWER_TABLE_PAGINATION_WITH_HIDE = {
  ...DRAWER_TABLE_PAGINATION,
  hideOnSinglePage: true
} as const;

export const HISTORY_ACTION_LABELS: Record<MetadataHistoryAction, string> = {
  group_created: '설정 생성',
  group_updated: '설정 수정',
  group_activated: '설정 활성화',
  group_deactivated: '설정 비활성화',
  item_created: '운영 값 추가',
  item_deleted: '운영 값 삭제',
  item_reordered: '운영 값 순서 변경',
  item_updated: '운영 값 수정',
  item_activated: '운영 값 활성화',
  item_deactivated: '운영 값 비활성화'
};

export type SummaryFilter =
  | 'memberSettings'
  | 'messageSettings'
  | 'operationExposure'
  | 'commerceBenefits'
  | '';

export const SUMMARY_FILTER_LABELS: Record<Exclude<SummaryFilter, ''>, string> = {
  memberSettings: '회원/권한',
  messageSettings: '메시지 발송',
  operationExposure: '운영/노출',
  commerceBenefits: '커머스/혜택'
};

export type GroupEditorState =
  | { mode: 'create' | 'edit'; group: SystemMetadataGroup | null }
  | null;

export type ItemEditorState =
  | { groupId: string; item: SystemMetadataItem | null }
  | null;

export type StatusActionState =
  | { target: 'group'; group: SystemMetadataGroup; nextStatus: MetadataStatus }
  | {
      target: 'item';
      group: SystemMetadataGroup;
      item: SystemMetadataItem;
      nextStatus: MetadataStatus;
    }
  | null;

export type DeleteActionState =
  | {
      group: SystemMetadataGroup;
      item: SystemMetadataItem;
    }
  | null;

export type GroupFormValues = {
  groupName: string;
  description: string;
  managerType: MetadataManagerType;
  ownerModule: SystemMetadataGroup['ownerModule'];
  ownerRole: string;
  syncStatus: MetadataSyncStatus;
  exposureStatus: MetadataExposureStatus;
  itemCodePrefix: string;
  linkedAdminPagesText: string;
  linkedUserSurfacesText: string;
  schemaCandidateNotesText: string;
};

export type ItemFormValues = {
  code: string;
  label: string;
  description: string;
  status: MetadataStatus;
  sortOrder: number;
  isDefault: 'yes' | 'no';
  exposureStatus: MetadataExposureStatus;
};

export function parseSummaryFilter(value: string | null): SummaryFilter {
  return value === 'memberSettings' ||
    value === 'messageSettings' ||
    value === 'operationExposure' ||
    value === 'commerceBenefits'
    ? value
    : '';
}

export function normalizeMultilineValue(value: string): string[] {
  return [...new Set(value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean))];
}

export function joinMultilineValue(values: string[]): string {
  return values.join('\n');
}

export function normalizeDuplicateValue(value: string): string {
  return value.trim().toLowerCase();
}

export function sortGroups(groups: SystemMetadataGroup[]): SystemMetadataGroup[] {
  return [...groups].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function moveArrayItem<T>(values: T[], fromIndex: number, toIndex: number): T[] {
  const nextValues = [...values];
  const [targetValue] = nextValues.splice(fromIndex, 1);
  nextValues.splice(toIndex, 0, targetValue);
  return nextValues;
}

export function getSettingCategory(group: SystemMetadataGroup): Exclude<SummaryFilter, ''> {
  if (group.ownerModule === 'Users' || group.ownerModule === 'System') {
    return 'memberSettings';
  }
  if (group.ownerModule === 'Message') {
    return 'messageSettings';
  }
  if (group.ownerModule === 'Commerce') {
    return 'commerceBenefits';
  }
  return 'operationExposure';
}

export function getItemPreviewText(items: SystemMetadataItem[]): string {
  if (items.length === 0) return '-';
  const labels = items.slice(0, 2).map((item) => item.label);
  return items.length > 2 ? `${labels.join(', ')} 외 ${items.length - 2}개` : labels.join(', ');
}

export function getDefaultItemLabels(items: SystemMetadataItem[]): string[] {
  return items.filter((item) => item.isDefault).map((item) => item.label);
}

export function getFeatureSearchValues(group: SystemMetadataGroup): string[] {
  return [
    MODULE_LABELS[group.ownerModule],
    SUMMARY_FILTER_LABELS[getSettingCategory(group)],
    MANAGER_TYPE_LABELS[group.managerType]
  ];
}

export function buildDrawerGuideDescription(group: SystemMetadataGroup): string {
  if (group.linkedUserSurfaces.length === 0) {
    return '이 설정은 내부 운영에서 공통으로 쓰는 기준값입니다. 아래 설정 구조와 운영 값 목록에서 실제 선택지와 정렬 순서를 관리합니다.';
  }
  return `이 설정은 ${getPreviewText(group.linkedUserSurfaces)}에 영향을 줍니다. 운영 값 라벨과 기본값, 정렬 순서를 함께 검토해 주세요.`;
}

export function mergeUpdatedGroup(
  groups: SystemMetadataGroup[],
  updatedGroup: SystemMetadataGroup
): SystemMetadataGroup[] {
  const exists = groups.some((group) => group.groupId === updatedGroup.groupId);
  return sortGroups(
    exists
      ? groups.map((group) => (group.groupId === updatedGroup.groupId ? updatedGroup : group))
      : [updatedGroup, ...groups]
  );
}

export function matchesSummaryFilter(group: SystemMetadataGroup, summaryFilter: SummaryFilter): boolean {
  if (!summaryFilter) {
    return true;
  }
  return getSettingCategory(group) === summaryFilter;
}

export function getSyncStatusColor(status: MetadataSyncStatus): string {
  if (status === 'live') return 'green';
  if (status === 'review') return 'gold';
  return 'default';
}

export function getExposureStatusColor(status: MetadataExposureStatus): string {
  if (status === 'confirmed') return 'green';
  if (status === 'inferred') return 'gold';
  if (status === 'planned') return 'blue';
  return 'default';
}

export function getPreviewText(values: string[]): string {
  if (values.length === 0) return '-';
  if (values.length === 1) return values[0];
  return `${values[0]} 외 ${values.length - 1}개`;
}
