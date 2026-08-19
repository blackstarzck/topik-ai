import { create } from 'zustand';

import type {
  MetadataExposureStatus,
  MetadataStatus,
  SystemMetadataAuditEvent,
  SystemMetadataGroup,
  SystemMetadataItem
} from './system-metadata-types';
import { formatNowSeconds as formatNow } from '@/shared/model/date-format';
import { createAdminLocation, createHistoryEntry } from './system-metadata-factories';
import { initialAudits, initialGroups } from './system-metadata-seed';

type SaveMetadataGroupPayload = {
  groupId?: string;
  groupName: string;
  description: string;
  managerType: SystemMetadataGroup['managerType'];
  ownerModule: SystemMetadataGroup['ownerModule'];
  ownerRole: string;
  syncStatus: SystemMetadataGroup['syncStatus'];
  exposureStatus: SystemMetadataGroup['exposureStatus'];
  linkedAdminPages: string[];
  linkedUserSurfaces: string[];
  schemaCandidateNotes: string[];
  itemCodePrefix: string;
  reason: string;
  changedBy: string;
};

type ToggleMetadataGroupStatusPayload = {
  groupId: string;
  nextStatus: MetadataStatus;
  reason: string;
  changedBy: string;
};

type SaveMetadataItemPayload = {
  groupId: string;
  itemId?: string;
  code: string;
  label: string;
  description: string;
  status: MetadataStatus;
  sortOrder: number;
  isDefault: boolean;
  exposureStatus: MetadataExposureStatus;
  reason: string;
  changedBy: string;
};

type ToggleMetadataItemStatusPayload = {
  groupId: string;
  itemId: string;
  nextStatus: MetadataStatus;
  reason: string;
  changedBy: string;
};

type DeleteMetadataItemPayload = {
  groupId: string;
  itemId: string;
  reason: string;
  changedBy: string;
};

type ReorderMetadataItemsPayload = {
  groupId: string;
  orderedItemIds: string[];
  reason: string;
  changedBy: string;
};

type SystemMetadataStore = {
  groups: SystemMetadataGroup[];
  audits: SystemMetadataAuditEvent[];
  saveGroup: (payload: SaveMetadataGroupPayload) => SystemMetadataGroup;
  toggleGroupStatus: (
    payload: ToggleMetadataGroupStatusPayload
  ) => SystemMetadataGroup | null;
  saveItem: (payload: SaveMetadataItemPayload) => SystemMetadataGroup | null;
  toggleItemStatus: (payload: ToggleMetadataItemStatusPayload) => SystemMetadataGroup | null;
  deleteItem: (payload: DeleteMetadataItemPayload) => SystemMetadataGroup | null;
  reorderItems: (payload: ReorderMetadataItemsPayload) => SystemMetadataGroup | null;
};

export type {
  SaveMetadataGroupPayload,
  ToggleMetadataGroupStatusPayload,
  SaveMetadataItemPayload,
  ToggleMetadataItemStatusPayload,
  DeleteMetadataItemPayload,
  ReorderMetadataItemsPayload
};

const MODULE_LOCATION_LABELS: Record<SystemMetadataGroup['ownerModule'], string> = {
  Users: '회원',
  Message: '메시지',
  Operation: '운영',
  Commerce: '커머스',
  Content: '콘텐츠',
  System: '시스템'
};

function createFallbackAdminLocations(
  groupId: string,
  ownerModule: SystemMetadataGroup['ownerModule'],
  linkedAdminPages: string[]
): SystemMetadataGroup['linkedAdminLocations'] {
  return linkedAdminPages.map((route, index) =>
    createAdminLocation({
      locationId: `${groupId}-LOC-${String(index + 1).padStart(2, '0')}`,
      route,
      path: [MODULE_LOCATION_LABELS[ownerModule], route],
      note: '세부 관리 위치 정보가 아직 등록되지 않았습니다.'
    })
  );
}

function syncAdminLocations(params: {
  existingLocations: SystemMetadataGroup['linkedAdminLocations'];
  groupId: string;
  ownerModule: SystemMetadataGroup['ownerModule'];
  linkedAdminPages: string[];
}): SystemMetadataGroup['linkedAdminLocations'] {
  const { existingLocations, groupId, ownerModule, linkedAdminPages } = params;

  return linkedAdminPages.map((route) => {
    const matchedLocation = existingLocations.find((location) => location.route === route);
    if (!matchedLocation) {
      return createFallbackAdminLocations(groupId, ownerModule, [route])[0];
    }

    return createAdminLocation({
      ...matchedLocation,
      path:
        matchedLocation.path.length > 0
          ? [MODULE_LOCATION_LABELS[ownerModule], ...matchedLocation.path.slice(1)]
          : [MODULE_LOCATION_LABELS[ownerModule], route]
    });
  });
}

function createGroupId(groups: SystemMetadataGroup[]): string {
  const nextSequence =
    groups
      .map((group) => Number(group.groupId.replace('META-GRP-', '')))
      .reduce((max, value) => Math.max(max, value), 0) + 1;

  return `META-GRP-${String(nextSequence).padStart(3, '0')}`;
}

function createHistoryId(groups: SystemMetadataGroup[]): string {
  const nextSequence =
    groups
      .flatMap((group) => group.history)
      .map((entry) => Number(entry.historyId.replace('META-HIS-', '')))
      .reduce((max, value) => Math.max(max, value), 0) + 1;

  return `META-HIS-${String(nextSequence).padStart(3, '0')}`;
}

function createItemId(groups: SystemMetadataGroup[]): string {
  const nextSequence =
    groups
      .flatMap((group) => group.items)
      .map((item) => Number(item.itemId.replace('META-ITEM-', '')))
      .reduce((max, value) => Math.max(max, value), 0) + 1;

  return `META-ITEM-${String(nextSequence).padStart(3, '0')}`;
}

function createAuditId(audits: SystemMetadataAuditEvent[]): string {
  const nextSequence =
    audits
      .map((audit) => Number(audit.id.replace('AL-META-', '')))
      .reduce((max, value) => Math.max(max, value), 0) + 1;

  return `AL-META-${String(nextSequence).padStart(4, '0')}`;
}

function sortItems(items: SystemMetadataItem[]): SystemMetadataItem[] {
  return [...items].sort((left, right) => {
    if (left.sortOrder === right.sortOrder) {
      return left.label.localeCompare(right.label);
    }

    return left.sortOrder - right.sortOrder;
  });
}

function normalizeItemSortOrders(items: SystemMetadataItem[]): SystemMetadataItem[] {
  return items.map((item, index) => ({
    ...item,
    sortOrder: index + 1
  }));
}

export const useSystemMetadataStore = create<SystemMetadataStore>((set, get) => ({
  groups: initialGroups,
  audits: initialAudits.sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
  saveGroup: (payload) => {
    const now = formatNow();
    const groups = get().groups;
    const audits = get().audits;
    const existingGroup = payload.groupId
      ? groups.find((group) => group.groupId === payload.groupId) ?? null
      : null;
    const groupId = existingGroup?.groupId ?? createGroupId(groups);
    const historyEntry = createHistoryEntry({
      historyId: createHistoryId(groups),
      action: existingGroup ? 'group_updated' : 'group_created',
      reason: payload.reason,
      changedBy: payload.changedBy,
      createdAt: now
    });

    const nextGroup: SystemMetadataGroup = {
      groupId,
      groupName: payload.groupName,
      description: payload.description,
      managerType: payload.managerType,
      ownerModule: payload.ownerModule,
      ownerRole: payload.ownerRole,
      status: existingGroup?.status ?? 'active',
      syncStatus: payload.syncStatus,
      exposureStatus: payload.exposureStatus,
      linkedAdminPages: payload.linkedAdminPages,
      linkedAdminLocations: syncAdminLocations({
        existingLocations: existingGroup?.linkedAdminLocations ?? [],
        groupId,
        ownerModule: payload.ownerModule,
        linkedAdminPages: payload.linkedAdminPages
      }),
      linkedUserSurfaces: payload.linkedUserSurfaces,
      schemaCandidateNotes: payload.schemaCandidateNotes,
      itemCodePrefix: payload.itemCodePrefix,
      items: existingGroup?.items ?? [],
      history: [historyEntry, ...(existingGroup?.history ?? [])],
      updatedAt: now,
      updatedBy: payload.changedBy,
      lastReviewedAt: payload.syncStatus === 'draft' ? existingGroup?.lastReviewedAt ?? now : now
    };

    const auditEntry: SystemMetadataAuditEvent = {
      id: createAuditId(audits),
      targetType: 'SystemMetadataGroup',
      targetId: groupId,
      action: historyEntry.action,
      reason: historyEntry.reason,
      changedBy: historyEntry.changedBy,
      createdAt: historyEntry.createdAt
    };

    set((state) => ({
      groups: existingGroup
        ? state.groups.map((group) => (group.groupId === groupId ? nextGroup : group))
        : [nextGroup, ...state.groups],
      audits: [auditEntry, ...state.audits]
    }));

    return nextGroup;
  },
  toggleGroupStatus: (payload) => {
    const targetGroup = get().groups.find((group) => group.groupId === payload.groupId);
    if (!targetGroup) {
      return null;
    }

    const now = formatNow();
    const groups = get().groups;
    const audits = get().audits;
    const historyEntry = createHistoryEntry({
      historyId: createHistoryId(groups),
      action: payload.nextStatus === 'active' ? 'group_activated' : 'group_deactivated',
      reason: payload.reason,
      changedBy: payload.changedBy,
      createdAt: now
    });
    const nextGroup: SystemMetadataGroup = {
      ...targetGroup,
      status: payload.nextStatus,
      updatedAt: now,
      updatedBy: payload.changedBy,
      history: [historyEntry, ...targetGroup.history]
    };

    set((state) => ({
      groups: state.groups.map((group) =>
        group.groupId === payload.groupId ? nextGroup : group
      ),
      audits: [
        {
          id: createAuditId(audits),
          targetType: 'SystemMetadataGroup',
          targetId: payload.groupId,
          action: historyEntry.action,
          reason: historyEntry.reason,
          changedBy: historyEntry.changedBy,
          createdAt: historyEntry.createdAt
        },
        ...state.audits
      ]
    }));

    return nextGroup;
  },
  saveItem: (payload) => {
    const targetGroup = get().groups.find((group) => group.groupId === payload.groupId);
    if (!targetGroup) {
      return null;
    }

    const groups = get().groups;
    const audits = get().audits;
    const now = formatNow();
    const existingItem = payload.itemId
      ? targetGroup.items.find((item) => item.itemId === payload.itemId) ?? null
      : null;
    const nextItem: SystemMetadataItem = {
      itemId: existingItem?.itemId ?? createItemId(groups),
      code: payload.code,
      label: payload.label,
      description: payload.description,
      status: payload.status,
      sortOrder: payload.sortOrder,
      isDefault: payload.isDefault,
      exposureStatus: payload.exposureStatus,
      updatedAt: now,
      updatedBy: payload.changedBy
    };
    const historyEntry = createHistoryEntry({
      historyId: createHistoryId(groups),
      action: existingItem ? 'item_updated' : 'item_created',
      reason: payload.reason,
      changedBy: payload.changedBy,
      createdAt: now
    });

    const nextItems = existingItem
      ? targetGroup.items.map((item) => (item.itemId === nextItem.itemId ? nextItem : item))
      : [nextItem, ...targetGroup.items];
    const defaultItemId = payload.isDefault ? nextItem.itemId : null;
    const normalizedItems = normalizeItemSortOrders(
      sortItems(
        nextItems.map((item) => ({
          ...item,
          isDefault: defaultItemId ? item.itemId === defaultItemId : item.isDefault
        }))
      )
    );

    const nextGroup: SystemMetadataGroup = {
      ...targetGroup,
      items: normalizedItems,
      history: [historyEntry, ...targetGroup.history],
      updatedAt: now,
      updatedBy: payload.changedBy
    };

    set((state) => ({
      groups: state.groups.map((group) =>
        group.groupId === payload.groupId ? nextGroup : group
      ),
      audits: [
        {
          id: createAuditId(audits),
          targetType: 'SystemMetadataGroup',
          targetId: payload.groupId,
          action: historyEntry.action,
          reason: historyEntry.reason,
          changedBy: historyEntry.changedBy,
          createdAt: historyEntry.createdAt
        },
        ...state.audits
      ]
    }));

    return nextGroup;
  },
  toggleItemStatus: (payload) => {
    const targetGroup = get().groups.find((group) => group.groupId === payload.groupId);
    if (!targetGroup) {
      return null;
    }

    const targetItem = targetGroup.items.find((item) => item.itemId === payload.itemId);
    if (!targetItem) {
      return null;
    }

    const groups = get().groups;
    const audits = get().audits;
    const now = formatNow();
    const historyEntry = createHistoryEntry({
      historyId: createHistoryId(groups),
      action: payload.nextStatus === 'active' ? 'item_activated' : 'item_deactivated',
      reason: payload.reason,
      changedBy: payload.changedBy,
      createdAt: now
    });
    const nextGroup: SystemMetadataGroup = {
      ...targetGroup,
      items: sortItems(
        targetGroup.items.map((item) =>
          item.itemId === payload.itemId
            ? {
                ...item,
                status: payload.nextStatus,
                updatedAt: now,
                updatedBy: payload.changedBy
              }
            : item
        )
      ),
      history: [historyEntry, ...targetGroup.history],
      updatedAt: now,
      updatedBy: payload.changedBy
    };

    set((state) => ({
      groups: state.groups.map((group) =>
        group.groupId === payload.groupId ? nextGroup : group
      ),
      audits: [
        {
          id: createAuditId(audits),
          targetType: 'SystemMetadataGroup',
          targetId: payload.groupId,
          action: historyEntry.action,
          reason: historyEntry.reason,
          changedBy: historyEntry.changedBy,
          createdAt: historyEntry.createdAt
        },
        ...state.audits
      ]
    }));

    return nextGroup;
  },
  deleteItem: (payload) => {
    const targetGroup = get().groups.find((group) => group.groupId === payload.groupId);
    if (!targetGroup) {
      return null;
    }

    const targetItem = targetGroup.items.find((item) => item.itemId === payload.itemId);
    if (!targetItem) {
      return null;
    }

    const groups = get().groups;
    const audits = get().audits;
    const now = formatNow();
    const remainingItems = targetGroup.items.filter((item) => item.itemId !== payload.itemId);
    const fallbackDefaultItemId = targetItem.isDefault
      ? sortItems(remainingItems)[0]?.itemId ?? null
      : null;
    const nextItems = normalizeItemSortOrders(
      sortItems(
        remainingItems.map((item) => ({
          ...item,
          isDefault: fallbackDefaultItemId ? item.itemId === fallbackDefaultItemId : item.isDefault,
          updatedAt: now,
          updatedBy: payload.changedBy
        }))
      )
    );
    const historyEntry = createHistoryEntry({
      historyId: createHistoryId(groups),
      action: 'item_deleted',
      reason: payload.reason,
      changedBy: payload.changedBy,
      createdAt: now
    });

    const nextGroup: SystemMetadataGroup = {
      ...targetGroup,
      items: nextItems,
      history: [historyEntry, ...targetGroup.history],
      updatedAt: now,
      updatedBy: payload.changedBy
    };

    set((state) => ({
      groups: state.groups.map((group) =>
        group.groupId === payload.groupId ? nextGroup : group
      ),
      audits: [
        {
          id: createAuditId(audits),
          targetType: 'SystemMetadataGroup',
          targetId: payload.groupId,
          action: historyEntry.action,
          reason: historyEntry.reason,
          changedBy: historyEntry.changedBy,
          createdAt: historyEntry.createdAt
        },
        ...state.audits
      ]
    }));

    return nextGroup;
  },
  reorderItems: (payload) => {
    const targetGroup = get().groups.find((group) => group.groupId === payload.groupId);
    if (!targetGroup) {
      return null;
    }

    const groups = get().groups;
    const audits = get().audits;
    const now = formatNow();
    const itemMap = new Map(targetGroup.items.map((item) => [item.itemId, item]));
    const orderedItems = payload.orderedItemIds
      .map((itemId) => itemMap.get(itemId) ?? null)
      .filter((item): item is SystemMetadataItem => item !== null);

    const remainingItems = targetGroup.items.filter(
      (item) => !payload.orderedItemIds.includes(item.itemId)
    );

    const nextItems = normalizeItemSortOrders(
      [...orderedItems, ...remainingItems].map((item) => ({
        ...item,
        updatedAt: now,
        updatedBy: payload.changedBy
      }))
    );

    const historyEntry = createHistoryEntry({
      historyId: createHistoryId(groups),
      action: 'item_reordered',
      reason: payload.reason,
      changedBy: payload.changedBy,
      createdAt: now
    });

    const nextGroup: SystemMetadataGroup = {
      ...targetGroup,
      items: nextItems,
      history: [historyEntry, ...targetGroup.history],
      updatedAt: now,
      updatedBy: payload.changedBy
    };

    set((state) => ({
      groups: state.groups.map((group) =>
        group.groupId === payload.groupId ? nextGroup : group
      ),
      audits: [
        {
          id: createAuditId(audits),
          targetType: 'SystemMetadataGroup',
          targetId: payload.groupId,
          action: historyEntry.action,
          reason: historyEntry.reason,
          changedBy: historyEntry.changedBy,
          createdAt: historyEntry.createdAt
        },
        ...state.audits
      ]
    }));

    return nextGroup;
  }
}));

