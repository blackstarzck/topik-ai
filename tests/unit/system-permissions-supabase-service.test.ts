import { describe, expect, it } from 'vitest';

import { mapRpcRow, type AdminUserRpcRow } from '../../src/features/system/api/system-permissions-service';
import { permissionKeysForRole } from '../../src/features/auth/model/app-role-mapping';

function rpcRow(overrides: Partial<AdminUserRpcRow> = {}): AdminUserRpcRow {
  return {
    user_id: '00000000-0000-0000-0000-000000000001',
    email: 'admin@example.com',
    display_name: 'Admin Kim',
    nickname: 'kim',
    app_role: 'platform_admin',
    status: 'active',
    last_sign_in_at: '2026-06-17T10:12:13+09:00',
    created_at: '2026-06-01T00:00:00Z',
    ...overrides
  };
}

describe('mapRpcRow (admin_list_admin_app_roles -> AdminAppRoleRow)', () => {
  it('maps a platform_admin row to SUPER_ADMIN with its catalog permission count', () => {
    const row = mapRpcRow(rpcRow());
    expect(row).toMatchObject({
      adminId: '00000000-0000-0000-0000-000000000001',
      email: 'admin@example.com',
      displayName: 'Admin Kim',
      appRole: 'platform_admin',
      roleKey: 'SUPER_ADMIN',
      permissionCount: permissionKeysForRole('SUPER_ADMIN').length,
      status: 'active'
    });
    // datetimes are normalized to 'YYYY-MM-DD HH:MM:SS' (T -> space, sliced to 19)
    expect(row.lastLoginAt).toBe('2026-06-17 10:12:13');
    expect(row.updatedAt).toBe('2026-06-01 00:00:00');
  });

  it('maps content_admin -> CONTENT_MANAGER and org_admin -> READ_ONLY (current temporary mapping)', () => {
    expect(mapRpcRow(rpcRow({ app_role: 'content_admin' })).roleKey).toBe('CONTENT_MANAGER');
    expect(mapRpcRow(rpcRow({ app_role: 'org_admin' })).roleKey).toBe('READ_ONLY');
  });

  it('maps a learner row to no admin RoleKey and zero catalog permissions', () => {
    const row = mapRpcRow(rpcRow({ app_role: 'learner' }));
    expect(row.roleKey).toBeNull();
    expect(row.permissionCount).toBe(0);
  });

  it('falls back through nickname/email/userId when display_name is missing, and tolerates null timestamps', () => {
    const row = mapRpcRow(
      rpcRow({ display_name: null, nickname: 'nick', last_sign_in_at: null, created_at: null })
    );
    expect(row.displayName).toBe('nick');
    expect(row.lastLoginAt).toBe('');
    expect(row.updatedAt).toBe('');

    const noNick = mapRpcRow(rpcRow({ display_name: null, nickname: null, email: 'only@example.com' }));
    expect(noNick.displayName).toBe('only@example.com');
  });
});
