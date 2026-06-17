import { supabaseClient } from '../../../shared/api/supabase-client';
import type {
  DeleteMetadataItemPayload,
  ReorderMetadataItemsPayload,
  SaveMetadataGroupPayload,
  SaveMetadataItemPayload,
  ToggleMetadataGroupStatusPayload,
  ToggleMetadataItemStatusPayload
} from '../model/system-metadata-store';
import type {
  MetadataExposureStatus,
  MetadataHistoryAction,
  MetadataManagerType,
  MetadataModule,
  MetadataStatus,
  MetadataSyncStatus,
  SystemMetadataGroup,
  SystemMetadataItem
} from '../model/system-metadata-types';

type MetadataGroupRow = {
  group_id: string;
  group_name: string;
  description: string;
  owner_role: string;
  item_code_prefix: string;
  manager_type: string;
  owner_module: string;
  status: string;
  sync_status: string;
  exposure_status: string;
  linked_admin_pages: unknown;
  linked_user_surfaces: unknown;
  schema_candidate_notes: unknown;
  created_at: string | null;
  updated_at: string | null;
  updated_by: string | null;
};

type MetadataItemRow = {
  item_id: string;
  group_id: string;
  code: string;
  label: string;
  description: string;
  sort_order: number;
  status: string;
  exposure_status: string;
  is_default: boolean;
  created_at: string | null;
  updated_at: string | null;
  updated_by: string | null;
};

const GROUP_COLUMNS = [
  'group_id',
  'group_name',
  'description',
  'owner_role',
  'item_code_prefix',
  'manager_type',
  'owner_module',
  'status',
  'sync_status',
  'exposure_status',
  'linked_admin_pages',
  'linked_user_surfaces',
  'schema_candidate_notes',
  'created_at',
  'updated_at',
  'updated_by'
].join(', ');

const ITEM_COLUMNS = [
  'item_id',
  'group_id',
  'code',
  'label',
  'description',
  'sort_order',
  'status',
  'exposure_status',
  'is_default',
  'created_at',
  'updated_at',
  'updated_by'
].join(', ');

function requireClient() {
  if (!supabaseClient) {
    throw new Error('Supabase client not configured');
  }
  return supabaseClient;
}

function requireReason(reason: string): string {
  const trimmed = reason.trim();
  if (!trimmed) {
    throw new Error('사유/근거를 입력하세요. (RPC p_reason 필수)');
  }
  return trimmed;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new DOMException('Request aborted', 'AbortError');
  }
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function toDateTime(value: string | null | undefined): string {
  return value ? value.slice(0, 19).replace('T', ' ') : '';
}

function toStatus(value: string): MetadataStatus {
  return value === 'inactive' ? 'inactive' : 'active';
}

function mapItemRow(row: MetadataItemRow): SystemMetadataItem {
  return {
    itemId: row.item_id,
    code: row.code,
    label: row.label,
    description: row.description,
    status: toStatus(row.status),
    sortOrder: row.sort_order,
    isDefault: row.is_default,
    exposureStatus: row.exposure_status as MetadataExposureStatus,
    updatedAt: toDateTime(row.updated_at ?? row.created_at),
    updatedBy: row.updated_by ?? 'system'
  };
}

function createHistoryAction(row: MetadataGroupRow): MetadataHistoryAction {
  return row.created_at && row.updated_at && row.created_at !== row.updated_at
    ? 'group_updated'
    : 'group_created';
}

function mapGroupRow(row: MetadataGroupRow, items: SystemMetadataItem[]): SystemMetadataGroup {
  const updatedAt = toDateTime(row.updated_at ?? row.created_at);
  const updatedBy = row.updated_by ?? 'system';

  return {
    groupId: row.group_id,
    groupName: row.group_name,
    description: row.description,
    managerType: row.manager_type as MetadataManagerType,
    ownerModule: row.owner_module as MetadataModule,
    ownerRole: row.owner_role,
    status: toStatus(row.status),
    syncStatus: row.sync_status as MetadataSyncStatus,
    exposureStatus: row.exposure_status as MetadataExposureStatus,
    linkedAdminPages: toStringArray(row.linked_admin_pages),
    linkedAdminLocations: [],
    linkedUserSurfaces: toStringArray(row.linked_user_surfaces),
    schemaCandidateNotes: toStringArray(row.schema_candidate_notes),
    itemCodePrefix: row.item_code_prefix,
    items,
    history: [
      {
        historyId: `${row.group_id}-DB-HIS`,
        action: createHistoryAction(row),
        reason: 'Supabase metadata snapshot',
        changedBy: updatedBy,
        createdAt: updatedAt
      }
    ],
    updatedAt,
    updatedBy,
    lastReviewedAt: updatedAt
  };
}

async function loadGroup(groupId: string): Promise<SystemMetadataGroup> {
  const groups = await loadMetadataGroupsFromSupabase();
  const group = groups.find((item) => item.groupId === groupId);
  if (!group) {
    throw new Error('메타 그룹을 찾을 수 없습니다.');
  }
  return group;
}

export async function loadMetadataGroupsFromSupabase(
  signal?: AbortSignal
): Promise<SystemMetadataGroup[]> {
  const client = requireClient();
  const [groupsResult, itemsResult] = await Promise.all([
    client
      .from('system_metadata_groups')
      .select(GROUP_COLUMNS)
      .order('updated_at', { ascending: false }),
    client
      .from('system_metadata_group_items')
      .select(ITEM_COLUMNS)
      .order('sort_order', { ascending: true })
  ]);

  throwIfAborted(signal);
  if (groupsResult.error) throw new Error(groupsResult.error.message);
  if (itemsResult.error) throw new Error(itemsResult.error.message);

  const itemRows = (itemsResult.data ?? []) as unknown as MetadataItemRow[];
  const itemMap = new Map<string, SystemMetadataItem[]>();
  itemRows.forEach((row) => {
    const nextItems = itemMap.get(row.group_id) ?? [];
    nextItems.push(mapItemRow(row));
    itemMap.set(row.group_id, nextItems);
  });

  return ((groupsResult.data ?? []) as unknown as MetadataGroupRow[]).map((row) =>
    mapGroupRow(row, itemMap.get(row.group_id) ?? [])
  );
}

export async function saveMetadataGroupViaRpc(
  payload: SaveMetadataGroupPayload
): Promise<SystemMetadataGroup> {
  const client = requireClient();
  const { data, error } = await client.rpc('admin_save_metadata_group', {
    p_group_id: payload.groupId ?? null,
    p_group: {
      group_name: payload.groupName,
      description: payload.description,
      manager_type: payload.managerType,
      owner_module: payload.ownerModule,
      owner_role: payload.ownerRole,
      sync_status: payload.syncStatus,
      exposure_status: payload.exposureStatus,
      linked_admin_pages: payload.linkedAdminPages,
      linked_user_surfaces: payload.linkedUserSurfaces,
      schema_candidate_notes: payload.schemaCandidateNotes,
      item_code_prefix: payload.itemCodePrefix,
      updated_by: payload.changedBy
    },
    p_reason: requireReason(payload.reason)
  });

  if (error) throw new Error(error.message);
  return loadGroup(String(data));
}

export async function saveMetadataItemViaRpc(
  payload: SaveMetadataItemPayload
): Promise<SystemMetadataGroup> {
  const client = requireClient();
  const { data, error } = await client.rpc('admin_save_metadata_item', {
    p_item_id: payload.itemId ?? null,
    p_item: {
      group_id: payload.groupId,
      code: payload.code,
      label: payload.label,
      description: payload.description,
      status: payload.status,
      sort_order: payload.sortOrder,
      is_default: payload.isDefault,
      exposure_status: payload.exposureStatus,
      updated_by: payload.changedBy
    },
    p_reason: requireReason(payload.reason)
  });

  if (error) throw new Error(error.message);
  return loadGroup(String(data));
}

export async function toggleMetadataGroupStatusViaRpc(
  payload: ToggleMetadataGroupStatusPayload
): Promise<SystemMetadataGroup> {
  const client = requireClient();
  const { data, error } = await client.rpc('admin_toggle_metadata_group_status', {
    p_group_id: payload.groupId,
    p_next_status: payload.nextStatus,
    p_reason: requireReason(payload.reason)
  });

  if (error) throw new Error(error.message);
  return loadGroup(String(data));
}

export async function toggleMetadataItemStatusViaRpc(
  payload: ToggleMetadataItemStatusPayload
): Promise<SystemMetadataGroup> {
  const client = requireClient();
  const { data, error } = await client.rpc('admin_toggle_metadata_item_status', {
    p_item_id: payload.itemId,
    p_next_status: payload.nextStatus,
    p_reason: requireReason(payload.reason)
  });

  if (error) throw new Error(error.message);
  return loadGroup(String(data));
}

export async function deleteMetadataItemViaRpc(
  payload: DeleteMetadataItemPayload
): Promise<SystemMetadataGroup> {
  const client = requireClient();
  const { data, error } = await client.rpc('admin_delete_metadata_item', {
    p_item_id: payload.itemId,
    p_reason: requireReason(payload.reason)
  });

  if (error) throw new Error(error.message);
  return loadGroup(String(data));
}

export async function reorderMetadataItemsViaRpc(
  payload: ReorderMetadataItemsPayload
): Promise<SystemMetadataGroup> {
  const client = requireClient();
  const { data, error } = await client.rpc('admin_reorder_metadata_items', {
    p_group_id: payload.groupId,
    p_ordered_item_ids: payload.orderedItemIds,
    p_reason: requireReason(payload.reason)
  });

  if (error) throw new Error(error.message);
  return loadGroup(String(data));
}
