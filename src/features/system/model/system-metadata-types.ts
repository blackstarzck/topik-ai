export type MetadataModule =
  | 'Users'
  | 'Message'
  | 'Operation'
  | 'Commerce'
  | 'Content'
  | 'System';

export type MetadataManagerType =
  | 'codeTable'
  | 'selectOption'
  | 'exposureRule'
  | 'segmentField';

export type MetadataExposureStatus =
  | 'confirmed'
  | 'inferred'
  | 'internalOnly'
  | 'planned';

export type MetadataSyncStatus = 'live' | 'review' | 'draft';
export type MetadataStatus = 'active' | 'inactive';

export type MetadataHistoryAction =
  | 'group_created'
  | 'group_updated'
  | 'group_activated'
  | 'group_deactivated'
  | 'item_created'
  | 'item_deleted'
  | 'item_reordered'
  | 'item_updated'
  | 'item_activated'
  | 'item_deactivated';

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
  action: MetadataHistoryAction;
  reason: string;
  changedBy: string;
  createdAt: string;
};

export type SystemMetadataAdminLocation = {
  locationId: string;
  route: string;
  path: string[];
  note?: string;
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
  linkedAdminLocations: SystemMetadataAdminLocation[];
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
  action: MetadataHistoryAction;
  reason: string;
  changedBy: string;
  createdAt: string;
};

export const metadataManagerTypeOptions: Array<{
  label: MetadataManagerType;
  value: MetadataManagerType;
}> = [
  { label: 'codeTable', value: 'codeTable' },
  { label: 'selectOption', value: 'selectOption' },
  { label: 'exposureRule', value: 'exposureRule' },
  { label: 'segmentField', value: 'segmentField' }
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
  { label: 'confirmed', value: 'confirmed' },
  { label: 'inferred', value: 'inferred' },
  { label: 'internalOnly', value: 'internalOnly' },
  { label: 'planned', value: 'planned' }
];

export const metadataSyncStatusOptions: Array<{
  label: MetadataSyncStatus;
  value: MetadataSyncStatus;
}> = [
  { label: 'live', value: 'live' },
  { label: 'review', value: 'review' },
  { label: 'draft', value: 'draft' }
];

export const metadataStatusOptions: Array<{
  label: MetadataStatus;
  value: MetadataStatus;
}> = [
  { label: 'active', value: 'active' },
  { label: 'inactive', value: 'inactive' }
];
