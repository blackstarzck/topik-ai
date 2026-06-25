import { toSafeResult, withRetry } from '../../../shared/api/safe-request';
import { institutionCodesDataSource } from './institution-codes-data-source';
import {
  addInstitutionQuestionsViaRpc,
  loadInstitutionQuestionsFromSupabase,
  removeInstitutionQuestionsViaRpc
} from './supabase-institution-questions-service';
import {
  addMockInstitutionQuestions,
  loadMockInstitutionQuestions,
  removeMockInstitutionQuestions
} from './mock-institution-questions';
import type {
  InstitutionExposableQuestion,
  InstitutionQuestionMutationPayload,
  InstitutionQuestionMutationResult
} from '../model/institution-questions-types';

/**
 * 기관 중심 노출 문항 facade — 회원>기관 코드 모달은 이 모듈만 호출한다.
 * institution-codes-data-source 스위치를 재사용해 supabase/mock을 분기한다.
 * add/remove는 institution_code=X 에만 작용(다른 기관 매핑 보존), 사유 필수.
 */
const isSupabaseSource = institutionCodesDataSource === 'supabase';

async function loadQuestions(
  code: string,
  signal?: AbortSignal
): Promise<InstitutionExposableQuestion[]> {
  if (isSupabaseSource) {
    return loadInstitutionQuestionsFromSupabase(code, signal);
  }
  return loadMockInstitutionQuestions(code);
}

async function addQuestions(
  payload: InstitutionQuestionMutationPayload
): Promise<InstitutionQuestionMutationResult> {
  if (!payload.reason.trim()) {
    throw new Error('기관 노출 변경 사유를 입력해 주세요.');
  }
  if (payload.questionIds.length === 0) {
    throw new Error('대상 문항을 선택해 주세요.');
  }
  if (isSupabaseSource) {
    return addInstitutionQuestionsViaRpc(
      payload.institutionCode,
      payload.questionIds,
      payload.reason
    );
  }
  return addMockInstitutionQuestions(payload.institutionCode, payload.questionIds);
}

async function removeQuestions(
  payload: InstitutionQuestionMutationPayload
): Promise<InstitutionQuestionMutationResult> {
  if (!payload.reason.trim()) {
    throw new Error('기관 노출 변경 사유를 입력해 주세요.');
  }
  if (payload.questionIds.length === 0) {
    throw new Error('대상 문항을 선택해 주세요.');
  }
  if (isSupabaseSource) {
    return removeInstitutionQuestionsViaRpc(
      payload.institutionCode,
      payload.questionIds,
      payload.reason
    );
  }
  return removeMockInstitutionQuestions(payload.institutionCode, payload.questionIds);
}

export function fetchInstitutionQuestionsSafe(code: string, signal?: AbortSignal) {
  return toSafeResult(() =>
    withRetry(() => loadQuestions(code, signal), { maxRetries: 1 })
  );
}

export function addInstitutionQuestionsSafe(payload: InstitutionQuestionMutationPayload) {
  return toSafeResult(() => addQuestions(payload));
}

export function removeInstitutionQuestionsSafe(payload: InstitutionQuestionMutationPayload) {
  return toSafeResult(() => removeQuestions(payload));
}
