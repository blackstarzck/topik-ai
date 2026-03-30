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
    name: '박수민',
    status: '활성',
    lastLoginAt: '2026-03-27 09:10:00',
    role: 'SUPER_ADMIN',
    permissions: normalizePermissionKeys(getRole('SUPER_ADMIN')?.defaultPermissions ?? []),
    updatedAt: '2026-03-27 09:10:00',
    updatedBy: 'system_seed'
  },
  {
    adminId: 'admin_kim',
    name: '김서영',
    status: '활성',
    lastLoginAt: '2026-03-27 08:42:00',
    role: 'OPS_ADMIN',
    permissions: normalizePermissionKeys(getRole('OPS_ADMIN')?.defaultPermissions ?? []),
    updatedAt: '2026-03-27 08:42:00',
    updatedBy: 'system_seed'
  },
  {
    adminId: 'admin_han',
    name: '한지우',
    status: '활성',
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
    name: '최다은',
    status: '활성',
    lastLoginAt: '2026-03-26 11:18:00',
    role: 'CS_MANAGER',
    permissions: normalizePermissionKeys(getRole('CS_MANAGER')?.defaultPermissions ?? []),
    updatedAt: '2026-03-26 11:18:00',
    updatedBy: 'system_seed'
  },
  {
    adminId: 'admin_temp',
    name: '임시계정',
    status: '비활성',
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
    action: '권한 수정',
    reason:
      'Assessment 중심 역할을 Content 관리자 템플릿으로 조정했습니다.',
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
    action: '권한 부여',
    reason:
      '메타데이터 관리 페이지 오픈에 맞춰 system.metadata.manage 권한을 추가했습니다.',
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
      action: '권한 부여',
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
      action: '권한 수정',
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
      action: '권한 회수',
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
