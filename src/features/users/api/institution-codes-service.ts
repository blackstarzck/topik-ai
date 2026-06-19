import type {
  InstitutionCode,
  InstitutionCodeKind,
  InstitutionCodeStatus
} from '../model/institution-codes-types';
import { mockInstitutionCodes } from './mock-institution-codes';
import { toSafeResult, withRetry } from '../../../shared/api/safe-request';
import { institutionCodesDataSource } from './institution-codes-data-source';
import {
  createInstitutionCodeViaRpc,
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
