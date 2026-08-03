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
import {
  addMockInstitutionCode,
  mockInstitutionCodes,
  mockInstitutionExposureModes,
  patchMockInstitutionExposureMode,
  removeMockInstitutionCode,
  updateMockInstitutionCode
} from './mock-institution-codes';
import { toSafeResult, withRetry } from '../../../shared/api/safe-request';
import { institutionCodesDataSource } from './institution-codes-data-source';
import {
  cancelInstitutionInvitationViaRpc,
  clearInstitutionCodeViaRpc,
  createInstitutionCodeViaRpc,
  deleteInstitutionCodeViaRpc,
  inviteInstitutionMembersViaRpc,
  loadInstitutionCodeMembersFromSupabase,
  loadInstitutionCodesFromSupabase,
  loadInstitutionExposureModesFromSupabase,
  loadInstitutionInvitationsFromSupabase,
  setInstitutionExposureModeViaRpc,
  updateInstitutionCodeViaRpc
} from './supabase-institution-codes-service';

const isSupabaseSource = institutionCodesDataSource === 'supabase';

/** 기관 코드 화면이 Supabase 실데이터 경로인지(생성/수정 분기·사유 필수 여부용). */
export const isInstitutionCodesSupabase = isSupabaseSource;

export type CreateInstitutionCodePayload = {
  code: string;
  label: string;
  kind: InstitutionCodeKind;
  note: string;
};

export type UpdateInstitutionCodePayload = {
  code: string;
  label: string;
  kind: InstitutionCodeKind;
  status: InstitutionCodeStatus;
  note: string;
  reason: string;
};

export type DeleteInstitutionCodePayload = {
  code: string;
  reason: string;
};

export type SetInstitutionExposureModePayload = {
  code: string;
  exposureMode: InstitutionExposureMode;
  reason: string;
};

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Request aborted', 'AbortError'));
      return;
    }

    const timer = window.setTimeout(() => {
      cleanup();
      resolve();
    }, ms);

    const onAbort = (): void => {
      cleanup();
      reject(new DOMException('Request aborted', 'AbortError'));
    };

    const cleanup = (): void => {
      window.clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    };

    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function todayText(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

async function loadInstitutionCodes(signal?: AbortSignal): Promise<InstitutionCode[]> {
  if (isSupabaseSource) {
    return loadInstitutionCodesFromSupabase(undefined, null, signal);
  }

  await sleep(280, signal);
  // 라이브 배열이 아니라 스냅샷을 돌려준다. 같은 배열 참조를 넘기면 삭제/수정 후 재조회에서
  // dataSource 식별자가 그대로라 antd Table 이 행을 다시 그리지 않는다.
  return mockInstitutionCodes.map((row) => ({ ...row }));
}

/**
 * 코드 단건 조회. 목록 RPC 를 재사용해 정확 일치를 고른다 — 관리 데이터 규모(수십 건)에서
 * 단건 RPC 를 새로 만드는 것보다 계약이 하나 적다. 없는 코드는 not-found 로 실패시켜
 * 상세 페이지가 빈 상태를 그릴 수 있게 한다.
 */
async function loadInstitutionCode(
  code: string,
  signal?: AbortSignal
): Promise<InstitutionCode> {
  const codes = await loadInstitutionCodes(signal);
  const found = codes.find((item) => item.code === code);
  if (!found) {
    throw new Error(`기관 코드를 찾을 수 없습니다: ${code}`);
  }
  return found;
}

async function persistCreate(
  payload: CreateInstitutionCodePayload,
  signal?: AbortSignal
): Promise<string> {
  if (isSupabaseSource) {
    return createInstitutionCodeViaRpc(payload, signal);
  }

  await sleep(200, signal);
  // mock 경로도 모듈 메모리에 영속화한다. 생성/수정/삭제 화면이 별도 라우트가 되어
  // 목록으로 돌아올 때 리마운트 재조회가 일어나므로, 페이지 로컬 상태 patch 로는
  // 방금 만든 코드가 사라진다.
  const code = payload.code.trim();
  addMockInstitutionCode({
    code,
    label: payload.label.trim(),
    kind: payload.kind,
    note: payload.note.trim(),
    today: todayText()
  });
  return code;
}

async function persistUpdate(
  payload: UpdateInstitutionCodePayload,
  signal?: AbortSignal
): Promise<string> {
  if (isSupabaseSource) {
    return updateInstitutionCodeViaRpc(payload, signal);
  }

  await sleep(200, signal);
  updateMockInstitutionCode({
    code: payload.code,
    label: payload.label.trim(),
    kind: payload.kind,
    status: payload.status,
    note: payload.note.trim(),
    today: todayText()
  });
  return payload.code;
}

async function persistDelete(
  payload: DeleteInstitutionCodePayload,
  signal?: AbortSignal
): Promise<string> {
  if (isSupabaseSource) {
    return deleteInstitutionCodeViaRpc(payload, signal);
  }

  await sleep(200, signal);
  removeMockInstitutionCode(payload.code);
  return payload.code;
}

async function loadInstitutionExposureModes(
  signal?: AbortSignal
): Promise<InstitutionExposureModeRow[]> {
  if (isSupabaseSource) {
    return loadInstitutionExposureModesFromSupabase(signal);
  }

  await sleep(180, signal);
  return mockInstitutionExposureModes.map((row) => ({ ...row }));
}

async function persistExposureMode(
  payload: SetInstitutionExposureModePayload,
  signal?: AbortSignal
): Promise<string> {
  if (isSupabaseSource) {
    await setInstitutionExposureModeViaRpc(payload);
    return payload.code;
  }

  await sleep(200, signal);
  // mock 경로도 모드만 patch 한다 — 배정 건수는 건드리지 않는다(모드 전환이 배정을
  // 지우지 않는다는 계약을 mock 에서도 성립시켜 e2e 로 증명할 수 있게).
  patchMockInstitutionExposureMode(payload.code, payload.exposureMode, payload.reason);
  return payload.code;
}

export function fetchInstitutionCodesSafe(signal?: AbortSignal) {
  return toSafeResult(() =>
    withRetry(() => loadInstitutionCodes(signal), { maxRetries: 1 })
  );
}

/** 기관 코드 상세 페이지용 단건 조회. 없는 코드는 error 로 떨어져 빈 상태를 그린다. */
export function fetchInstitutionCodeSafe(code: string, signal?: AbortSignal) {
  return toSafeResult(() =>
    withRetry(() => loadInstitutionCode(code, signal), { maxRetries: 1 })
  );
}

export function fetchInstitutionExposureModesSafe(signal?: AbortSignal) {
  return toSafeResult(() =>
    withRetry(() => loadInstitutionExposureModes(signal), { maxRetries: 1 })
  );
}

export function setInstitutionExposureModeSafe(
  payload: SetInstitutionExposureModePayload,
  signal?: AbortSignal
) {
  return toSafeResult(() => persistExposureMode(payload, signal));
}

export function createInstitutionCodeSafe(
  payload: CreateInstitutionCodePayload,
  signal?: AbortSignal
) {
  return toSafeResult(() => persistCreate(payload, signal));
}

export function updateInstitutionCodeSafe(
  payload: UpdateInstitutionCodePayload,
  signal?: AbortSignal
) {
  return toSafeResult(() => persistUpdate(payload, signal));
}

export function deleteInstitutionCodeSafe(
  payload: DeleteInstitutionCodePayload,
  signal?: AbortSignal
) {
  return toSafeResult(() => persistDelete(payload, signal));
}

/** 기관 코드 상세 > 소속 회원 목록. mock 경로는 빈 목록(정적 시드라 회원 없음). */
export function fetchInstitutionCodeMembersSafe(
  code: string,
  search?: string,
  signal?: AbortSignal
) {
  return toSafeResult<InstitutionCodeMember[]>(async () => {
    if (isSupabaseSource) {
      return loadInstitutionCodeMembersFromSupabase(code, search, signal);
    }
    await sleep(200, signal);
    return [];
  });
}

/**
 * 회원 N명에게 기관 초대 발송(즉시 배정 아님 — 수락 시 소속 적용, 만료 기본 7일).
 * 실제 초대된 수 반환(기소속/유효 pending/탈퇴는 서버 스킵). mock 경로는 요청 수를 그대로 성공 처리.
 */
export function inviteInstitutionMembersSafe(
  userIds: string[],
  code: string,
  reason: string,
  expiresInDays: number = 7,
  signal?: AbortSignal
) {
  return toSafeResult<number>(async () => {
    if (isSupabaseSource) {
      return inviteInstitutionMembersViaRpc(userIds, code, reason, expiresInDays, signal);
    }
    await sleep(200, signal);
    return userIds.length;
  });
}

/** 기관 초대 목록(코드/회원/상태 필터). mock 경로는 빈 목록(정적 시드라 초대 없음). */
export function fetchInstitutionInvitationsSafe(
  filter: { code?: string; userId?: string; status?: InstitutionInvitationStatus },
  signal?: AbortSignal
) {
  return toSafeResult<InstitutionInvitation[]>(async () => {
    if (isSupabaseSource) {
      return loadInstitutionInvitationsFromSupabase(filter, signal);
    }
    await sleep(200, signal);
    return [];
  });
}

/** pending 기관 초대 취소. mock 경로는 no-op 성공 처리. */
export function cancelInstitutionInvitationSafe(
  invitationId: string,
  reason: string,
  signal?: AbortSignal
) {
  return toSafeResult<string>(async () => {
    if (isSupabaseSource) {
      return cancelInstitutionInvitationViaRpc(invitationId, reason, signal);
    }
    await sleep(200, signal);
    return invitationId;
  });
}

/** 회원 N명의 코드 소속 해제. 변경된 회원 수 반환. mock 경로는 요청 수를 그대로 성공 처리. */
export function clearInstitutionCodeSafe(
  userIds: string[],
  reason: string,
  signal?: AbortSignal
) {
  return toSafeResult<number>(async () => {
    if (isSupabaseSource) {
      return clearInstitutionCodeViaRpc(userIds, reason, signal);
    }
    await sleep(200, signal);
    return userIds.length;
  });
}
