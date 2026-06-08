import { supabaseClient } from '../../../shared/api/supabase-client';
import type { SubscriptionStatus, UserStatus, UserSummary, UserTier } from '../model/types';

/**
 * Phase B (members) — read/write the v13 members directory via admin RPCs.
 *
 * Reads: get_admin_users (platform_admin, SECURITY DEFINER, joins auth.users.email
 * + last_sign_in_at). Writes: admin_set_user_status (active|blocked only, audited).
 * All mappings are PROPOSED (R2) until topik-ai internal codes are ratified.
 */

type AdminUserRow = {
  user_id: string;
  email: string | null;
  display_name: string | null;
  app_role: string;
  plan_label: string | null;
  status: string;
  submission_count: number;
  last_activity: string | null;
  last_sign_in_at: string | null;
  created_at: string;
  total_count: number;
};

// v13 profiles.status -> topik-ai UserStatus
const STATUS_MAP: Record<string, UserStatus> = {
  active: '정상',
  blocked: '정지',
  deleted: '탈퇴'
};

function mapStatus(v13Status: string): UserStatus {
  return STATUS_MAP[v13Status] ?? '정상';
}

// v13 plan_label (free text) -> topik-ai UserTier. PROPOSED (F5): free/basic -> 일반, else 프리미엄.
function mapTier(planLabel: string | null): UserTier {
  const label = (planLabel ?? '').trim().toLowerCase();
  if (label === '' || label === 'free' || label === 'basic' || label === '일반') {
    return '일반';
  }
  return '프리미엄';
}

function toDateString(ts: string | null): string {
  return ts ? ts.slice(0, 10) : '';
}

function mapRowToUserSummary(row: AdminUserRow): UserSummary {
  const tier = mapTier(row.plan_label);
  const subscriptionStatus: SubscriptionStatus = tier === '프리미엄' ? '구독' : '미구독';
  return {
    id: row.user_id,
    realName: row.display_name ?? row.email ?? row.user_id,
    email: row.email ?? '',
    // GAP: get_admin_users does NOT return profiles.nickname (would need an additive RPC change).
    // Fallback to display_name / email local-part so the column is not empty.
    nickname: row.display_name ?? (row.email ? row.email.split('@')[0] : row.user_id),
    joinedAt: toDateString(row.created_at),
    lastLoginAt: toDateString(row.last_sign_in_at),
    status: mapStatus(row.status),
    tier,
    // GAP: no subscription join in the RPC. PROPOSED heuristic from plan tier — NOT real
    // subscription state (would need a subscriptions join / additive RPC).
    subscriptionStatus
  };
}

export async function loadUsersFromSupabase(signal?: AbortSignal): Promise<UserSummary[]> {
  if (!supabaseClient) {
    throw new Error('Supabase client not configured');
  }
  // Dev: a single page of up to 100 covers the dev dataset. Prod (>100 users) needs
  // server-side pagination (follow-up — the page currently filters client-side).
  const { data, error } = await supabaseClient.rpc('get_admin_users', {
    search: null,
    sort: 'activity',
    page: 1,
    page_size: 100
  });
  if (signal?.aborted) {
    throw new DOMException('Request aborted', 'AbortError');
  }
  if (error) {
    throw new Error(error.message);
  }
  return ((data ?? []) as AdminUserRow[]).map(mapRowToUserSummary);
}

/**
 * Phase B write seam — suspend/unsuspend via the audited RPC. withdraw (탈퇴) is NOT
 * supported: the server rejects 'deleted' and we hard-block it here too (D-F).
 */
export async function setUserStatusViaRpc(userId: string, nextStatus: UserStatus): Promise<void> {
  if (!supabaseClient) {
    throw new Error('Supabase client not configured');
  }
  if (nextStatus === '탈퇴') {
    throw new Error('탈퇴(withdraw) 쓰기는 의미 확정 전까지 차단됩니다 (D-F).');
  }
  const v13Status = nextStatus === '정지' ? 'blocked' : 'active';
  const { error } = await supabaseClient.rpc('admin_set_user_status', {
    target_id: userId,
    new_status: v13Status
  });
  if (error) {
    throw new Error(error.message);
  }
}
