import { supabaseClient } from '../../../shared/api/supabase-client';
import type {
  UserLearningOverview,
  SubscriptionStatus,
  TermsConsentStatus,
  UserStatus,
  UserSummary,
  UserTier
} from '../model/types';

/**
 * Phase B (members) — read/write the v13 members directory via admin RPCs.
 *
 * Reads: get_admin_users (platform_admin, SECURITY DEFINER, joins auth.users.email,
 * profiles.display_name/nickname + last_sign_in_at). Writes: admin_set_user_status
 * (active|blocked only, audited).
 * All mappings are PROPOSED (R2) until topik-ai internal codes are ratified.
 */

type AdminUserRow = {
  user_id: string;
  email: string | null;
  display_name: string | null;
  nickname?: string | null;
  app_role: string;
  plan_label: string | null;
  status: string;
  nationality_country_code: string | null;
  submission_count: number;
  last_activity: string | null;
  last_sign_in_at: string | null;
  created_at: string;
  // 약관 동의(인증약관) 집계: legal_documents(requires_consent) ⋈ user_consents.
  consent_status: string;
  consent_accepted_at: string | null;
  total_count: number;
};

type ProfileNicknameRow = {
  id: string;
  nickname: string | null;
};

type AdminUserLearningOverviewRow = {
  kpis: UserLearningOverview['kpis'];
  domain_accuracy: UserLearningOverview['domainAccuracy'];
  weaknesses: UserLearningOverview['weaknesses'];
  recent_attempts: UserLearningOverview['recentAttempts'];
  recent_writing: UserLearningOverview['recentWriting'];
};

type UserCommunityPostRow = {
  id: string;
  title: string;
  board: string;
  status: string;
  reports_count: number;
  created_at: string | null;
};

type UserAdminMemoRow = {
  id: string;
  admin_name: string;
  content: string;
  created_at: string | null;
};

export type UserCommunityPost = {
  id: string;
  title: string;
  board: string;
  createdAt: string;
  reports: number;
  status: string;
};

export type UserAdminMemo = {
  id: string;
  admin: string;
  content: string;
  createdAt: string;
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

// v13 consent_status (RPC: consented/partial/none) -> topik-ai TermsConsentStatus.
const CONSENT_STATUS_MAP: Record<string, TermsConsentStatus> = {
  consented: '동의 완료',
  partial: '일부 동의',
  none: '미동의'
};

function mapConsentStatus(consentStatus: string): TermsConsentStatus {
  return CONSENT_STATUS_MAP[consentStatus] ?? '미동의';
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

function mapCommunityStatus(status: string): string {
  if (status === 'published') {
    return '게시';
  }
  if (status === 'hidden') {
    return '숨김';
  }
  return status;
}

function nonEmpty(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function mapRowToUserSummary(row: AdminUserRow): UserSummary {
  const tier = mapTier(row.plan_label);
  const subscriptionStatus: SubscriptionStatus = tier === '프리미엄' ? '구독' : '미구독';
  const displayName = nonEmpty(row.display_name);
  const nickname = nonEmpty(row.nickname);
  return {
    id: row.user_id,
    realName: displayName ?? '',
    email: row.email ?? '',
    // Preserve profiles.nickname exactly. Null/empty values are rendered as an
    // empty-state marker in the UI, not replaced with display_name/email fallbacks.
    nickname: nickname ?? '',
    joinedAt: toDateString(row.created_at),
    lastLoginAt: toDateString(row.last_sign_in_at),
    status: mapStatus(row.status),
    tier,
    // GAP: no subscription join in the RPC. PROPOSED heuristic from plan tier — NOT real
    // subscription state (would need a subscriptions join / additive RPC).
    subscriptionStatus,
    // 국적 코드 원본 보존(NULL/빈 값은 빈 문자열). 국가명 변환은 UI 렌더 시 수행.
    nationalityCode: nonEmpty(row.nationality_country_code) ?? '',
    // 약관 동의(인증약관) 상태와 최종 동의일. 동의 기록이 없으면 날짜는 빈 문자열.
    termsConsentStatus: mapConsentStatus(row.consent_status),
    termsConsentAt: toDateString(row.consent_accepted_at)
  };
}

async function loadProfileNicknameMap(userIds: string[]): Promise<Map<string, string | null>> {
  if (!supabaseClient || userIds.length === 0) {
    return new Map();
  }

  const { data, error } = await supabaseClient
    .from('profiles')
    .select('id,nickname')
    .in('id', userIds);

  if (error) {
    return new Map();
  }

  return new Map(
    ((data ?? []) as ProfileNicknameRow[]).map((profile) => [
      profile.id,
      nonEmpty(profile.nickname)
    ])
  );
}

function mergeProfileNicknames(
  rows: AdminUserRow[],
  profileNicknameMap: Map<string, string | null>
): AdminUserRow[] {
  if (profileNicknameMap.size === 0) {
    return rows;
  }

  return rows.map((row) => ({
    ...row,
    nickname: nonEmpty(row.nickname) ?? profileNicknameMap.get(row.user_id) ?? null
  }));
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
  const rows = (data ?? []) as AdminUserRow[];
  const profileNicknameMap = await loadProfileNicknameMap(rows.map((row) => row.user_id));
  if (signal?.aborted) {
    throw new DOMException('Request aborted', 'AbortError');
  }
  return mergeProfileNicknames(rows, profileNicknameMap).map(mapRowToUserSummary);
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

export async function loadUserLearningOverviewFromSupabase(
  userId: string,
  signal?: AbortSignal
): Promise<UserLearningOverview> {
  if (!supabaseClient) {
    throw new Error('Supabase client not configured');
  }

  const { data, error } = await supabaseClient.rpc('get_admin_user_learning_overview', {
    target_id: userId
  });
  if (signal?.aborted) {
    throw new DOMException('Request aborted', 'AbortError');
  }
  if (error) {
    throw new Error(error.message);
  }

  const row = (Array.isArray(data) ? data[0] : data) as AdminUserLearningOverviewRow | null;
  return {
    kpis: row?.kpis ?? {
      totalAttempts: 0,
      solvedProblems: 0,
      correctRate: null,
      averageScore: null,
      totalStudyMinutes: 0,
      bookmarkedCount: 0,
      writingSubmissionCount: 0,
      writingFeedbackCount: 0,
      latestActivityAt: ''
    },
    domainAccuracy: row?.domain_accuracy ?? [],
    weaknesses: row?.weaknesses ?? [],
    recentAttempts: row?.recent_attempts ?? [],
    recentWriting: row?.recent_writing ?? []
  };
}

export async function getUserCommunityPostsFromSupabase(
  userId: string,
  signal?: AbortSignal
): Promise<UserCommunityPost[]> {
  if (!supabaseClient) {
    throw new Error('Supabase client not configured');
  }

  const { data, error } = await supabaseClient.rpc('admin_get_user_community_posts', {
    p_target_user_id: userId,
    p_limit: 100
  });
  if (signal?.aborted) {
    throw new DOMException('Request aborted', 'AbortError');
  }
  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as UserCommunityPostRow[]).map((row) => ({
    id: row.id,
    title: row.title,
    board: row.board,
    createdAt: toDateString(row.created_at),
    reports: row.reports_count,
    status: mapCommunityStatus(row.status)
  }));
}

export async function getUserMemosFromSupabase(
  userId: string,
  signal?: AbortSignal
): Promise<UserAdminMemo[]> {
  if (!supabaseClient) {
    throw new Error('Supabase client not configured');
  }

  const { data, error } = await supabaseClient.rpc('admin_list_user_memos', {
    p_user_id: userId
  });
  if (signal?.aborted) {
    throw new DOMException('Request aborted', 'AbortError');
  }
  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as UserAdminMemoRow[]).map((row) => ({
    id: row.id,
    admin: row.admin_name,
    content: row.content,
    createdAt: toDateString(row.created_at)
  }));
}

export async function addUserMemoViaRpc(
  userId: string,
  content: string,
  reason: string,
  signal?: AbortSignal
): Promise<string> {
  if (!supabaseClient) {
    throw new Error('Supabase client not configured');
  }

  const { data, error } = await supabaseClient.rpc('admin_add_user_memo', {
    p_user_id: userId,
    p_content: content,
    p_reason: reason
  });
  if (signal?.aborted) {
    throw new DOMException('Request aborted', 'AbortError');
  }
  if (error) {
    throw new Error(error.message);
  }

  return String(data);
}

export async function deleteUserMemoViaRpc(
  memoId: string,
  reason: string,
  signal?: AbortSignal
): Promise<string> {
  if (!supabaseClient) {
    throw new Error('Supabase client not configured');
  }

  const { data, error } = await supabaseClient.rpc('admin_delete_user_memo', {
    p_memo_id: memoId,
    p_reason: reason
  });
  if (signal?.aborted) {
    throw new DOMException('Request aborted', 'AbortError');
  }
  if (error) {
    throw new Error(error.message);
  }

  return String(data);
}
