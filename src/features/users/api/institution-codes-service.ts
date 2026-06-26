import type {
  InstitutionCode,
  InstitutionCodeKind,
  InstitutionCodeMember,
  InstitutionCodeStatus
} from '../model/institution-codes-types';
import { mockInstitutionCodes } from './mock-institution-codes';
import { toSafeResult, withRetry } from '../../../shared/api/safe-request';
import { institutionCodesDataSource } from './institution-codes-data-source';
import {
  assignInstitutionCodeViaRpc,
  clearInstitutionCodeViaRpc,
  createInstitutionCodeViaRpc,
  deleteInstitutionCodeViaRpc,
  loadInstitutionCodeMembersFromSupabase,
  loadInstitutionCodesFromSupabase,
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

async function loadInstitutionCodes(signal?: AbortSignal): Promise<InstitutionCode[]> {
  if (isSupabaseSource) {
    return loadInstitutionCodesFromSupabase(undefined, null, signal);
  }

  await sleep(280, signal);
  return mockInstitutionCodes;
}

async function persistCreate(
  payload: CreateInstitutionCodePayload,
  signal?: AbortSignal
): Promise<string> {
  if (isSupabaseSource) {
    return createInstitutionCodeViaRpc(payload, signal);
  }

  // mock 경로: 정적 시드라 영속화 없음. 화면이 로컬 상태로 시각 반영한다.
  await sleep(200, signal);
  return payload.code.trim();
}

async function persistUpdate(
  payload: UpdateInstitutionCodePayload,
  signal?: AbortSignal
): Promise<string> {
  if (isSupabaseSource) {
    return updateInstitutionCodeViaRpc(payload, signal);
  }

  await sleep(200, signal);
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
  return payload.code;
}

export function fetchInstitutionCodesSafe(signal?: AbortSignal) {
  return toSafeResult(() =>
    withRetry(() => loadInstitutionCodes(signal), { maxRetries: 1 })
  );
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

/** 회원 N명을 코드에 배정. 변경된 회원 수 반환. mock 경로는 요청 수를 그대로 성공 처리. */
export function assignInstitutionCodeSafe(
  userIds: string[],
  code: string,
  reason: string,
  signal?: AbortSignal
) {
  return toSafeResult<number>(async () => {
    if (isSupabaseSource) {
      return assignInstitutionCodeViaRpc(userIds, code, reason, signal);
    }
    await sleep(200, signal);
    return userIds.length;
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
