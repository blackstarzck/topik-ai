import { create } from 'zustand';

import type {
  MetadataExposureStatus,
  MetadataHistoryAction,
  MetadataStatus,
  SystemMetadataAuditEvent,
  SystemMetadataGroup,
  SystemMetadataHistoryEntry,
  SystemMetadataItem
} from './system-metadata-types';

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

type SystemMetadataStore = {
  groups: SystemMetadataGroup[];
  audits: SystemMetadataAuditEvent[];
  saveGroup: (payload: SaveMetadataGroupPayload) => SystemMetadataGroup;
  toggleGroupStatus: (
    payload: ToggleMetadataGroupStatusPayload
  ) => SystemMetadataGroup | null;
  saveItem: (payload: SaveMetadataItemPayload) => SystemMetadataGroup | null;
  toggleItemStatus: (payload: ToggleMetadataItemStatusPayload) => SystemMetadataGroup | null;
};

export type {
  SaveMetadataGroupPayload,
  ToggleMetadataGroupStatusPayload,
  SaveMetadataItemPayload,
  ToggleMetadataItemStatusPayload
};

function formatNow(date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

function createHistoryEntry(params: {
  historyId: string;
  action: MetadataHistoryAction;
  reason: string;
  changedBy: string;
  createdAt: string;
}): SystemMetadataHistoryEntry {
  return { ...params };
}

function createItem(params: {
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

const initialGroups: SystemMetadataGroup[] = [
  {
    groupId: 'META-GRP-001',
    groupName: '\ud68c\uc6d0 \uc0c1\ud0dc',
    description:
      'Users \ud68c\uc6d0 \ubaa9\ub85d\uacfc \uc0c1\uc138 \ud0ed\uc5d0\uc11c \uacf5\ud1b5\uc73c\ub85c \uc4f0\ub294 \ud68c\uc6d0 \uc0c1\ud0dc \ucf54\ub4dc \ud14c\uc774\ube14\uc785\ub2c8\ub2e4.',
    managerType: 'codeTable',
    ownerModule: 'Users',
    ownerRole: 'OPS_ADMIN',
    status: 'active',
    syncStatus: 'live',
    exposureStatus: 'confirmed',
    linkedAdminPages: ['/users', '/users/:userId'],
    linkedUserSurfaces: [
      '\ud68c\uc6d0 \uac00\uc785 \uc644\ub8cc \ud654\uba74',
      '\ub9c8\uc774\ud398\uc774\uc9c0 \uacc4\uc815 \uc0c1\ud0dc \ubc43\uc9c0'
    ],
    schemaCandidateNotes: [
      'user_status_codes',
      '\ud68c\uc6d0 \uc0c1\ud0dc\ub294 \uac10\uc0ac \ub85c\uadf8/\uac80\uc0c9 \ud544\ud130\uc640 \ub3d9\uc77c\ud55c code table candidate'
    ],
    itemCodePrefix: 'USER_STATUS',
    items: [
      createItem({
        itemId: 'META-ITEM-001',
        code: 'ACTIVE',
        label: '\uc815\uc0c1',
        description: '\uc815\uc0c1 \uc774\uc6a9 \uac00\ub2a5 \ud68c\uc6d0',
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
        label: '\uc815\uc9c0',
        description: '\uc6b4\uc601 \uc870\uce58\ub85c \uc11c\ube44\uc2a4 \uc774\uc6a9\uc774 \uc81c\ud55c\ub41c \ud68c\uc6d0',
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
        label: '\ud0c8\ud1f4',
        description: '\ud0c8\ud1f4 \uc644\ub8cc\ub41c \ud68c\uc6d0',
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
        reason: 'Users \uc0c1\ud0dc \ud544\ud130 \uae30\uc900 \uc815\ub9ac',
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
    groupName: '\ubc1c\uc1a1 \uc138\uadf8\uba3c\ud2b8 \ud544\ub4dc',
    description:
      '\ub300\uc0c1 \uadf8\ub8f9\uacfc \uc790\ub3d9 \ubc1c\uc1a1 \ub8f0\uc5d0\uc11c \uacf5\ud1b5 \uc0ac\uc6a9\ud558\ub294 \uc138\uadf8\uba3c\ud2b8 \ud544\ub4dc \uba54\ud0c0\ub370\uc774\ud130\uc785\ub2c8\ub2e4.',
    managerType: 'segmentField',
    ownerModule: 'Message',
    ownerRole: 'OPS_ADMIN',
    status: 'active',
    syncStatus: 'review',
    exposureStatus: 'internalOnly',
    linkedAdminPages: ['/messages/groups', '/messages/mail', '/messages/push'],
    linkedUserSurfaces: [],
    schemaCandidateNotes: [
      'message_group_segment_schema',
      '\uc2e4\ud68c\uc6d0 \uc18d\uc131\uacfc 1:1 \ub9e4\ud551 \uac80\uc99d \ud544\uc694'
    ],
    itemCodePrefix: 'SEGMENT_FIELD',
    items: [
      createItem({
        itemId: 'META-ITEM-004',
        code: 'SHOPPING_GRADE',
        label: '\uc1fc\ud551 \ub4f1\uae09',
        description:
          '\uc815\uae30 \ucfe0\ud3f0\uacfc \uba54\uc2dc\uc9c0 \uc138\uadf8\uba3c\ud2b8\uac00 \uacf5\ud1b5 \ucc38\uc870\ud558\ub294 \ub4f1\uae09 \ud544\ub4dc',
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
        label: '\ud734\uba74 \uc77c\uc218',
        description: '\ucd5c\uadfc \ud65c\ub3d9\uc77c \uae30\uc900 \ud734\uba74 \uc138\uadf8\uba3c\ud2b8 \uc0b0\ucd9c\uac12',
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
        reason: '\uba54\uc2dc\uc9c0 \ub300\uc0c1 \uadf8\ub8f9 \ucffc\ub9ac \ube4c\ub354 \uc815\ub9ac',
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
    groupName: 'FAQ \ub178\ucd9c \uc704\uce58',
    description: 'FAQ \ud050\ub808\uc774\uc158\uacfc \uc0ac\uc6a9\uc790 \ub178\ucd9c surface\ub97c \ubb36\ub294 \uc120\ud0dd \uc635\uc158\uc785\ub2c8\ub2e4.',
    managerType: 'exposureRule',
    ownerModule: 'Operation',
    ownerRole: 'OPS_ADMIN',
    status: 'active',
    syncStatus: 'live',
    exposureStatus: 'confirmed',
    linkedAdminPages: ['/operation/faq'],
    linkedUserSurfaces: ['\uace0\uac1d\uc13c\ud130 \ud648', '\uc8fc\ubb38 \uc0c1\uc138 FAQ \ube14\ub85d'],
    schemaCandidateNotes: [
      'operation_faq_curations',
      '\ub178\ucd9c \uc704\uce58\ub294 code table candidate'
    ],
    itemCodePrefix: 'FAQ_SURFACE',
    items: [
      createItem({
        itemId: 'META-ITEM-006',
        code: 'HELP_HOME',
        label: '\uace0\uac1d\uc13c\ud130 \ud648',
        description: '\uace0\uac1d\uc13c\ud130 \uccab \ud654\uba74 \uc0c1\ub2e8 FAQ \ud050\ub808\uc774\uc158',
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
        label: '\uc8fc\ubb38 \uc0c1\uc138',
        description: '\uc8fc\ubb38 \uc0c1\uc138 \ud558\ub2e8 FAQ \ubaa8\ub4c8',
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
        reason: 'FAQ \ub178\ucd9c \uc704\uce58 code table \ud6c4\ubcf4 \uc815\ub9ac',
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
    groupName: '\ucfe0\ud3f0 \uc801\uc6a9 \ubc94\uc704',
    description:
      '\ucfe0\ud3f0\uacfc \uc815\uae30 \ucfe0\ud3f0 \ud15c\ud50c\ub9bf\uc774 \uacf5\ud1b5\uc73c\ub85c \uc4f0\ub294 \uc801\uc6a9 \ubc94\uc704 \uc635\uc158\uc785\ub2c8\ub2e4.',
    managerType: 'selectOption',
    ownerModule: 'Commerce',
    ownerRole: 'OPS_ADMIN',
    status: 'active',
    syncStatus: 'live',
    exposureStatus: 'internalOnly',
    linkedAdminPages: ['/commerce/coupons'],
    linkedUserSurfaces: [],
    schemaCandidateNotes: [
      'coupon-form-schema.ts',
      '\uc0c1\ud488/\uce74\ud14c\uace0\ub9ac \ucc38\uc870\ub294 \ud6c4\uc18d API \uc5f0\ub3d9 \ud544\uc694'
    ],
    itemCodePrefix: 'COUPON_SCOPE',
    items: [
      createItem({
        itemId: 'META-ITEM-008',
        code: 'ALL_PRODUCTS',
        label: '\uc804\uccb4 \uc0c1\ud488',
        description: '\ubaa8\ub4e0 \uc0c1\ud488\uc5d0 \uc801\uc6a9',
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
        label: '\ud2b9\uc815 \uce74\ud14c\uace0\ub9ac',
        description: '\uc120\ud0dd\ud55c \uce74\ud14c\uace0\ub9ac\uc5d0\ub9cc \uc801\uc6a9',
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
        reason: '\ucfe0\ud3f0 \uc801\uc6a9 \ubc94\uc704 \ubd84\ub958\ub97c schema candidate\uc5d0\uc11c \ubd84\ub9ac',
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
    groupName: '\uad00\ub9ac\uc790 \uc5ed\ud560 \ud15c\ud50c\ub9bf',
    description:
      '\uad00\ub9ac\uc790 \uad8c\ud55c \uc138\ud2b8\uc640 \uc5ed\ud560 \uc124\uba85\uc5d0 \uc5f0\uacb0\ub418\ub294 \uc6b4\uc601 \uba54\ud0c0\ub370\uc774\ud130\uc785\ub2c8\ub2e4.',
    managerType: 'codeTable',
    ownerModule: 'System',
    ownerRole: 'SUPER_ADMIN',
    status: 'active',
    syncStatus: 'review',
    exposureStatus: 'internalOnly',
    linkedAdminPages: ['/system/admins', '/system/permissions'],
    linkedUserSurfaces: [],
    schemaCandidateNotes: [
      'role_catalog',
      '\uad8c\ud55c \uc2b9\uc778 \uc808\ucc28 \ud655\uc815 \uc804\uae4c\uc9c0 \ub0b4\ubd80 \uba54\ud0c0 \ud6c4\ubcf4 \uc720\uc9c0'
    ],
    itemCodePrefix: 'ADMIN_ROLE',
    items: [
      createItem({
        itemId: 'META-ITEM-010',
        code: 'OPS_ADMIN',
        label: '\uc6b4\uc601 \uad00\ub9ac\uc790',
        description:
          '\uc6b4\uc601, \ucee4\ubba4\ub2c8\ud2f0, \uba54\uc2dc\uc9c0, \ucee4\uba38\uc2a4 \uad8c\ud55c \ubb36\uc74c',
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
        label: '\ucf58\ud150\uce20 \uad00\ub9ac\uc790',
        description: 'Assessment, Content \uc911\uc2ec \uc6b4\uc601 \uc5ed\ud560',
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
        reason: '\uad8c\ud55c \uad00\ub9ac \uc124\uba85\uc6a9 \uc5ed\ud560 \ud15c\ud50c\ub9bf \uc815\ub9ac',
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
    groupName: '\ubc30\uc9c0 \ub4f1\uae09',
    description:
      '\ucf58\ud150\uce20 \ubc30\uc9c0 \ub4f1\uae09\uacfc \uc0c9\uc0c1 \uc138\ud2b8\ub97c \uad00\ub9ac\ud560 \ud6c4\ubcf4 \uba54\ud0c0 \uadf8\ub8f9\uc785\ub2c8\ub2e4.',
    managerType: 'codeTable',
    ownerModule: 'Content',
    ownerRole: 'CONTENT_MANAGER',
    status: 'inactive',
    syncStatus: 'draft',
    exposureStatus: 'planned',
    linkedAdminPages: ['/content/badges'],
    linkedUserSurfaces: ['\ubc30\uc9c0 \ud68d\ub4dd \ud654\uba74'],
    schemaCandidateNotes: [
      'badge_grade_codes',
      'Content \ud398\uc774\uc9c0 \uad6c\ud604 \uc804\uae4c\uc9c0 \ucd08\uc548 \uc720\uc9c0'
    ],
    itemCodePrefix: 'BADGE_GRADE',
    items: [
      createItem({
        itemId: 'META-ITEM-012',
        code: 'BRONZE',
        label: '\ube0c\ub860\uc988',
        description: '\uc785\ubb38 \ub4f1\uae09',
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
        label: '\uc2e4\ubc84',
        description: '\uc911\uac04 \ub4f1\uae09',
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
        reason: '\ucf58\ud150\uce20 \ubc30\uc9c0 \ub4f1\uae09 \uc124\uacc4 \ucd08\uc548',
        changedBy: 'admin_han',
        createdAt: '2026-03-10 15:35:00'
      })
    ],
    updatedAt: '2026-03-10 15:35:00',
    updatedBy: 'admin_han',
    lastReviewedAt: '2026-03-10 15:35:00'
  }
];

const initialAudits: SystemMetadataAuditEvent[] = initialGroups.flatMap((group, index) =>
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
    const normalizedItems = sortItems(
      nextItems.map((item) => ({
        ...item,
        isDefault: defaultItemId ? item.itemId === defaultItemId : item.isDefault
      }))
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
  }
}));
