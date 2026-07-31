import { supabaseClient } from '../../../shared/api/supabase-client';
import {
  defaultInstitutionExposureMode,
  institutionExposureModes
} from '../model/institution-codes-types';
import type {
  InstitutionCode,
  InstitutionCodeKind,
  InstitutionCodeMember,
  InstitutionCodeStatus,
  InstitutionExposureMode,
  InstitutionExposureModeRow,
  InstitutionInvitation,
  InstitutionInvitationStatus
} from '../model/institution-codes-types';

/**
 * Users > 기관 코드 Supabase 어댑터.
 * admin_list_institution_codes / admin_create_institution_code /
 * admin_update_institution_code / admin_delete_institution_code RPC를 호출하고 화면 모델(InstitutionCode)로 매핑한다.
 * 모든 RPC는 private.is_admin 가드 + (쓰기) admin_audit_logs 기록.
 */
type InstitutionCodeRow = {
  code: string;
  label: string;
  kind: string;
  status: string;
  note: string | null;
  member_count: number | null;
  created_at: string | null;
  updated_at: string | null;
};

function requireClient() {
  if (!supabaseClient) {
    throw new Error('Supabase client not configured');
  }
  return supabaseClient;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new DOMException('Request aborted', 'AbortError');
  }
}

function toDateText(value: string | null): string {
  if (!value) {
    return '';
  }
  return value.slice(0, 10);
}

function mapRow(row: InstitutionCodeRow): InstitutionCode {
  return {
    code: row.code,
    label: row.label,
    kind: row.kind as InstitutionCodeKind,
    status: row.status as InstitutionCodeStatus,
    note: row.note ?? '',
    memberCount: row.member_count ?? 0,
    createdAt: toDateText(row.created_at),
    updatedAt: toDateText(row.updated_at)
  };
}

export async function loadInstitutionCodesFromSupabase(
  search?: string,
  status?: InstitutionCodeStatus | null,
  signal?: AbortSignal
): Promise<InstitutionCode[]> {
  const client = requireClient();
  throwIfAborted(signal);

  const { data, error } = await client.rpc('admin_list_institution_codes', {
    p_search: search && search.trim() ? search.trim() : null,
    p_status: status ?? null
  });
  if (error) {
    throw new Error(error.message);
  }
  throwIfAborted(signal);

  return ((data as InstitutionCodeRow[] | null) ?? []).map(mapRow);
}

type InstitutionExposureModeRpcRow = {
  code: string;
  exposure_mode: string | null;
  assigned_question_count: number | null;
  reason: string | null;
  updated_at: string | null;
};

/**
 * 알 수 없는 값이 오면 현행 동작(`배정분만`)으로 좁힌다. UI 배포와 DB 마이그 사이의 창에서
 * null 이 빈 Tag 로 새는 것을 막는다 — 폴백은 항상 `제한 없음` 이 아니어야 한다.
 */
function toExposureMode(value: string | null): InstitutionExposureMode {
  return institutionExposureModes.includes(value as InstitutionExposureMode)
    ? (value as InstitutionExposureMode)
    : defaultInstitutionExposureMode;
}

function mapExposureModeRow(
  row: InstitutionExposureModeRpcRow
): InstitutionExposureModeRow {
  return {
    code: row.code,
    exposureMode: toExposureMode(row.exposure_mode),
    assignedQuestionCount: Number(row.assigned_question_count ?? 0),
    reason: row.reason ?? '',
    updatedAt: toDateText(row.updated_at)
  };
}

export async function loadInstitutionExposureModesFromSupabase(
  signal?: AbortSignal
): Promise<InstitutionExposureModeRow[]> {
  const client = requireClient();
  throwIfAborted(signal);

  const { data, error } = await client.rpc('admin_list_institution_exposure_modes', {
    p_codes: null
  });
  if (error) {
    throw new Error(error.message);
  }
  throwIfAborted(signal);

  return ((data as InstitutionExposureModeRpcRow[] | null) ?? []).map(mapExposureModeRow);
}

export async function setInstitutionExposureModeViaRpc(input: {
  code: string;
  exposureMode: InstitutionExposureMode;
  reason: string;
}): Promise<void> {
  const client = requireClient();
  const { error } = await client.rpc('admin_set_institution_exposure_mode', {
    p_code: input.code,
    p_mode: input.exposureMode,
    p_reason: input.reason
  });
  if (error) {
    throw new Error(error.message);
  }
}

export async function createInstitutionCodeViaRpc(
  input: { code: string; label: string; kind: InstitutionCodeKind; note: string },
  signal?: AbortSignal
): Promise<string> {
  const client = requireClient();
  throwIfAborted(signal);

  const { data, error } = await client.rpc('admin_create_institution_code', {
    p_code: input.code.trim(),
    p_label: input.label.trim(),
    p_kind: input.kind,
    p_note: input.note.trim() ? input.note.trim() : null
  });
  if (error) {
    throw new Error(error.message);
  }

  return (data as string | null) ?? input.code.trim();
}

export async function updateInstitutionCodeViaRpc(
  input: {
    code: string;
    label: string;
    kind: InstitutionCodeKind;
    status: InstitutionCodeStatus;
    note: string;
    reason: string;
  },
  signal?: AbortSignal
): Promise<string> {
  const client = requireClient();
  throwIfAborted(signal);

  const { data, error } = await client.rpc('admin_update_institution_code', {
    p_code: input.code,
    p_label: input.label.trim(),
    p_kind: input.kind,
    p_status: input.status,
    p_note: input.note.trim() ? input.note.trim() : null,
    p_reason: input.reason.trim()
  });
  if (error) {
    throw new Error(error.message);
  }

  return (data as string | null) ?? input.code;
}

export async function deleteInstitutionCodeViaRpc(
  input: { code: string; reason: string },
  signal?: AbortSignal
): Promise<string> {
  const client = requireClient();
  throwIfAborted(signal);

  const { data, error } = await client.rpc('admin_delete_institution_code', {
    p_code: input.code,
    p_reason: input.reason.trim()
  });
  if (error) {
    throw new Error(error.message);
  }

  return (data as string | null) ?? input.code;
}

// admin_list_institution_code_members RPC 행. status 는 v13 원본(active/blocked/deleted).
type InstitutionCodeMemberRow = {
  user_id: string;
  email: string | null;
  display_name: string | null;
  nickname: string | null;
  status: string | null;
  app_role: string | null;
  plan_label: string | null;
  created_at: string | null;
  last_sign_in_at: string | null;
};

// v13 profiles.status -> 한글 표시(회원 목록 매핑과 동일 규칙).
const MEMBER_STATUS_LABEL: Record<string, string> = {
  active: '정상',
  blocked: '정지',
  deleted: '탈퇴'
};

function mapMemberRow(row: InstitutionCodeMemberRow): InstitutionCodeMember {
  return {
    userId: row.user_id,
    realName: row.display_name?.trim() ? row.display_name.trim() : '',
    nickname: row.nickname?.trim() ? row.nickname.trim() : '',
    email: row.email ?? '',
    status: MEMBER_STATUS_LABEL[row.status ?? ''] ?? '정상',
    joinedAt: row.created_at ? row.created_at.slice(0, 10) : ''
  };
}

export async function loadInstitutionCodeMembersFromSupabase(
  code: string,
  search?: string,
  signal?: AbortSignal
): Promise<InstitutionCodeMember[]> {
  const client = requireClient();
  throwIfAborted(signal);

  const { data, error } = await client.rpc('admin_list_institution_code_members', {
    p_code: code,
    p_search: search && search.trim() ? search.trim() : null
  });
  if (error) {
    throw new Error(error.message);
  }
  throwIfAborted(signal);

  return ((data as InstitutionCodeMemberRow[] | null) ?? []).map(mapMemberRow);
}

/**
 * 기관 초대 발송. 즉시 배정이 아니라 pending 초대 + 인앱/이메일 알림을 만든다.
 * 동일 코드 기소속/유효 pending/탈퇴 회원은 서버가 스킵하며, 실제 초대된 수를 반환한다.
 * 만료 기간은 기본 7일(1~365일 지정 가능) — 경과 시 초대가 무효(expired)된다.
 */
export async function inviteInstitutionMembersViaRpc(
  userIds: string[],
  code: string,
  reason: string,
  expiresInDays: number,
  signal?: AbortSignal
): Promise<number> {
  const client = requireClient();
  throwIfAborted(signal);

  const { data, error } = await client.rpc('admin_invite_institution_members', {
    p_user_ids: userIds,
    p_code: code,
    p_reason: reason.trim(),
    p_expires_in_days: expiresInDays
  });
  if (error) {
    throw new Error(error.message);
  }

  return typeof data === 'number' ? data : Number(data ?? 0);
}

// admin_list_institution_invitations RPC 행.
type InstitutionInvitationRow = {
  invitation_id: string;
  code: string;
  code_label: string | null;
  user_id: string;
  email: string | null;
  display_name: string | null;
  nickname: string | null;
  status: string;
  reason: string | null;
  invited_by: string | null;
  invited_by_name: string | null;
  created_at: string | null;
  responded_at: string | null;
  email_status: string | null;
  email_error: string | null;
  email_sent_at: string | null;
  expires_at: string | null;
};

function mapInvitationRow(row: InstitutionInvitationRow): InstitutionInvitation {
  return {
    invitationId: row.invitation_id,
    code: row.code,
    codeLabel: row.code_label ?? '',
    userId: row.user_id,
    email: row.email ?? '',
    realName: row.display_name?.trim() ? row.display_name.trim() : '',
    nickname: row.nickname?.trim() ? row.nickname.trim() : '',
    status: row.status as InstitutionInvitationStatus,
    reason: row.reason ?? '',
    invitedByName: row.invited_by_name ?? '',
    createdAt: row.created_at ? row.created_at.slice(0, 10) : '',
    respondedAt: row.responded_at ? row.responded_at.slice(0, 10) : '',
    emailStatus: (row.email_status as InstitutionInvitation['emailStatus']) ?? null,
    emailError: row.email_error ?? '',
    emailSentAt: row.email_sent_at ? row.email_sent_at.slice(0, 10) : '',
    expiresAt: row.expires_at ? row.expires_at.slice(0, 10) : ''
  };
}

export async function loadInstitutionInvitationsFromSupabase(
  filter: { code?: string; userId?: string; status?: InstitutionInvitationStatus },
  signal?: AbortSignal
): Promise<InstitutionInvitation[]> {
  const client = requireClient();
  throwIfAborted(signal);

  const { data, error } = await client.rpc('admin_list_institution_invitations', {
    p_code: filter.code?.trim() ? filter.code.trim() : null,
    p_user_id: filter.userId ?? null,
    p_status: filter.status ?? null
  });
  if (error) {
    throw new Error(error.message);
  }
  throwIfAborted(signal);

  return ((data as InstitutionInvitationRow[] | null) ?? []).map(mapInvitationRow);
}

export async function cancelInstitutionInvitationViaRpc(
  invitationId: string,
  reason: string,
  signal?: AbortSignal
): Promise<string> {
  const client = requireClient();
  throwIfAborted(signal);

  const { data, error } = await client.rpc('admin_cancel_institution_invitation', {
    p_invitation_id: invitationId,
    p_reason: reason.trim()
  });
  if (error) {
    throw new Error(error.message);
  }

  return (data as string | null) ?? invitationId;
}

export async function clearInstitutionCodeViaRpc(
  userIds: string[],
  reason: string,
  signal?: AbortSignal
): Promise<number> {
  const client = requireClient();
  throwIfAborted(signal);

  const { data, error } = await client.rpc('admin_clear_institution_code', {
    p_user_ids: userIds,
    p_reason: reason.trim()
  });
  if (error) {
    throw new Error(error.message);
  }

  return typeof data === 'number' ? data : Number(data ?? 0);
}
