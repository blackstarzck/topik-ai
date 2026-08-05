import { supabaseClient } from '../../../shared/api/supabase-client';
import type {
  InstitutionContract,
  InstitutionContractStatus,
  InstitutionContractStatusSummary,
  InstitutionExposureOptions,
  InstitutionSettings
} from '../model/institution-contracts-types';

/**
 * 기관 계약·운영 설정 Supabase 어댑터. PR #76 이 만든 RPC 9종과 1:1 이다.
 *
 * 읽기 3종: admin_list_institution_contracts / admin_list_institution_contract_status /
 *   admin_list_institution_settings
 * 쓰기 6종: admin_create/update/delete_institution_contract /
 *   admin_set_institution_auto_hide_on_expiry / admin_set_institution_auto_assign /
 *   admin_update_institution_settings
 *
 * 모든 RPC 는 private.is_admin + public.admin_has_permission('users.institution-codes.manage')
 * 가드를 통과해야 하며 쓰기는 사유가 필수다(사유 검증은 파사드가 왕복 전에 막는다).
 */

type ContractRow = {
  contract_id: string;
  institution_code: string;
  starts_on: string | null;
  ends_on: string | null;
  contract_status: string | null;
  doc_url: string | null;
  note: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type ContractStatusRow = {
  code: string;
  has_active_contract: boolean | null;
  active_starts_on: string | null;
  active_ends_on: string | null;
  days_left: number | null;
  contract_count: number | null;
  auto_hide_on_expiry: boolean | null;
  writing_hidden_now: boolean | null;
};

type ExposureOptionsRow = {
  code: string;
  auto_hide_on_expiry: boolean | null;
  auto_assign_new_questions: boolean | null;
};

type SettingsRow = {
  code: string;
  max_members: number | null;
  default_invite_expiry_days: number | null;
  block_intake_on_expiry: boolean | null;
  contact_name: string | null;
  contact_email: string | null;
  member_count: number | null;
  pending_invitation_count: number | null;
  seats_used: number | null;
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

/** date/timestamp 를 화면용 YYYY-MM-DD 로. null 은 빈 문자열(무기한·미입력 표현). */
function toDateText(value: string | null): string {
  if (!value) {
    return '';
  }
  return value.slice(0, 10);
}

const CONTRACT_STATUSES: readonly InstitutionContractStatus[] = ['예정', '유효', '만료'];

function toContractStatus(value: string | null): InstitutionContractStatus {
  return CONTRACT_STATUSES.includes(value as InstitutionContractStatus)
    ? (value as InstitutionContractStatus)
    : '만료';
}

function mapContract(row: ContractRow): InstitutionContract {
  return {
    contractId: row.contract_id,
    code: row.institution_code,
    startsOn: toDateText(row.starts_on),
    endsOn: toDateText(row.ends_on),
    status: toContractStatus(row.contract_status),
    docUrl: row.doc_url ?? '',
    note: row.note ?? '',
    createdAt: toDateText(row.created_at),
    updatedAt: toDateText(row.updated_at)
  };
}

function mapContractStatus(row: ContractStatusRow): InstitutionContractStatusSummary {
  return {
    code: row.code,
    // 서버 폴백은 "유효"다(계약 미등재 기관). null 이 와도 같은 방향으로 읽는다.
    hasActiveContract: row.has_active_contract ?? true,
    activeStartsOn: toDateText(row.active_starts_on),
    activeEndsOn: toDateText(row.active_ends_on),
    daysLeft: row.days_left ?? null,
    contractCount: row.contract_count ?? 0,
    autoHideOnExpiry: row.auto_hide_on_expiry ?? false,
    writingHiddenNow: row.writing_hidden_now ?? false
  };
}

function mapSettings(row: SettingsRow): InstitutionSettings {
  return {
    code: row.code,
    maxMembers: row.max_members ?? null,
    defaultInviteExpiryDays: row.default_invite_expiry_days ?? null,
    blockIntakeOnExpiry: row.block_intake_on_expiry ?? false,
    contactName: row.contact_name ?? '',
    contactEmail: row.contact_email ?? '',
    memberCount: row.member_count ?? 0,
    pendingInvitationCount: row.pending_invitation_count ?? 0,
    seatsUsed: row.seats_used ?? 0,
    updatedAt: toDateText(row.updated_at)
  };
}

export async function loadInstitutionContractsFromSupabase(
  code: string | null,
  signal?: AbortSignal
): Promise<InstitutionContract[]> {
  const client = requireClient();
  throwIfAborted(signal);

  const { data, error } = await client.rpc('admin_list_institution_contracts', {
    p_codes: code ? [code] : null
  });
  if (error) {
    throw new Error(error.message);
  }
  throwIfAborted(signal);

  return ((data as ContractRow[] | null) ?? []).map(mapContract);
}

export async function loadInstitutionContractStatusFromSupabase(
  code: string | null,
  signal?: AbortSignal
): Promise<InstitutionContractStatusSummary[]> {
  const client = requireClient();
  throwIfAborted(signal);

  const { data, error } = await client.rpc('admin_list_institution_contract_status', {
    p_codes: code ? [code] : null
  });
  if (error) {
    throw new Error(error.message);
  }
  throwIfAborted(signal);

  return ((data as ContractStatusRow[] | null) ?? []).map(mapContractStatus);
}

/**
 * 노출 옵션 2종 조회. `auto_assign_new_questions` 를 되읽는 **유일한 경로**다 —
 * `20260804100100` 이 쓰기 RPC 만 만들어 write-only 였고 `20260805100000` 이 보완했다.
 * 토글이 자기 현재 상태를 그리려면 이 조회가 반드시 필요하다.
 */
export async function loadInstitutionExposureOptionsFromSupabase(
  code: string | null,
  signal?: AbortSignal
): Promise<InstitutionExposureOptions[]> {
  const client = requireClient();
  throwIfAborted(signal);

  const { data, error } = await client.rpc('admin_list_institution_exposure_options', {
    p_codes: code ? [code] : null
  });
  if (error) {
    throw new Error(error.message);
  }
  throwIfAborted(signal);

  return ((data as ExposureOptionsRow[] | null) ?? []).map((row) => ({
    code: row.code,
    autoHideOnExpiry: row.auto_hide_on_expiry ?? false,
    autoAssignNewQuestions: row.auto_assign_new_questions ?? false
  }));
}

export async function loadInstitutionSettingsFromSupabase(
  code: string | null,
  signal?: AbortSignal
): Promise<InstitutionSettings[]> {
  const client = requireClient();
  throwIfAborted(signal);

  const { data, error } = await client.rpc('admin_list_institution_settings', {
    p_codes: code ? [code] : null
  });
  if (error) {
    throw new Error(error.message);
  }
  throwIfAborted(signal);

  return ((data as SettingsRow[] | null) ?? []).map(mapSettings);
}

export async function createInstitutionContractViaRpc(
  input: {
    code: string;
    startsOn: string;
    endsOn: string;
    reason: string;
    note: string;
    docUrl: string;
  },
  signal?: AbortSignal
): Promise<string> {
  const client = requireClient();
  throwIfAborted(signal);

  const { data, error } = await client.rpc('admin_create_institution_contract', {
    p_code: input.code,
    p_starts_on: input.startsOn,
    // 빈 문자열이 아니라 null 을 보내야 무기한으로 저장된다.
    p_ends_on: input.endsOn ? input.endsOn : null,
    p_reason: input.reason.trim(),
    p_note: input.note.trim() ? input.note.trim() : null,
    p_doc_url: input.docUrl.trim() ? input.docUrl.trim() : null
  });
  if (error) {
    throw new Error(error.message);
  }

  return typeof data === 'string' ? data : String(data ?? '');
}

export async function updateInstitutionContractViaRpc(
  input: {
    contractId: string;
    startsOn: string;
    endsOn: string;
    reason: string;
    note: string;
    docUrl: string;
  },
  signal?: AbortSignal
): Promise<string> {
  const client = requireClient();
  throwIfAborted(signal);

  const { data, error } = await client.rpc('admin_update_institution_contract', {
    p_contract_id: input.contractId,
    p_starts_on: input.startsOn,
    p_ends_on: input.endsOn ? input.endsOn : null,
    p_reason: input.reason.trim(),
    p_note: input.note.trim() ? input.note.trim() : null,
    p_doc_url: input.docUrl.trim() ? input.docUrl.trim() : null
  });
  if (error) {
    throw new Error(error.message);
  }

  return typeof data === 'string' ? data : String(data ?? input.contractId);
}

export async function deleteInstitutionContractViaRpc(
  input: { contractId: string; reason: string },
  signal?: AbortSignal
): Promise<string> {
  const client = requireClient();
  throwIfAborted(signal);

  const { data, error } = await client.rpc('admin_delete_institution_contract', {
    p_contract_id: input.contractId,
    p_reason: input.reason.trim()
  });
  if (error) {
    throw new Error(error.message);
  }

  return typeof data === 'string' ? data : String(data ?? input.contractId);
}

export async function setInstitutionAutoHideViaRpc(
  input: { code: string; enabled: boolean; reason: string },
  signal?: AbortSignal
): Promise<string> {
  const client = requireClient();
  throwIfAborted(signal);

  const { data, error } = await client.rpc('admin_set_institution_auto_hide_on_expiry', {
    p_code: input.code,
    p_enabled: input.enabled,
    p_reason: input.reason.trim()
  });
  if (error) {
    throw new Error(error.message);
  }

  return typeof data === 'string' ? data : input.code;
}

export async function setInstitutionAutoAssignViaRpc(
  input: { code: string; enabled: boolean; reason: string },
  signal?: AbortSignal
): Promise<string> {
  const client = requireClient();
  throwIfAborted(signal);

  const { data, error } = await client.rpc('admin_set_institution_auto_assign', {
    p_code: input.code,
    p_enabled: input.enabled,
    p_reason: input.reason.trim()
  });
  if (error) {
    throw new Error(error.message);
  }

  return typeof data === 'string' ? data : input.code;
}

export async function updateInstitutionSettingsViaRpc(
  input: {
    code: string;
    maxMembers: number | null;
    defaultInviteExpiryDays: number | null;
    blockIntakeOnExpiry: boolean;
    contactName: string;
    contactEmail: string;
    reason: string;
  },
  signal?: AbortSignal
): Promise<string> {
  const client = requireClient();
  throwIfAborted(signal);

  const { data, error } = await client.rpc('admin_update_institution_settings', {
    p_code: input.code,
    p_max_members: input.maxMembers,
    p_default_invite_expiry_days: input.defaultInviteExpiryDays,
    p_block_intake_on_expiry: input.blockIntakeOnExpiry,
    p_contact_name: input.contactName.trim() ? input.contactName.trim() : null,
    p_contact_email: input.contactEmail.trim() ? input.contactEmail.trim() : null,
    p_reason: input.reason.trim()
  });
  if (error) {
    throw new Error(error.message);
  }

  return typeof data === 'string' ? data : input.code;
}

/**
 * 정원·계약 차단 사전 검사를 포함한 초대 발송(wrapper RPC).
 *
 * 원함수 `admin_invite_institution_members` 는 20260731100000 이 문자열 수술로 가드를
 * 심어둔 함수라 재정의가 금지되어 있고, 정원·차단 검사는 wrapper 로만 확장했다.
 * `expiresInDays` 를 null 로 보내면 서버가 기관 설정의 기본값(없으면 전역 7일)으로 해석한다 —
 * 화면이 7 을 하드코딩해 보내면 기관별 기본값 기능이 죽는다.
 */
export async function inviteInstitutionMembersGuardedViaRpc(
  userIds: string[],
  code: string,
  reason: string,
  expiresInDays: number | null,
  signal?: AbortSignal
): Promise<number> {
  const client = requireClient();
  throwIfAborted(signal);

  const { data, error } = await client.rpc('admin_invite_institution_members_guarded', {
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
