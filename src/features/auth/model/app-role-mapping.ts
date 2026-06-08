import type { RoleKey } from '../../system/model/permission-types';
import { roleCatalog } from '../../system/model/permission-types';
import type { V13AppRole } from './session-types';

/**
 * v13 app_role -> topik-ai RoleKey (D-A, decided 2026-06-08). PROPOSED ONLY.
 *
 * v13 keeps its 4 app_roles; topik-ai has 5 permission-bundle RoleKeys. Overlap-
 * minimum mapping: platform_admin = full, content_admin = assessment/content.
 * org_admin has no clean topik-ai counterpart -> conservative READ_ONLY for now.
 * learner is not an admin -> no access (null). Real authorization is enforced by
 * v13 RLS/RPC, not by this client-side bundle (the bundle only drives menu/UI).
 */
const APP_ROLE_TO_ROLE_KEY: Record<V13AppRole, RoleKey | null> = {
  platform_admin: 'SUPER_ADMIN',
  content_admin: 'CONTENT_MANAGER',
  org_admin: 'READ_ONLY',
  learner: null
};

export function mapAppRoleToRoleKey(appRole: V13AppRole): RoleKey | null {
  return APP_ROLE_TO_ROLE_KEY[appRole] ?? null;
}

export function permissionKeysForRole(roleKey: RoleKey): string[] {
  return roleCatalog.find((role) => role.key === roleKey)?.defaultPermissions ?? [];
}
