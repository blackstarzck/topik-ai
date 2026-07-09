import { supabaseClient } from '../../../shared/api/supabase-client';
import type {
  UserLearningOverview,
  EmailVerificationStatus,
  RegistrationStatus,
  SubscriptionStatus,
  TermsConsentStatus,
  UserStatus,
  UserSummary,
  UserTier
} from '../model/types';
import type { ExportUsersOptions, UserExportRow } from '../model/user-export-types';

export type { ExportUsersOptions, UserExportRow } from '../model/user-export-types';

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
  gender?: string | null;
  app_role: string;
  plan_label: string | null;
  status: string;
  registration_status?: string | null;
  nationality_country_code: string | null;
  // 소셜 로그인 provider 배열(auth.identities, 'email' 제외). 없으면 빈 배열/NULL.
  social_providers: string[] | null;
  // 박람회/기관 유입 코드(profiles.affiliation_code) + institution_codes.label 조인 표시명.
  affiliation_code: string | null;
  affiliation_label: string | null;
  // 전화번호 마스킹값(예: 010-****-5678). 목록 RPC 는 마스킹만 내려준다(표시제한).
  phone_masked?: string | null;
  // 전화번호 원문 — 단건 상세 RPC(get_admin_user)에서만 내려온다. 목록에는 없다.
  phone?: string | null;
  submission_count: number;
  last_activity: string | null;
  last_sign_in_at: string | null;
  // auth.users.email_confirmed_at IS NOT NULL. false = 이메일 미인증(가입 미완료).
  email_confirmed?: boolean | null;
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
  per_question: UserLearningOverview['perQuestion'];
  tag_stats: UserLearningOverview['tagStats'];
  weaknesses: UserLearningOverview['weaknesses'];
  recent_writing: UserLearningOverview['recentWriting'];
  objective_attempts: UserLearningOverview['objectiveAttempts'];
  onboarding: UserLearningOverview['onboarding'];
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

// v13 study_events 원장 행(admin_get_user_study_events). reference = 연관 문제/제출/시도 단축 참조.
type UserActivityRow = {
  id: string;
  event_type: string;
  reference: string;
  occurred_at: string;
};

// v13 payment_history 행(admin_get_user_payment_history). 금액/결제일/상태는 RPC에서 표시 문자열로 가공.
type UserPaymentRow = {
  id: string;
  product: string;
  amount: string;
  method: string;
  status: string;
  paid_at: string;
};

// v13 study_events.event_type(고정 카탈로그) → 한글 표시 라벨.
const STUDY_EVENT_LABEL: Record<string, string> = {
  practice_started: '학습 시작',
  attempt_submitted: '문제 제출',
  draft_autosaved: '작문 임시저장',
  submission_submitted: '작문 제출',
  feedback_viewed: '피드백 확인',
  report_viewed: '리포트 확인',
  recommendation_clicked: '추천 클릭',
  export_downloaded: '내보내기'
};

type UserAccessLogRow = {
  id: string;
  log_type: string;
  ip: string;
  device: string;
  created_at: string;
};

// 회원 상세 탭 표시 모델 — 페이지의 더미 행 모양과 동일(소스 스위치 union 호환).
// 활동 = v13 study_events 원장(유형/참조/시각). 접속 IP는 study_events에 없어 제거됨.
export type UserActivityEvent = {
  id: string;
  type: string;
  reference: string;
  createdAt: string;
};

export type UserPaymentRecord = {
  id: string;
  product: string;
  amount: string;
  method: string;
  paidAt: string;
  status: string;
};

export type UserAccessLog = {
  id: string;
  type: string;
  ip: string;
  device: string;
  createdAt: string;
};

// v13 profiles.status -> topik-ai UserStatus
const STATUS_MAP: Record<string, UserStatus> = {
  active: '정상',
  blocked: '정지',
  deleted: '탈퇴'
};

function mapStatus(v13Status: string): UserStatus {
  const mapped = STATUS_MAP[v13Status];
  if (!mapped) {
    throw new Error(`Unknown v13 profiles.status: ${v13Status}`);
  }
  return mapped;
}

const REGISTRATION_STATUS_MAP: Record<string, RegistrationStatus> = {
  active: 'active',
  blocked: 'blocked',
  deleted: 'deleted',
  pending_email_verification: 'pending_email_verification',
  pending_required_consent: 'pending_required_consent'
};

function mapRegistrationStatus(
  registrationStatus: string | null | undefined
): RegistrationStatus | undefined {
  if (registrationStatus == null) {
    return undefined;
  }
  const mapped = REGISTRATION_STATUS_MAP[registrationStatus];
  if (!mapped) {
    throw new Error(`Unknown v13 registration_status: ${registrationStatus}`);
  }
  return mapped;
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

// auth.users.email_confirmed_at 기반 플래그 -> 표시 상태. 명시적 false 만 '미인증'으로
// 본다(컬럼이 없는 구버전 RPC 응답에서 전원을 미인증으로 오표시하지 않도록).
function mapEmailVerification(emailConfirmed: boolean | null | undefined): EmailVerificationStatus {
  return emailConfirmed === false ? '미인증' : '인증 완료';
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

// timestamptz(UTC) -> 'YYYY-MM-DD HH:mm' (KST, UTC+9 고정·한국은 DST 없음). 빈/유효하지 않은 값은 ''.
// 회원 목록·상세의 가입일/최근 접속을 분 단위까지 노출한다(시간을 버리던 toDateString 슬라이스 대체).
function toKstDateTimeString(ts: string | null): string {
  if (!ts) {
    return '';
  }
  const parsed = new Date(ts);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }
  const kst = new Date(parsed.getTime() + 9 * 60 * 60 * 1000);
  const yyyy = kst.getUTCFullYear();
  const mm = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(kst.getUTCDate()).padStart(2, '0');
  const hh = String(kst.getUTCHours()).padStart(2, '0');
  const mi = String(kst.getUTCMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
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

function mapUserGender(value: string | null | undefined): string {
  const original = nonEmpty(value);
  const normalized = original?.toLowerCase();
  if (!normalized) {
    return '';
  }
  if (['male', 'm', '남', '남성'].includes(normalized)) {
    return '남성';
  }
  if (['female', 'f', '여', '여성'].includes(normalized)) {
    return '여성';
  }
  if (['other', 'non_binary', 'non-binary', '기타'].includes(normalized)) {
    return '기타';
  }
  if (['unknown', 'prefer_not_to_say', '미입력', '비공개'].includes(normalized)) {
    return '';
  }
  return original;
}

function mapRowToUserSummary(row: AdminUserRow): UserSummary {
  const tier = mapTier(row.plan_label);
  const subscriptionStatus: SubscriptionStatus = tier === '프리미엄' ? '구독' : '미구독';
  const displayName = nonEmpty(row.display_name);
  const nickname = nonEmpty(row.nickname);
  const registrationStatus = mapRegistrationStatus(row.registration_status);
  const phone = nonEmpty(row.phone);
  return {
    id: row.user_id,
    realName: displayName ?? '',
    email: row.email ?? '',
    // Preserve profiles.nickname exactly. Null/empty values are rendered as an
    // empty-state marker in the UI, not replaced with display_name/email fallbacks.
    nickname: nickname ?? '',
    gender: mapUserGender(row.gender),
    joinedAt: toKstDateTimeString(row.created_at),
    lastLoginAt: toKstDateTimeString(row.last_sign_in_at),
    status: mapStatus(row.status),
    ...(registrationStatus ? { registrationStatus } : {}),
    tier,
    // GAP: no subscription join in the RPC. PROPOSED heuristic from plan tier — NOT real
    // subscription state (would need a subscriptions join / additive RPC).
    subscriptionStatus,
    // 국적 코드 원본 보존(NULL/빈 값은 빈 문자열). 국가명 변환은 UI 렌더 시 수행.
    nationalityCode: nonEmpty(row.nationality_country_code) ?? '',
    // 소셜 로그인 provider 목록 보존(NULL은 빈 배열). 라벨/색상 변환은 UI 렌더 시 수행.
    socialProviders: Array.isArray(row.social_providers) ? row.social_providers : [],
    // 약관 동의(인증약관) 상태와 최종 동의일. 동의 기록이 없으면 날짜는 빈 문자열.
    termsConsentStatus: mapConsentStatus(row.consent_status),
    termsConsentAt: toDateString(row.consent_accepted_at),
    // 이메일 인증(가입 완료) 여부. 가입 미완료(미인증) 계정 식별용.
    emailVerificationStatus: mapEmailVerification(row.email_confirmed),
    // 박람회/기관 유입 코드 + 표시명(institution_codes 조인). 없으면 빈 문자열.
    affiliationCode: nonEmpty(row.affiliation_code) ?? '',
    affiliationLabel: nonEmpty(row.affiliation_label) ?? '',
    // 전화번호 — 목록은 마스킹값만, 상세(get_admin_user)는 원문(phone)도 채워진다.
    phoneMasked: nonEmpty(row.phone_masked) ?? '',
    ...(phone ? { phone } : {})
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

export async function loadUsersFromSupabase(
  signal?: AbortSignal,
  affiliation?: string | null
): Promise<UserSummary[]> {
  if (!supabaseClient) {
    throw new Error('Supabase client not configured');
  }
  // Dev: a single page of up to 100 covers the dev dataset. Prod (>100 users) needs
  // server-side pagination (follow-up — the page currently filters client-side).
  // affiliation 은 서버사이드 기관 필터: null=전체 / @affiliated / @general / 특정 코드.
  // 클라이언트 필터로는 page_size 캡(첫 페이지)만 걸러지므로 서버에서 적용한다.
  const { data, error } = await supabaseClient.rpc('get_admin_users', {
    search: null,
    sort: 'activity',
    page: 1,
    page_size: 100,
    affiliation: affiliation && affiliation.trim() ? affiliation.trim() : null
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
 * 회원 상세 단건 read — id 로 해당 회원만 직접 조회한다(get_admin_user).
 * 반환 컬럼/파생 규칙이 get_admin_users 와 1:1 동일하므로 mapRowToUserSummary 를
 * 그대로 재사용한다. 목록 RPC의 "상위 100명 창" 제약이 없어 전 회원을 조회할 수 있다.
 */
export async function loadUserByIdFromSupabase(
  userId: string,
  signal?: AbortSignal
): Promise<UserSummary | null> {
  if (!supabaseClient) {
    throw new Error('Supabase client not configured');
  }
  const { data, error } = await supabaseClient.rpc('get_admin_user', {
    target_user_id: userId
  });
  if (signal?.aborted) {
    throw new DOMException('Request aborted', 'AbortError');
  }
  if (error) {
    throw new Error(error.message);
  }
  const rows = (data ?? []) as AdminUserRow[];
  return rows.length > 0 ? mapRowToUserSummary(rows[0]) : null;
}

// 내보내기 RPC(admin_export_users) 행 — 목록 계약 + phone(원문 포함 선택 시에만 값, 기본 null).
type AdminUserExportRpcRow = Omit<AdminUserRow, 'total_count'>;

/**
 * 회원 정보 내보내기 read — admin_export_users. 목록 RPC(get_admin_users)를 서버에서
 * 페이지 루프로 재사용해 전 회원을 반환하며(100명 창 없음), 호출마다 사유·행수·원문
 * 포함 여부가 admin_audit_logs 에 기록된다(개인정보 다운로드 사유 확인 의무).
 */
export async function exportUsersFromSupabase(
  options: ExportUsersOptions,
  signal?: AbortSignal
): Promise<UserExportRow[]> {
  if (!supabaseClient) {
    throw new Error('Supabase client not configured');
  }
  const affiliation = options.filters.affiliation || options.affiliation || '';
  const { data, error } = await supabaseClient.rpc('admin_export_users', {
    p_reason: options.reason,
    p_include_full_phone: options.includeFullPhone,
    p_affiliation: affiliation.trim() ? affiliation.trim() : null,
    p_scope: options.scope,
    p_selected_user_ids: options.scope === 'selected' ? options.selectedUserIds : [],
    p_search: options.filters.keyword || null,
    p_search_field: options.filters.searchField,
    p_start_date: options.filters.startDate || null,
    p_end_date: options.filters.endDate || null,
    p_gender_filters: options.filters.genders,
    p_tier_filters: options.filters.tiers,
    p_subscription_status_filters: options.filters.subscriptionStatuses,
    p_membership_status_filters: options.filters.membershipStatuses,
    p_terms_consent_status_filters: options.filters.termsConsentStatuses,
    p_email_verification_status_filters: options.filters.emailVerificationStatuses,
    p_selected_column_keys: options.columns
  });
  if (signal?.aborted) {
    throw new DOMException('Request aborted', 'AbortError');
  }
  if (error) {
    throw new Error(error.message);
  }
  const rows = (data ?? []) as AdminUserExportRpcRow[];
  return rows.map((row) => {
    const summary = mapRowToUserSummary({ ...row, total_count: 0 });
    return {
      ...summary,
      exportPhone: options.includeFullPhone
        ? nonEmpty(row.phone) ?? ''
        : summary.phoneMasked
    };
  });
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
      totalSubmissions: 0,
      feedbackComplete: 0,
      feedbackPending: 0,
      feedbackFailed: 0,
      resubmissionCount: 0,
      avgScoreNormalized: null,
      feedbackViewedCount: 0,
      feedbackViewRate: null,
      streakDays: 0,
      weeklyGoalMinutes: null,
      weeklyStudiedMinutes: null,
      metricsCount: 0,
      avgElapsedSeconds: null,
      avgActiveSeconds: null,
      latestActivityAt: ''
    },
    perQuestion: row?.per_question ?? [],
    tagStats: row?.tag_stats ?? [],
    weaknesses: row?.weaknesses ?? [],
    recentWriting: row?.recent_writing ?? [],
    objectiveAttempts: row?.objective_attempts ?? {
      totalAttempts: 0,
      solvedProblems: 0,
      correctRate: null,
      averageScore: null,
      totalStudyMinutes: 0,
      bookmarkedCount: 0,
      latestAttemptAt: ''
    },
    onboarding: row?.onboarding ?? {
      hasGoal: false,
      topikLevel: '',
      targetGrade: null,
      examDate: '',
      weeklyGoalMinutes: null,
      weakAreas: [],
      goalUpdatedAt: ''
    }
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

export async function getUserActivityFromSupabase(
  userId: string,
  signal?: AbortSignal
): Promise<UserActivityEvent[]> {
  if (!supabaseClient) {
    throw new Error('Supabase client not configured');
  }

  const { data, error } = await supabaseClient.rpc('admin_get_user_study_events', {
    p_target_user_id: userId,
    p_limit: 100
  });
  if (signal?.aborted) {
    throw new DOMException('Request aborted', 'AbortError');
  }
  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as UserActivityRow[]).map((row) => ({
    id: row.id,
    type: STUDY_EVENT_LABEL[row.event_type] ?? row.event_type,
    reference: row.reference,
    createdAt: row.occurred_at
  }));
}

// 회원이 동의한 약관 버전(이용약관/개인정보) — admin_get_user_legal_consents 반환 행.
type UserLegalConsentRow = {
  doc_type: string;
  version: string;
  title: string;
  source: string;
  accepted_at: string;
  is_current: boolean;
};

export type UserLegalConsent = {
  docType: string;
  docLabel: string;
  version: string;
  title: string;
  source: string;
  acceptedAt: string;
  isCurrent: boolean;
};

const LEGAL_DOC_LABEL: Record<string, string> = {
  terms: '이용약관',
  privacy: '개인정보 처리방침'
};

const LEGAL_CONSENT_SOURCE_LABEL: Record<string, string> = {
  signup: '가입 시',
  re_consent: '재동의',
  settings: '설정 변경'
};

export async function getUserLegalConsentsFromSupabase(
  userId: string,
  signal?: AbortSignal
): Promise<UserLegalConsent[]> {
  if (!supabaseClient) {
    throw new Error('Supabase client not configured');
  }

  const { data, error } = await supabaseClient.rpc('admin_get_user_legal_consents', {
    p_user_id: userId
  });
  if (signal?.aborted) {
    throw new DOMException('Request aborted', 'AbortError');
  }
  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as UserLegalConsentRow[]).map((row) => ({
    docType: row.doc_type,
    docLabel: LEGAL_DOC_LABEL[row.doc_type] ?? row.doc_type,
    version: row.version,
    title: row.title,
    source: LEGAL_CONSENT_SOURCE_LABEL[row.source] ?? row.source,
    acceptedAt: row.accepted_at,
    isCurrent: row.is_current
  }));
}

export async function getUserPaymentsFromSupabase(
  userId: string,
  signal?: AbortSignal
): Promise<UserPaymentRecord[]> {
  if (!supabaseClient) {
    throw new Error('Supabase client not configured');
  }

  const { data, error } = await supabaseClient.rpc('admin_get_user_payment_history', {
    p_target_user_id: userId,
    p_limit: 100
  });
  if (signal?.aborted) {
    throw new DOMException('Request aborted', 'AbortError');
  }
  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as UserPaymentRow[]).map((row) => ({
    id: row.id,
    product: row.product,
    amount: row.amount,
    method: row.method,
    paidAt: row.paid_at,
    status: row.status
  }));
}

export async function getUserAccessLogsFromSupabase(
  userId: string,
  signal?: AbortSignal
): Promise<UserAccessLog[]> {
  if (!supabaseClient) {
    throw new Error('Supabase client not configured');
  }

  const { data, error } = await supabaseClient.rpc('admin_get_user_access_logs', {
    p_target_user_id: userId,
    p_limit: 100
  });
  if (signal?.aborted) {
    throw new DOMException('Request aborted', 'AbortError');
  }
  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as UserAccessLogRow[]).map((row) => ({
    id: row.id,
    type: row.log_type,
    ip: row.ip,
    device: row.device,
    createdAt: row.created_at
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
