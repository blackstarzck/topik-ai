import { toSafeResult, withRetry } from '../../../shared/api/safe-request';
import { supabaseClient } from '../../../shared/api/supabase-client';

/**
 * Admin-account management service (관리자 계정 분리 Phase 6).
 *
 * Wraps the topik-ai-owned admin_accounts RPCs and the /api/admin/invite serverless
 * endpoint. Admins are physically separated from v13 profiles; these calls are the
 * write path for creating/managing admin accounts and their fine-grained permissions.
 * Real authorization is enforced server-side (platform_admin-only RPCs + admin_has_permission).
 */

export type AdminAccountRole = 'platform_admin' | 'content_admin' | 'org_admin';
export type AdminAccountStatus = 'invited' | 'active' | 'suspended';

export type AdminAccountDetail = {
  adminId: string;
  email: string;
  displayName: string;
  role: AdminAccountRole;
  status: AdminAccountStatus;
  createdBy: string | null;
  invitedAt: string;
  acceptedAt: string;
  lastLoginAt: string;
  createdAt: string;
  updatedAt: string;
  permissionKeys: string[];
};

type AdminGetAdminRpcRow = {
  admin_id: string;
  email: string | null;
  display_name: string | null;
  role: string;
  status: string;
  created_by: string | null;
  invited_at: string | null;
  accepted_at: string | null;
  last_sign_in_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  permission_keys: string[] | null;
};

function toDateTime(value: string | null | undefined): string {
  return value ? value.replace('T', ' ').slice(0, 19) : '';
}

function requireClient() {
  if (!supabaseClient) {
    throw new Error('Supabase client not configured');
  }
  return supabaseClient;
}

function mapAdminDetail(row: AdminGetAdminRpcRow): AdminAccountDetail {
  return {
    adminId: row.admin_id,
    email: row.email ?? '',
    displayName: row.display_name ?? row.email ?? row.admin_id,
    role: row.role as AdminAccountRole,
    status: row.status as AdminAccountStatus,
    createdBy: row.created_by,
    invitedAt: toDateTime(row.invited_at),
    acceptedAt: toDateTime(row.accepted_at),
    lastLoginAt: toDateTime(row.last_sign_in_at),
    createdAt: toDateTime(row.created_at),
    updatedAt: toDateTime(row.updated_at),
    permissionKeys: row.permission_keys ?? []
  };
}

async function fetchAdminDetail(adminId: string): Promise<AdminAccountDetail | null> {
  const client = requireClient();
  const { data, error } = await client.rpc('admin_get_admin', { p_admin_id: adminId });
  if (error) {
    throw new Error(error.message);
  }
  const row = (Array.isArray(data) ? data[0] : data) as AdminGetAdminRpcRow | undefined;
  return row ? mapAdminDetail(row) : null;
}

async function setAdminRole(adminId: string, role: AdminAccountRole, reason: string): Promise<void> {
  const client = requireClient();
  const { error } = await client.rpc('admin_set_admin_role', {
    p_admin_id: adminId,
    p_new_role: role,
    p_reason: reason
  });
  if (error) {
    throw new Error(error.message);
  }
}

async function setAdminStatus(
  adminId: string,
  status: Exclude<AdminAccountStatus, 'invited'>,
  reason: string
): Promise<void> {
  const client = requireClient();
  const { error } = await client.rpc('admin_set_admin_status', {
    p_admin_id: adminId,
    p_status: status,
    p_reason: reason
  });
  if (error) {
    throw new Error(error.message);
  }
}

async function grantPermissions(adminId: string, keys: string[], reason: string): Promise<number> {
  const client = requireClient();
  const { data, error } = await client.rpc('admin_grant_permissions', {
    p_admin_id: adminId,
    p_keys: keys,
    p_reason: reason
  });
  if (error) {
    throw new Error(error.message);
  }
  return Number(data ?? 0);
}

async function revokePermissions(adminId: string, keys: string[], reason: string): Promise<number> {
  const client = requireClient();
  const { data, error } = await client.rpc('admin_revoke_permissions', {
    p_admin_id: adminId,
    p_keys: keys,
    p_reason: reason
  });
  if (error) {
    throw new Error(error.message);
  }
  return Number(data ?? 0);
}

export type InviteAdminPayload = {
  email: string;
  role: AdminAccountRole;
  permissionKeys: string[];
};

async function inviteAdmin(payload: InviteAdminPayload): Promise<string> {
  const client = requireClient();
  const { data: sessionData } = await client.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) {
    throw new Error('세션이 만료되었습니다. 다시 로그인하세요.');
  }

  const response = await fetch('/api/admin/invite', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: payload.email,
      role: payload.role,
      permission_keys: payload.permissionKeys
    })
  });

  let body: { ok?: boolean; invited_user_id?: string; error?: string } = {};
  try {
    body = (await response.json()) as typeof body;
  } catch {
    throw new Error(`초대 응답을 해석하지 못했습니다 (HTTP ${response.status}).`);
  }
  if (!response.ok || !body.ok || !body.invited_user_id) {
    throw new Error(body.error ?? `초대에 실패했습니다 (HTTP ${response.status}).`);
  }
  return body.invited_user_id;
}

// Safe wrappers (mirror the existing system-* service convention).
export function fetchAdminDetailSafe(adminId: string) {
  return toSafeResult(() => withRetry(() => fetchAdminDetail(adminId), { maxRetries: 1 }));
}

export function setAdminRoleSafe(adminId: string, role: AdminAccountRole, reason: string) {
  return toSafeResult(() => withRetry(() => setAdminRole(adminId, role, reason), { maxRetries: 0 }));
}

export function setAdminStatusSafe(
  adminId: string,
  status: Exclude<AdminAccountStatus, 'invited'>,
  reason: string
) {
  return toSafeResult(() => withRetry(() => setAdminStatus(adminId, status, reason), { maxRetries: 0 }));
}

export function grantPermissionsSafe(adminId: string, keys: string[], reason: string) {
  return toSafeResult(() => withRetry(() => grantPermissions(adminId, keys, reason), { maxRetries: 0 }));
}

export function revokePermissionsSafe(adminId: string, keys: string[], reason: string) {
  return toSafeResult(() => withRetry(() => revokePermissions(adminId, keys, reason), { maxRetries: 0 }));
}

export function inviteAdminSafe(payload: InviteAdminPayload) {
  return toSafeResult(() => withRetry(() => inviteAdmin(payload), { maxRetries: 0 }));
}
