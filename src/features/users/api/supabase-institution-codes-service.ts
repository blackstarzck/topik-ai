import { supabaseClient } from '../../../shared/api/supabase-client';
import type {
  InstitutionCode,
  InstitutionCodeKind,
  InstitutionCodeMember,
  InstitutionCodeStatus
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

export async function assignInstitutionCodeViaRpc(
  userIds: string[],
  code: string,
  reason: string,
  signal?: AbortSignal
): Promise<number> {
  const client = requireClient();
  throwIfAborted(signal);

  const { data, error } = await client.rpc('admin_assign_institution_code', {
    p_user_ids: userIds,
    p_code: code,
    p_reason: reason.trim()
  });
  if (error) {
    throw new Error(error.message);
  }

  return typeof data === 'number' ? data : Number(data ?? 0);
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
