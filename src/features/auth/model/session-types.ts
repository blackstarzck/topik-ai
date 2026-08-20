import type { RoleKey } from '@/features/system/model/permission-types';

/** v13 profiles.app_role enum (4 roles). SoT: v13 src/lib/auth/roles.ts. */
export type V13AppRole = 'learner' | 'content_admin' | 'org_admin' | 'platform_admin';

export type AuthStatus =
  | 'initializing'
  | 'authenticated'
  | 'unauthenticated'
  | 'unauthorized'
  | 'mock';

/** Resolved admin session derived from a Supabase auth session + the v13 profile. */
export type AdminSession = {
  userId: string;
  email: string | null;
  displayName: string;
  appRole: V13AppRole;
  roleKey: RoleKey;
  permissionKeys: string[];
};
