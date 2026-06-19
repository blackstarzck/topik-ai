import { supabaseClient } from '../../../shared/api/supabase-client';
import type {
  InstitutionCode,
  InstitutionCodeKind,
  InstitutionCodeStatus
} from '../model/institution-codes-types';

/**
 * Users > 기관 코드 Supabase 어댑터.
 * admin_list_institution_codes / admin_create_institution_code /
 * admin_update_institution_code RPC를 호출하고 화면 모델(InstitutionCode)로 매핑한다.
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
