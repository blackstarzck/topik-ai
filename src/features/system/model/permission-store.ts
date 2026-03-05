import { create } from 'zustand';

import type {
  AdminPermissionAssignment,
  PermissionAuditEvent,
  RoleKey
} from './permission-types';
import { permissionCatalog, roleCatalog } from './permission-types';

type GrantPermissionPayload = {
  adminId: string;
  permissionKeys: string[];
  reason: string;
  changedBy: string;
};

type UpdatePermissionPayload = {
  adminId: string;
  role: RoleKey;
  permissionKeys: string[];
  reason: string;
  changedBy: string;
};

type RevokePermissionPayload = {
  adminId: string;
  permissionKeys: string[];
  reason: string;
  changedBy: string;
};

type PermissionStore = {
  admins: AdminPermissionAssignment[];
  audits: PermissionAuditEvent[];
  grantPermissions: (
    payload: GrantPermissionPayload
  ) => PermissionAuditEvent | null;
  updatePermissions: (
    payload: UpdatePermissionPayload
  ) => PermissionAuditEvent | null;
  revokePermissions: (
    payload: RevokePermissionPayload
  ) => PermissionAuditEvent | null;
};

function getRole(role: RoleKey) {
  return roleCatalog.find((item) => item.key === role);
}

function formatNow(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const mi = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');

  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

function normalizePermissionKeys(permissionKeys: string[]): string[] {
  const valid = new Set(permissionCatalog.map((item) => item.key));
  return [...new Set(permissionKeys.filter((key) => valid.has(key)))].sort();
}

function buildAuditEvent(params: {
  adminId: string;
  action: PermissionAuditEvent['action'];
  reason: string;
  changedBy: string;
  beforeRole: RoleKey;
  afterRole: RoleKey;
  beforePermissions: string[];
  afterPermissions: string[];
  sequence: number;
}): PermissionAuditEvent {
  const createdAt = formatNow();
  return {
    id: `AL-PERM-${String(params.sequence).padStart(5, '0')}`,
    targetType: 'Admin',
    targetId: params.adminId,
    action: params.action,
    reason: params.reason,
    changedBy: params.changedBy,
    beforeRole: params.beforeRole,
    afterRole: params.afterRole,
    beforePermissions: params.beforePermissions,
    afterPermissions: params.afterPermissions,
    createdAt
  };
}

const initialAdmins: AdminPermissionAssignment[] = [
  {
    adminId: 'admin_park',
    name: '박지민',
    status: '활성',
    lastLoginAt: '2026-03-04 10:20',
    role: 'SUPER_ADMIN',
    permissions: normalizePermissionKeys(
      getRole('SUPER_ADMIN')?.defaultPermissions ?? []
    ),
    updatedAt: '2026-03-04 10:20:00',
    updatedBy: 'system_seed'
  },
  {
    adminId: 'admin_kim',
    name: '김나영',
    status: '활성',
    lastLoginAt: '2026-03-04 09:42',
    role: 'OPS_ADMIN',
    permissions: normalizePermissionKeys(getRole('OPS_ADMIN')?.defaultPermissions ?? []),
    updatedAt: '2026-03-04 09:42:00',
    updatedBy: 'system_seed'
  },
  {
    adminId: 'admin_choi',
    name: '최민수',
    status: '활성',
    lastLoginAt: '2026-03-03 18:11',
    role: 'CS_MANAGER',
    permissions: normalizePermissionKeys(
      getRole('CS_MANAGER')?.defaultPermissions ?? []
    ),
    updatedAt: '2026-03-03 18:11:00',
    updatedBy: 'system_seed'
  },
  {
    adminId: 'admin_temp',
    name: '임시계정',
    status: '비활성',
    lastLoginAt: '2026-02-27 18:11',
    role: 'READ_ONLY',
    permissions: normalizePermissionKeys(
      getRole('READ_ONLY')?.defaultPermissions ?? []
    ),
    updatedAt: '2026-02-27 18:11:00',
    updatedBy: 'system_seed'
  }
];

const initialAudits: PermissionAuditEvent[] = [
  {
    id: 'AL-PERM-00001',
    targetType: 'Admin',
    targetId: 'admin_kim',
    action: '권한 수정',
    reason: '운영 권한 범위 조정',
    changedBy: 'admin_park',
    beforeRole: 'CS_MANAGER',
    afterRole: 'OPS_ADMIN',
    beforePermissions: normalizePermissionKeys(
      getRole('CS_MANAGER')?.defaultPermissions ?? []
    ),
    afterPermissions: normalizePermissionKeys(
      getRole('OPS_ADMIN')?.defaultPermissions ?? []
    ),
    createdAt: '2026-03-03 15:30:00'
  }
];

export const usePermissionStore = create<PermissionStore>((set, get) => ({
  admins: initialAdmins,
  audits: initialAudits,
  grantPermissions: (payload) => {
    const target = get().admins.find((item) => item.adminId === payload.adminId);
    if (!target) {
      return null;
    }

    const beforePermissions = target.permissions;
    const afterPermissions = normalizePermissionKeys([
      ...beforePermissions,
      ...payload.permissionKeys
    ]);

    if (beforePermissions.join('|') === afterPermissions.join('|')) {
      return null;
    }

    const beforeRole = target.role;
    const afterRole = target.role;
    const nextSequence = get().audits.length + 1;
    const audit = buildAuditEvent({
      adminId: payload.adminId,
      action: '권한 부여',
      reason: payload.reason,
      changedBy: payload.changedBy,
      beforeRole,
      afterRole,
      beforePermissions,
      afterPermissions,
      sequence: nextSequence
    });

    set((state) => ({
      admins: state.admins.map((item) =>
        item.adminId === payload.adminId
          ? {
              ...item,
              permissions: afterPermissions,
              updatedAt: audit.createdAt,
              updatedBy: payload.changedBy
            }
          : item
      ),
      audits: [audit, ...state.audits]
    }));

    return audit;
  },
  updatePermissions: (payload) => {
    const target = get().admins.find((item) => item.adminId === payload.adminId);
    if (!target) {
      return null;
    }

    const beforeRole = target.role;
    const beforePermissions = target.permissions;
    const afterRole = payload.role;
    const afterPermissions = normalizePermissionKeys(payload.permissionKeys);

    const unchanged =
      beforeRole === afterRole &&
      beforePermissions.join('|') === afterPermissions.join('|');

    if (unchanged) {
      return null;
    }

    const nextSequence = get().audits.length + 1;
    const audit = buildAuditEvent({
      adminId: payload.adminId,
      action: '권한 수정',
      reason: payload.reason,
      changedBy: payload.changedBy,
      beforeRole,
      afterRole,
      beforePermissions,
      afterPermissions,
      sequence: nextSequence
    });

    set((state) => ({
      admins: state.admins.map((item) =>
        item.adminId === payload.adminId
          ? {
              ...item,
              role: payload.role,
              permissions: afterPermissions,
              updatedAt: audit.createdAt,
              updatedBy: payload.changedBy
            }
          : item
      ),
      audits: [audit, ...state.audits]
    }));

    return audit;
  },
  revokePermissions: (payload) => {
    const target = get().admins.find((item) => item.adminId === payload.adminId);
    if (!target) {
      return null;
    }

    const beforeRole = target.role;
    const beforePermissions = target.permissions;
    const removeSet = new Set(payload.permissionKeys);
    const afterPermissions = beforePermissions.filter((key) => !removeSet.has(key));

    if (beforePermissions.join('|') === afterPermissions.join('|')) {
      return null;
    }

    const nextSequence = get().audits.length + 1;
    const audit = buildAuditEvent({
      adminId: payload.adminId,
      action: '권한 회수',
      reason: payload.reason,
      changedBy: payload.changedBy,
      beforeRole,
      afterRole: beforeRole,
      beforePermissions,
      afterPermissions,
      sequence: nextSequence
    });

    set((state) => ({
      admins: state.admins.map((item) =>
        item.adminId === payload.adminId
          ? {
              ...item,
              permissions: afterPermissions,
              updatedAt: audit.createdAt,
              updatedBy: payload.changedBy
            }
          : item
      ),
      audits: [audit, ...state.audits]
    }));

    return audit;
  }
}));
