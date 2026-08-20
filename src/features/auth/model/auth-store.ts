import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';

import { isSupabaseConfigured, supabaseClient } from '@/shared/api/supabase-client';
import { usePermissionStore } from '@/features/system/model/permission-store';
import type { AdminPermissionAssignment } from '@/features/system/model/permission-types';
import { mapAppRoleToRoleKey, permissionKeysForRole } from './app-role-mapping';
import type { AdminSession, AuthStatus, V13AppRole } from './session-types';

type AuthStore = {
  status: AuthStatus;
  session: AdminSession | null;
  error: string | null;
  signingIn: boolean;
  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

type SetAuthState = (partial: Partial<AuthStore>) => void;

let authSubscribed = false;

function formatTimestamp(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/**
 * Mirror the resolved session into the existing permission store so the admin shell's
 * menu gating reflects the real role without any change to admin-shell. When the
 * session is null we just hand currentAdminId back to a seeded admin (mock fallback).
 */
function applySessionToPermissionStore(session: AdminSession | null): void {
  const { setSessionAdmin } = usePermissionStore.getState();
  if (!session) {
    setSessionAdmin(null);
    return;
  }

  const stamp = formatTimestamp();
  const assignment: AdminPermissionAssignment = {
    adminId: session.userId,
    name: session.displayName,
    status: '활성',
    lastLoginAt: stamp,
    role: session.roleKey,
    permissions: session.permissionKeys,
    updatedAt: stamp,
    updatedBy: 'auth_session'
  };
  setSessionAdmin(assignment);
}

async function resolveSession(supaSession: Session | null, set: SetAuthState): Promise<void> {
  if (!supaSession || !supabaseClient) {
    applySessionToPermissionStore(null);
    set({ status: 'unauthenticated', session: null });
    return;
  }

  const userId = supaSession.user.id;
  const email = supaSession.user.email ?? null;

  // Admin identity is physically separated from v13's profiles: admins have no
  // profiles row. admin_get_self() reads public.admin_accounts (+ granted permission
  // keys) and auto-accepts a pending invite. No row → caller is not an active admin.
  const { data, error } = await supabaseClient.rpc('admin_get_self');

  if (error) {
    applySessionToPermissionStore(null);
    set({ status: 'unauthorized', session: null, error: '관리자 정보를 불러오지 못했습니다.' });
    return;
  }

  const row = (Array.isArray(data) ? data[0] : data) as
    | { role: string; status: string; display_name: string | null; email: string | null; permission_keys: string[] | null }
    | undefined;

  const appRole = (row?.role ?? null) as V13AppRole | null;
  const roleKey = appRole ? mapAppRoleToRoleKey(appRole) : null;
  if (!row || !appRole || !roleKey) {
    applySessionToPermissionStore(null);
    set({ status: 'unauthorized', session: null });
    return;
  }

  // platform_admin (super) holds every permission → expand to the full catalog;
  // every other admin's effective permissions are exactly their DB grants.
  const permissionKeys =
    appRole === 'platform_admin' ? permissionKeysForRole('SUPER_ADMIN') : row.permission_keys ?? [];

  const session: AdminSession = {
    userId,
    email: row.email ?? email,
    displayName: row.display_name ?? email ?? userId,
    appRole,
    roleKey,
    permissionKeys
  };

  applySessionToPermissionStore(session);
  set({ status: 'authenticated', session, error: null });
}

export const useAuthStore = create<AuthStore>((set) => ({
  // When Supabase is not configured, start in 'mock' so AuthGate is a zero-flash
  // pass-through and the frozen app's behaviour is byte-for-byte unchanged.
  status: isSupabaseConfigured ? 'initializing' : 'mock',
  session: null,
  error: null,
  signingIn: false,

  initialize: async () => {
    if (!isSupabaseConfigured || !supabaseClient) {
      set({ status: 'mock', session: null, error: null });
      return;
    }

    if (!authSubscribed) {
      authSubscribed = true;
      supabaseClient.auth.onAuthStateChange((_event, supaSession) => {
        void resolveSession(supaSession, set);
      });
    }

    const { data } = await supabaseClient.auth.getSession();
    await resolveSession(data.session, set);
  },

  signIn: async (email, password) => {
    if (!supabaseClient) {
      return;
    }
    set({ signingIn: true, error: null });
    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) {
      set({ signingIn: false, error: '로그인에 실패했습니다. 이메일과 비밀번호를 확인하세요.' });
      return;
    }
    set({ signingIn: false });
    // onAuthStateChange resolves the session + profile.
  },

  signOut: async () => {
    if (!supabaseClient) {
      return;
    }
    await supabaseClient.auth.signOut();
    applySessionToPermissionStore(null);
    set({ status: 'unauthenticated', session: null, error: null });
  }
}));
