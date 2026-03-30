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
  currentAdminId: string;
  admins: AdminPermissionAssignment[];
  audits: PermissionAuditEvent[];
  setCurrentAdminId: (adminId: string) => void;
  grantPermissions: (payload: GrantPermissionPayload) => PermissionAuditEvent | null;
  updatePermissions: (payload: UpdatePermissionPayload) => PermissionAuditEvent | null;
  revokePermissions: (payload: RevokePermissionPayload) => PermissionAuditEvent | null;
};

function getRole(role: RoleKey) {
  return roleCatalog.find((item) => item.key === role);
}

function formatNow(date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

function normalizePermissionKeys(permissionKeys: string[]): string[] {
  const validKeys = new Set(permissionCatalog.map((item) => item.key));
  return [...new Set(permissionKeys.filter((key) => validKeys.has(key)))].sort();
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
    name: '\ubc15\uc218\ubbfc',
    status: '\ud65c\uc131',
    lastLoginAt: '2026-03-27 09:10:00',
    role: 'SUPER_ADMIN',
    permissions: normalizePermissionKeys(getRole('SUPER_ADMIN')?.defaultPermissions ?? []),
    updatedAt: '2026-03-27 09:10:00',
    updatedBy: 'system_seed'
  },
  {
    adminId: 'admin_kim',
    name: '\uae40\uc11c\uc601',
    status: '\ud65c\uc131',
    lastLoginAt: '2026-03-27 08:42:00',
    role: 'OPS_ADMIN',
    permissions: normalizePermissionKeys(getRole('OPS_ADMIN')?.defaultPermissions ?? []),
    updatedAt: '2026-03-27 08:42:00',
    updatedBy: 'system_seed'
  },
  {
    adminId: 'admin_han',
    name: '\ud55c\uc9c0\uc6b0',
    status: '\ud65c\uc131',
    lastLoginAt: '2026-03-26 16:27:00',
    role: 'CONTENT_MANAGER',
    permissions: normalizePermissionKeys(
      getRole('CONTENT_MANAGER')?.defaultPermissions ?? []
    ),
    updatedAt: '2026-03-26 16:27:00',
    updatedBy: 'system_seed'
  },
  {
    adminId: 'admin_choi',
    name: '\ucd5c\ub2e4\uc740',
    status: '\ud65c\uc131',
    lastLoginAt: '2026-03-26 11:18:00',
    role: 'CS_MANAGER',
    permissions: normalizePermissionKeys(getRole('CS_MANAGER')?.defaultPermissions ?? []),
    updatedAt: '2026-03-26 11:18:00',
    updatedBy: 'system_seed'
  },
  {
    adminId: 'admin_temp',
    name: '\uc784\uc2dc\uacc4\uc815',
    status: '\ube44\ud65c\uc131',
    lastLoginAt: '2026-02-27 18:11:00',
    role: 'READ_ONLY',
    permissions: normalizePermissionKeys(getRole('READ_ONLY')?.defaultPermissions ?? []),
    updatedAt: '2026-02-27 18:11:00',
    updatedBy: 'system_seed'
  }
];

const initialAudits: PermissionAuditEvent[] = [
  {
    id: 'AL-PERM-00001',
    targetType: 'Admin',
    targetId: 'admin_han',
    action: '\uad8c\ud55c \uc218\uc815',
    reason:
      'Assessment \uc911\uc2ec \uc5ed\ud560\uc744 Content \uad00\ub9ac\uc790 \ud15c\ud50c\ub9bf\uc73c\ub85c \uc870\uc815\ud588\uc2b5\ub2c8\ub2e4.',
    changedBy: 'admin_park',
    beforeRole: 'OPS_ADMIN',
    afterRole: 'CONTENT_MANAGER',
    beforePermissions: normalizePermissionKeys(getRole('OPS_ADMIN')?.defaultPermissions ?? []),
    afterPermissions: normalizePermissionKeys(
      getRole('CONTENT_MANAGER')?.defaultPermissions ?? []
    ),
    createdAt: '2026-03-26 16:30:00'
  },
  {
    id: 'AL-PERM-00002',
    targetType: 'Admin',
    targetId: 'admin_kim',
    action: '\uad8c\ud55c \ubd80\uc5ec',
    reason:
      '\uba54\ud0c0\ub370\uc774\ud130 \uad00\ub9ac \ud398\uc774\uc9c0 \uc624\ud508\uc5d0 \ub9de\ucdb0 system.metadata.manage \uad8c\ud55c\uc744 \ucd94\uac00\ud588\uc2b5\ub2c8\ub2e4.',
    changedBy: 'admin_park',
    beforeRole: 'OPS_ADMIN',
    afterRole: 'OPS_ADMIN',
    beforePermissions: normalizePermissionKeys(
      getRole('OPS_ADMIN')?.defaultPermissions.filter(
        (permission) => permission !== 'system.metadata.manage'
      ) ?? []
    ),
    afterPermissions: normalizePermissionKeys(getRole('OPS_ADMIN')?.defaultPermissions ?? []),
    createdAt: '2026-03-27 09:00:00'
  }
];

export const usePermissionStore = create<PermissionStore>((set, get) => ({
  currentAdminId: 'admin_park',
  admins: initialAdmins,
  audits: [...initialAudits].sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
  setCurrentAdminId: (adminId) => {
    if (!get().admins.some((item) => item.adminId === adminId)) {
      return;
    }

    set({ currentAdminId: adminId });
  },
  grantPermissions: (payload) => {
    const target = get().admins.find((item) => item.adminId === payload.adminId);
    if (!target) {
      return null;
    }

    const beforePermissions = normalizePermissionKeys(target.permissions);
    const afterPermissions = normalizePermissionKeys([
      ...beforePermissions,
      ...payload.permissionKeys
    ]);

    if (beforePermissions.join('|') === afterPermissions.join('|')) {
      return null;
    }

    const audit = buildAuditEvent({
      adminId: payload.adminId,
      action: '\uad8c\ud55c \ubd80\uc5ec',
      reason: payload.reason.trim(),
      changedBy: payload.changedBy,
      beforeRole: target.role,
      afterRole: target.role,
      beforePermissions,
      afterPermissions,
      sequence: get().audits.length + 1
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
    const beforePermissions = normalizePermissionKeys(target.permissions);
    const afterRole = payload.role;
    const afterPermissions = normalizePermissionKeys(payload.permissionKeys);

    if (
      beforeRole === afterRole &&
      beforePermissions.join('|') === afterPermissions.join('|')
    ) {
      return null;
    }

    const audit = buildAuditEvent({
      adminId: payload.adminId,
      action: '\uad8c\ud55c \uc218\uc815',
      reason: payload.reason.trim(),
      changedBy: payload.changedBy,
      beforeRole,
      afterRole,
      beforePermissions,
      afterPermissions,
      sequence: get().audits.length + 1
    });

    set((state) => ({
      admins: state.admins.map((item) =>
        item.adminId === payload.adminId
          ? {
              ...item,
              role: afterRole,
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

    const beforePermissions = normalizePermissionKeys(target.permissions);
    const removeSet = new Set(payload.permissionKeys);
    const afterPermissions = beforePermissions.filter((key) => !removeSet.has(key));

    if (beforePermissions.join('|') === afterPermissions.join('|')) {
      return null;
    }

    const audit = buildAuditEvent({
      adminId: payload.adminId,
      action: '\uad8c\ud55c \ud68c\uc218',
      reason: payload.reason.trim(),
      changedBy: payload.changedBy,
      beforeRole: target.role,
      afterRole: target.role,
      beforePermissions,
      afterPermissions,
      sequence: get().audits.length + 1
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
