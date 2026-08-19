import type {
  MetadataExposureStatus,
  MetadataHistoryAction,
  MetadataStatus,
  SystemMetadataGroup,
  SystemMetadataHistoryEntry,
  SystemMetadataItem
} from './system-metadata-types';

// 메타데이터 그룹 시드·store 가 함께 쓰는 엔트리 팩토리 — Phase 4 분해로 이동(동작 동일).

export function createHistoryEntry(params: {
  historyId: string;
  action: MetadataHistoryAction;
  reason: string;
  changedBy: string;
  createdAt: string;
}): SystemMetadataHistoryEntry {
  return { ...params };
}

export function createItem(params: {
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
}): SystemMetadataItem {
  return { ...params };
}

export function createAdminLocation(params: {
  locationId: string;
  route: string;
  path: string[];
  note?: string;
}): SystemMetadataGroup['linkedAdminLocations'][number] {
  return { ...params };
}
