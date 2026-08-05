import type {
  InstitutionContract,
  InstitutionContractStatusSummary,
  InstitutionExposureOptions,
  InstitutionSettings
} from '../model/institution-contracts-types';
import { institutionCodesDataSource } from './institution-codes-data-source';
import {
  addMockContract,
  isMockContractActive,
  listMockContracts,
  mockContractStatusFor,
  mockSettingsFor,
  patchMockExposureOption,
  patchMockInstitutionSettings,
  removeMockContract,
  resolveMockExposureOptions,
  updateMockContract
} from './mock-institution-contracts';
import { mockInstitutionCodes } from './mock-institution-codes';
import {
  createInstitutionContractViaRpc,
  deleteInstitutionContractViaRpc,
  inviteInstitutionMembersGuardedViaRpc,
  loadInstitutionContractStatusFromSupabase,
  loadInstitutionContractsFromSupabase,
  loadInstitutionExposureOptionsFromSupabase,
  loadInstitutionSettingsFromSupabase,
  setInstitutionAutoAssignViaRpc,
  setInstitutionAutoHideViaRpc,
  updateInstitutionContractViaRpc,
  updateInstitutionSettingsViaRpc
} from './supabase-institution-contracts-service';
import { toSafeResult, withRetry } from '../../../shared/api/safe-request';

/**
 * 기관 계약·운영 설정 파사드.
 *
 * 사유(reason) 필수 검증을 여기서 한다 — 서버도 검증하지만 왕복 전에 막으면 운영자가
 * 왜 실패했는지 즉시 알 수 있고 감사 잡음도 생기지 않는다(`institution-questions-service`
 * 의 선례와 같은 자리).
 *
 * mock 경로는 no-op 이 아니라 **DB 계약을 재현하는 in-memory 원장**을 쓴다. 겹침 거부·만료
 * 판정·연장 시 복구를 e2e 가 실제로 검증할 수 있어야 하기 때문이다.
 */

const isSupabaseSource = institutionCodesDataSource === 'supabase';

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

function requireReason(reason: string): string {
  const trimmed = reason.trim();
  if (!trimmed) {
    throw new Error('사유/근거를 입력해 주세요.');
  }
  return trimmed;
}

function mockMemberCount(code: string): number {
  return mockInstitutionCodes.find((row) => row.code === code)?.memberCount ?? 0;
}

export type UpsertInstitutionContractPayload = {
  code: string;
  startsOn: string;
  /** 빈 문자열 = 무기한. */
  endsOn: string;
  reason: string;
  note: string;
  docUrl: string;
};

export type InstitutionSettingsPayload = {
  code: string;
  maxMembers: number | null;
  defaultInviteExpiryDays: number | null;
  blockIntakeOnExpiry: boolean;
  contactName: string;
  contactEmail: string;
  reason: string;
};

export function fetchInstitutionContractsSafe(code: string, signal?: AbortSignal) {
  return toSafeResult<InstitutionContract[]>(() =>
    withRetry(
      async () => {
        if (isSupabaseSource) {
          return loadInstitutionContractsFromSupabase(code, signal);
        }
        await sleep(180, signal);
        return listMockContracts(code);
      },
      { maxRetries: 1 }
    )
  );
}

/**
 * 계약 상태 요약. `code` 가 null 이면 전 기관(목록 화면의 계약 컬럼용).
 * 목록은 코드 수십 건 규모라 한 번에 받아 화면에서 병합한다(모드 컬럼과 같은 방식).
 */
export function fetchInstitutionContractStatusSafe(
  code: string | null,
  signal?: AbortSignal
) {
  return toSafeResult<InstitutionContractStatusSummary[]>(() =>
    withRetry(
      async () => {
        if (isSupabaseSource) {
          return loadInstitutionContractStatusFromSupabase(code, signal);
        }
        await sleep(180, signal);
        const codes = code ? [code] : mockInstitutionCodes.map((row) => row.code);
        return codes.map((item) => mockContractStatusFor(item));
      },
      { maxRetries: 1 }
    )
  );
}

export function fetchInstitutionExposureOptionsSafe(code: string, signal?: AbortSignal) {
  return toSafeResult<InstitutionExposureOptions>(() =>
    withRetry(
      async () => {
        if (isSupabaseSource) {
          const rows = await loadInstitutionExposureOptionsFromSupabase(code, signal);
          return (
            rows.find((row) => row.code === code)
            ?? { code, autoHideOnExpiry: false, autoAssignNewQuestions: false }
          );
        }
        await sleep(150, signal);
        return resolveMockExposureOptions(code);
      },
      { maxRetries: 1 }
    )
  );
}

export function fetchInstitutionSettingsSafe(code: string, signal?: AbortSignal) {
  return toSafeResult<InstitutionSettings>(() =>
    withRetry(
      async () => {
        if (isSupabaseSource) {
          const rows = await loadInstitutionSettingsFromSupabase(code, signal);
          const found = rows.find((row) => row.code === code);
          if (found) {
            return found;
          }
          throw new Error(`기관 설정을 찾을 수 없습니다: ${code}`);
        }
        await sleep(180, signal);
        return mockSettingsFor(code, mockMemberCount(code));
      },
      { maxRetries: 1 }
    )
  );
}

export function createInstitutionContractSafe(
  payload: UpsertInstitutionContractPayload,
  signal?: AbortSignal
) {
  return toSafeResult<string>(async () => {
    const reason = requireReason(payload.reason);
    if (isSupabaseSource) {
      return createInstitutionContractViaRpc({ ...payload, reason }, signal);
    }
    await sleep(200, signal);
    return addMockContract({
      code: payload.code,
      startsOn: payload.startsOn,
      endsOn: payload.endsOn,
      docUrl: payload.docUrl.trim(),
      note: payload.note.trim()
    });
  });
}

export function updateInstitutionContractSafe(
  payload: UpsertInstitutionContractPayload & { contractId: string },
  signal?: AbortSignal
) {
  return toSafeResult<string>(async () => {
    const reason = requireReason(payload.reason);
    if (isSupabaseSource) {
      return updateInstitutionContractViaRpc(
        {
          contractId: payload.contractId,
          startsOn: payload.startsOn,
          endsOn: payload.endsOn,
          reason,
          note: payload.note,
          docUrl: payload.docUrl
        },
        signal
      );
    }
    await sleep(200, signal);
    return updateMockContract({
      contractId: payload.contractId,
      startsOn: payload.startsOn,
      endsOn: payload.endsOn,
      docUrl: payload.docUrl.trim(),
      note: payload.note.trim()
    });
  });
}

export function deleteInstitutionContractSafe(
  payload: { contractId: string; reason: string },
  signal?: AbortSignal
) {
  return toSafeResult<string>(async () => {
    const reason = requireReason(payload.reason);
    if (isSupabaseSource) {
      return deleteInstitutionContractViaRpc({ ...payload, reason }, signal);
    }
    await sleep(200, signal);
    return removeMockContract(payload.contractId);
  });
}

export function setInstitutionAutoHideSafe(
  payload: { code: string; enabled: boolean; reason: string },
  signal?: AbortSignal
) {
  return toSafeResult<string>(async () => {
    const reason = requireReason(payload.reason);
    if (isSupabaseSource) {
      return setInstitutionAutoHideViaRpc({ ...payload, reason }, signal);
    }
    await sleep(200, signal);
    patchMockExposureOption(payload.code, 'autoHideOnExpiry', payload.enabled);
    return payload.code;
  });
}

export function setInstitutionAutoAssignSafe(
  payload: { code: string; enabled: boolean; reason: string },
  signal?: AbortSignal
) {
  return toSafeResult<string>(async () => {
    const reason = requireReason(payload.reason);
    if (isSupabaseSource) {
      return setInstitutionAutoAssignViaRpc({ ...payload, reason }, signal);
    }
    await sleep(200, signal);
    patchMockExposureOption(payload.code, 'autoAssignNewQuestions', payload.enabled);
    return payload.code;
  });
}

export function updateInstitutionSettingsSafe(
  payload: InstitutionSettingsPayload,
  signal?: AbortSignal
) {
  return toSafeResult<string>(async () => {
    const reason = requireReason(payload.reason);
    if (isSupabaseSource) {
      return updateInstitutionSettingsViaRpc({ ...payload, reason }, signal);
    }
    await sleep(200, signal);
    // 서버는 정원을 현재 좌석 사용량 아래로 내리는 것을 거부한다 — mock 도 같은 방향으로
    // 막아 e2e 가 그 계약을 검증할 수 있게 한다.
    const seatsUsed = mockMemberCount(payload.code);
    if (payload.maxMembers !== null && payload.maxMembers < seatsUsed) {
      throw new Error(
        `max_members ${payload.maxMembers} is lower than current seat usage ${seatsUsed}`
      );
    }
    patchMockInstitutionSettings({
      code: payload.code,
      maxMembers: payload.maxMembers,
      defaultInviteExpiryDays: payload.defaultInviteExpiryDays,
      blockIntakeOnExpiry: payload.blockIntakeOnExpiry,
      contactName: payload.contactName.trim(),
      contactEmail: payload.contactEmail.trim()
    });
    return payload.code;
  });
}

/**
 * 정원·계약 차단 사전 검사를 포함한 초대 발송. 화면은 이 함수만 쓴다 — 구
 * `inviteInstitutionMembersSafe`(가드 없는 원함수 직행)를 남겨두면 어느 화면이 어느 경로를
 * 쓰는지가 흐려지고 정원이 조용히 우회된다.
 *
 * `expiresInDays` 가 null 이면 서버가 기관 설정의 기본값(없으면 전역 7일)으로 해석한다.
 * 화면이 7 을 채워 보내면 기관별 기본값 기능이 죽으므로 **모르면 null 을 보낸다**.
 */
export function inviteInstitutionMembersGuardedSafe(
  userIds: string[],
  code: string,
  reason: string,
  expiresInDays: number | null,
  signal?: AbortSignal
) {
  return toSafeResult<number>(async () => {
    const trimmed = requireReason(reason);
    if (isSupabaseSource) {
      return inviteInstitutionMembersGuardedViaRpc(
        userIds,
        code,
        trimmed,
        expiresInDays,
        signal
      );
    }
    await sleep(200, signal);
    // mock 도 서버와 같은 순서로 막는다: 만료 차단 → 정원.
    const settings = mockSettingsFor(code, mockMemberCount(code));
    if (settings.blockIntakeOnExpiry && !isMockContractActive(code)) {
      throw new Error(`institution ${code} has no active contract; member intake is blocked`);
    }
    if (settings.maxMembers !== null && settings.seatsUsed + userIds.length > settings.maxMembers) {
      throw new Error(
        `institution ${code} seat limit exceeded: ${settings.seatsUsed} used `
        + `+ ${userIds.length} requested > ${settings.maxMembers} allowed`
      );
    }
    return userIds.length;
  });
}

/**
 * 계약·정원·차단 관련 서버 오류를 운영자 언어로 바꾼다. 서버가 raw Postgres 메시지를
 * 던지므로 화면에 그대로 노출하지 않는다. 알려진 패턴이 아니면 원문을 유지한다 —
 * 삼켜 버리면 예상 못한 실패를 진단할 수 없다.
 */
export function translateInstitutionContractError(message: string): string {
  if (message.includes('overlaps an existing contract')) {
    return '계약 기간이 기존 계약과 겹칩니다. 같은 기관의 계약 기간은 겹칠 수 없습니다 — 히스토리에서 겹치는 계약을 먼저 확인해 주세요.';
  }
  if (message.includes('intake is blocked')) {
    return '이 기관은 계약이 만료됐고 "만료 시 배정·초대 차단" 옵션이 켜져 있어 신규 초대를 보낼 수 없습니다. 계약을 갱신하거나 차단 옵션을 해제해 주세요.';
  }
  if (message.includes('seat limit exceeded')) {
    return '정원을 초과합니다. 좌석은 소속 회원 + 만료되지 않은 대기 초대로 계산됩니다 — 정원을 늘리거나 대기 초대를 취소해 주세요.';
  }
  if (message.includes('lower than current seat usage')) {
    return '정원을 현재 좌석 사용량보다 낮게 설정할 수 없습니다. 회원 소속을 해제하거나 대기 초대를 취소한 뒤 다시 시도해 주세요.';
  }
  if (message.includes('ends_on must not be earlier')) {
    return '종료일이 시작일보다 이전입니다.';
  }
  if (message.includes('has no writing question assignment')) {
    return '이 기관에 배정된 문항이 0건입니다. 노출 문항 탭에서 먼저 배정해 주세요 — 배정이 없으면 소속 학습자에게 쓰기 문항이 하나도 보이지 않습니다.';
  }
  if (message.includes('missing permission')) {
    return '이 작업을 수행할 권한이 없습니다(users.institution-codes.manage).';
  }
  return message;
}
