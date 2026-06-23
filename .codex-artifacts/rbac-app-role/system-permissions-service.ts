import { toSafeResult, withRetry } from '../../../shared/api/safe-request';
import { supabaseClient } from '../../../shared/api/supabase-client';
import { mapAppRoleToRoleKey, permissionKeysForRole } from '../../auth/model/app-role-mapping';
import type { V13AppRole } from '../../auth/model/session-types';
import { usePermissionStore } from '../model/permission-store';
import type { AdminPermissionAssignment, RoleKey } from '../model/permission-types';
import { systemPermissionsDataSource } from './system-permissions-data-source';

export type AdminAppRoleRow = {
  adminId: string;
  email: string;
  displayName: string;
  appRole: V13AppRole;
  roleKey: RoleKey | null;
  permissionCount: number;
  status: string;
  lastLoginAt: string;
  updatedAt: string;
};

type AdminUserRpcRow = {
  user_id: string;
  email: string | null;
  display_name: string | null;
  nickname: string | null;
  app_role: string;
  status: string;
  last_sign_in_at: string | null;
  created_at: string;
};

export type ChangeAdminAppRolePayload = {
  targetUserId: string;
  newAppRole: V13AppRole;
  reason: string;
};

function toDateTime(value: string | null | undefined): string {
  return value ? value.replace('T', ' ').slice(0, 19) : '';
}

function roleKeyToMockAppRole(role: RoleKey): V13AppRole {
  if (role === 'SUPER_ADMIN') {
    return 'platform_admin';
  }
  if (role === 'CONTENT_MANAGER') {
    return 'content_admin';
  }
  if (role === 'READ_ONLY') {
    return 'org_admin';
  }
  return 'content_admin';
}

function appRoleToMockRole(appRole: V13AppRole): RoleKey {
  return mapAppRoleToRoleKey(appRole) ?? 'READ_ONLY';
}

function mapAssignmentToRow(assignment: AdminPermissionAssignment): AdminAppRoleRow {
  const appRole = roleKeyToMockAppRole(assignment.role);
  const roleKey = mapAppRoleToRoleKey(appRole);
  return {
    adminId: assignment.adminId,
    email: `${assignment.adminId}@mock.local`,
    displayName: assignment.name,
    appRole,
    roleKey,
    permissionCount: roleKey ? permissionKeysForRole(roleKey).length : 0,
    status: assignment.status,
    lastLoginAt: assignment.lastLoginAt,
    updatedAt: assignment.updatedAt
  };
}

function mapRpcRow(row: AdminUserRpcRow): AdminAppRoleRow {
  const appRole = row.app_role as V13AppRole;
  const roleKey = mapAppRoleToRoleKey(appRole);
  return {
    adminId: row.user_id,
    email: row.email ?? '',
    displayName: row.display_name ?? row.nickname ?? row.email ?? row.user_id,
    appRole,
    roleKey,
    permissionCount: roleKey ? permissionKeysForRole(roleKey).length : 0,
    status: row.status,
    lastLoginAt: toDateTime(row.last_sign_in_at),
    updatedAt: toDateTime(row.created_at)
  };
}

async function loadAdminAppRoles(signal?: AbortSignal): Promise<AdminAppRoleRow[]> {
  if (systemPermissionsDataSource === 'mock') {
    return usePermissionStore
      .getState()
      .admins.map(mapAssignmentToRow)
      .filter((row) => row.appRole !== 'learner');
  }

  if (!supabaseClient) {
    throw new Error('Supabase client not configured');
  }

  const { data, error } = await supabaseClient.rpc('get_admin_users', {
    search: null,
    sort: 'name',
    page: 1,
    page_size: 500
  });

  if (signal?.aborted) {
    throw new DOMException('Request aborted', 'AbortError');
  }
  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as AdminUserRpcRow[])
    .map(mapRpcRow)
    .filter((row) => row.appRole !== 'learner');
}

async function changeAdminAppRole(payload: ChangeAdminAppRolePayload): Promise<void> {
  if (systemPermissionsDataSource === 'mock') {
    usePermissionStore.getState().setAdminAppRole({
      adminId: payload.targetUserId,
      appRole: payload.newAppRole,
      role: appRoleToMockRole(payload.newAppRole),
      reason: payload.reason,
      changedBy: 'mock_platform_admin'
    });
    return;
  }

  if (!supabaseClient) {
    throw new Error('Supabase client not configured');
  }

  const { error } = await supabaseClient.rpc('admin_set_admin_app_role', {
    p_target_user_id: payload.targetUserId,
    p_new_app_role: payload.newAppRole,
    p_reason: payload.reason
  });

  if (error) {
    throw new Error(error.message);
  }
}

export function fetchAdminAppRolesSafe(signal?: AbortSignal) {
  return toSafeResult(() => withRetry(() => loadAdminAppRoles(signal), { maxRetries: 1 }));
}

export function changeAdminAppRoleSafe(payload: ChangeAdminAppRolePayload) {
  return toSafeResult(() => withRetry(() => changeAdminAppRole(payload), { maxRetries: 0 }));
}
