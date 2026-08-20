import type { SafeResult } from '@/shared/api/safe-request';
import { toSafeResult, withRetry } from '@/shared/api/safe-request';
import { supabaseClient } from '@/shared/api/supabase-client';
import { mapAppRoleToRoleKey, permissionKeysForRole } from '@/features/auth/model/app-role-mapping';
import type { V13AppRole } from '@/features/auth/model/session-types';
import { usePermissionStore } from '../model/permission-store';
import type { AdminPermissionAssignment } from '../model/permission-types';
import { systemAdminsDataSource } from './system-admins-data-source';
import { toDateTimeSeconds as toDateTime } from '@/shared/model/date-format';

export type AdminListRpcRow = {
  user_id: string;
  email: string | null;
  display_name: string | null;
  nickname: string | null;
  app_role: string | null;
  status: string | null;
  last_sign_in_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type AdminStatus = AdminPermissionAssignment['status'];

function mapAdminStatus(status: string | null): AdminStatus {
  if (status === 'active') {
    return '활성';
  }
  // admin_accounts statuses: invited (not yet accepted) and suspended both map to the
  // inactive badge on the list; the permissions page shows the precise label.
  if (status === 'invited' || status === 'suspended' || status === 'blocked') {
    return '비활성';
  }
  if (status === 'deleted') {
    return '탈퇴';
  }

  return (status ?? '') as AdminStatus;
}

export function mapAdminRow(row: AdminListRpcRow): AdminPermissionAssignment {
  const role = mapAppRoleToRoleKey(row.app_role as V13AppRole) ?? 'READ_ONLY';

  return {
    adminId: row.user_id,
    name: row.display_name ?? row.nickname ?? row.email ?? row.user_id,
    role,
    permissions: permissionKeysForRole(role),
    status: mapAdminStatus(row.status),
    lastLoginAt: toDateTime(row.last_sign_in_at),
    updatedAt: toDateTime(row.updated_at),
    updatedBy: ''
  };
}

async function loadSystemAdmins(signal?: AbortSignal): Promise<AdminPermissionAssignment[]> {
  if (systemAdminsDataSource === 'mock') {
    return usePermissionStore.getState().admins;
  }

  if (!supabaseClient) {
    throw new Error('Supabase client not configured');
  }

  const { data, error } = await supabaseClient.rpc('admin_list_admins', {
    p_search: null
  });

  if (signal?.aborted) {
    throw new DOMException('Request aborted', 'AbortError');
  }
  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as AdminListRpcRow[]).map(mapAdminRow);
}

/**
 * 다른 safe facade 와 같은 `SafeResult` 를 돌려준다.
 *
 * 이전에는 내부에서 계산한 `SafeResult` 를 `{ ok, data, error: string }` 으로 낮춰
 * 반환해서 호출부가 `AppApiError` 의 code 를 볼 수 없었고, 공용 수명주기 훅
 * (`useAsyncResource`)도 그대로 쓸 수 없었다(gap-register §3.13 ⑧).
 * 표시 문구는 이전과 같다 — 호출부가 `error.message` 를 쓴다.
 */
export async function fetchSystemAdminsSafe(
  signal?: AbortSignal
): Promise<SafeResult<AdminPermissionAssignment[]>> {
  return toSafeResult(() => withRetry(() => loadSystemAdmins(signal), { maxRetries: 1 }));
}
