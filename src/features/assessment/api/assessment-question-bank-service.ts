import { toSafeResult, withRetry } from '../../../shared/api/safe-request';
import { questionBankDataSource } from './question-bank-data-source';
import {
  assignMockQuestionTag,
  clearMockQuestionInstitutions,
  loadMockActiveQuestionTags,
  loadMockDetail,
  loadMockQuestionInstitutions,
  loadMockSummaries,
  loadMockTagMaster,
  loadMockTagMasterCatalog,
  loadMockTopicMaster,
  loadMockTopicMasterCatalog,
  removeMockQuestionTag,
  setMockQuestionInstitutions,
  setMockServiceStatus,
  setMockServiceStatusBulk,
  setMockTagMasterStatus
} from './mock-question-bank-service';
import {
  assignTopikWritingQuestionTag,
  clearTopikWritingQuestionInstitutions,
  loadTopikWritingActiveQuestionTags,
  loadTopikWritingDetail,
  loadTopikWritingQuestionInstitutions,
  loadTopikWritingSummaries,
  loadTopikWritingTagMaster,
  loadTopikWritingTagMasterCatalog,
  loadTopikWritingTopicMaster,
  loadTopikWritingTopicMasterCatalog,
  removeTopikWritingQuestionTag,
  setTopikWritingQuestionInstitutions,
  setTopikWritingServiceStatus,
  setTopikWritingServiceStatusBulk,
  setTopikWritingTagMasterStatus
} from './topik-writing-question-bank-service';
import type {
  AssessmentQuestionDetail,
  AssessmentQuestionSummary,
  AssessmentServiceStatus,
  BulkServiceStatusResult,
  TopikWritingQuestionTagRow,
  TopikWritingTagMasterCatalogRow,
  TopikWritingTagMasterRow,
  TopikWritingTopicMasterCatalogRow,
  TopikWritingTopicMasterRow,
  WritingQuestionInstitutionRow
} from '../model/assessment-question-bank-types';

/**
 * Facade — 페이지는 이 모듈만 호출한다. 실제 경로는 데이터 소스 스위치
 * (question-bank-data-source.ts)가 결정한다: topik_writing(canonical 운영 경로) /
 * mock(D-12 — Supabase 미구성 시).
 *
 * 인바운드 모델(결정 기록 §0): 조회 + 관리 포인트 — 노출 통제(service_status)
 * + 태그 부여/제거 — 를 제공한다(P4 개방, 실행계획안 §8). 검수 쓰기·검수
 * 메모는 2026-06-11 검수 개념 삭제로 제거됐다. 모든 write는 RPC 경유
 * (admin_update_topik_question / admin_assign·remove_question_tag — D-8 감사
 * 계약)이다. 태그 RPC의 서버 가드는 '서비스_노출상태' 그룹 부여 차단,
 * 중복 활성 부여 차단을 담당한다(D-6).
 */

type UpdateAssessmentQuestionServiceStatusPayload = {
  questionId: string;
  nextStatus: AssessmentServiceStatus;
  reason: string;
};

type BulkUpdateAssessmentQuestionServiceStatusPayload = {
  questionIds: string[];
  nextStatus: AssessmentServiceStatus;
  reason: string;
};

type AssignQuestionTagPayload = {
  questionId: string;
  tagCode: string;
};

type RemoveQuestionTagPayload = {
  tagAssignmentId: number;
};

type SetWritingQuestionInstitutionsPayload = {
  questionIds: string[];
  institutionCodes: string[];
  reason: string;
};

type ClearWritingQuestionInstitutionsPayload = {
  questionIds: string[];
  reason: string;
};

type UpdateTagMasterStatusPayload = {
  tagCode: string;
  nextActive: boolean;
  reason: string;
};

async function loadSummaries(signal?: AbortSignal): Promise<AssessmentQuestionSummary[]> {
  if (questionBankDataSource === 'mock') {
    return loadMockSummaries();
  }
  return loadTopikWritingSummaries(signal);
}

async function loadDetail(
  questionId: string,
  signal?: AbortSignal
): Promise<AssessmentQuestionDetail> {
  if (questionBankDataSource === 'mock') {
    return loadMockDetail(questionId);
  }
  return loadTopikWritingDetail(questionId, signal);
}

async function loadTopicMaster(
  signal?: AbortSignal
): Promise<TopikWritingTopicMasterRow[]> {
  if (questionBankDataSource === 'mock') {
    return loadMockTopicMaster();
  }
  return loadTopikWritingTopicMaster(signal);
}

async function loadTagMaster(
  signal?: AbortSignal
): Promise<TopikWritingTagMasterRow[]> {
  if (questionBankDataSource === 'mock') {
    return loadMockTagMaster();
  }
  const rows = await loadTopikWritingTagMaster(signal);
  // D-6 방어: '서비스_노출상태' 그룹은 시드 제외가 원칙이지만, 사전에 끼어
  // 들어도 부여 옵션으로 노출하지 않는다(부여 차단은 RPC에도 내장).
  return rows.filter((row) => row.tagGroup !== '서비스_노출상태');
}

/**
 * P5-1 마스터 카탈로그(전수·비활성 포함) — /system/metadata 읽기 전용 조회
 * surface 전용.
 */
async function loadTopicMasterCatalog(
  signal?: AbortSignal
): Promise<TopikWritingTopicMasterCatalogRow[]> {
  if (questionBankDataSource === 'mock') {
    return loadMockTopicMasterCatalog();
  }
  return loadTopikWritingTopicMasterCatalog(signal);
}

async function loadTagMasterCatalog(
  signal?: AbortSignal
): Promise<TopikWritingTagMasterCatalogRow[]> {
  if (questionBankDataSource === 'mock') {
    return loadMockTagMasterCatalog();
  }
  return loadTopikWritingTagMasterCatalog(signal);
}

async function loadActiveQuestionTags(
  signal?: AbortSignal
): Promise<TopikWritingQuestionTagRow[]> {
  if (questionBankDataSource === 'mock') {
    return loadMockActiveQuestionTags();
  }
  return loadTopikWritingActiveQuestionTags(signal);
}

async function updateServiceStatus(
  payload: UpdateAssessmentQuestionServiceStatusPayload,
  signal?: AbortSignal
): Promise<AssessmentQuestionDetail> {
  if (signal?.aborted) {
    throw new DOMException('Request aborted', 'AbortError');
  }

  if (!payload.reason.trim()) {
    throw new Error('노출 상태 변경 사유를 입력해 주세요.');
  }

  if (questionBankDataSource === 'mock') {
    await setMockServiceStatus(payload.questionId, payload.nextStatus);
  } else {
    await setTopikWritingServiceStatus(
      payload.questionId,
      payload.nextStatus,
      payload.reason
    );
  }
  return loadDetail(payload.questionId, signal);
}

/**
 * 운영 조치 일괄 처리 — 선택 문항 N건의 노출 상태를 한 번에 변경한다(P1: 숨김
 * 방향 노출 제외/내부 테스트부터). 사유 필수·문항별 격리·멱등·노출 게이트·감사는
 * RPC가 책임지고, mock은 화면 수준에서 결과 shape만 재현한다(감사 미기록).
 */
async function updateServiceStatusBulk(
  payload: BulkUpdateAssessmentQuestionServiceStatusPayload
): Promise<BulkServiceStatusResult> {
  if (!payload.reason.trim()) {
    throw new Error('노출 상태 변경 사유를 입력해 주세요.');
  }
  if (payload.questionIds.length === 0) {
    throw new Error('대상 문항을 선택해 주세요.');
  }

  if (questionBankDataSource === 'mock') {
    return setMockServiceStatusBulk(payload.questionIds, payload.nextStatus);
  }
  return setTopikWritingServiceStatusBulk(
    payload.questionIds,
    payload.nextStatus,
    payload.reason
  );
}

async function assignQuestionTag(payload: AssignQuestionTagPayload): Promise<void> {
  if (questionBankDataSource === 'mock') {
    await assignMockQuestionTag(payload.questionId, payload.tagCode);
    return;
  }
  await assignTopikWritingQuestionTag(payload.questionId, payload.tagCode);
}

async function removeQuestionTag(payload: RemoveQuestionTagPayload): Promise<void> {
  if (questionBankDataSource === 'mock') {
    await removeMockQuestionTag(payload.tagAssignmentId);
    return;
  }
  await removeTopikWritingQuestionTag(payload.tagAssignmentId);
}

/**
 * 기관별 노출 매핑 — 문항 N건의 허용 기관 집합을 동기화(set)하거나 전부 제거(clear)
 * 한다(공개 기본 + 기관 한정). 사유 필수·문항별 격리·멱등·감사는 RPC가 책임지고,
 * mock은 결과 shape만 재현한다(감사 미기록). 단건/일괄 공용(questionIds 배열).
 */
async function loadQuestionInstitutions(
  questionId?: string,
  signal?: AbortSignal
): Promise<WritingQuestionInstitutionRow[]> {
  if (questionBankDataSource === 'mock') {
    return loadMockQuestionInstitutions(questionId);
  }
  return loadTopikWritingQuestionInstitutions(questionId, signal);
}

async function setQuestionInstitutions(
  payload: SetWritingQuestionInstitutionsPayload
): Promise<BulkServiceStatusResult> {
  if (!payload.reason.trim()) {
    throw new Error('기관 노출 변경 사유를 입력해 주세요.');
  }
  if (payload.questionIds.length === 0) {
    throw new Error('대상 문항을 선택해 주세요.');
  }

  if (questionBankDataSource === 'mock') {
    return setMockQuestionInstitutions(
      payload.questionIds,
      payload.institutionCodes,
      payload.reason
    );
  }
  return setTopikWritingQuestionInstitutions(
    payload.questionIds,
    payload.institutionCodes,
    payload.reason
  );
}

async function clearQuestionInstitutions(
  payload: ClearWritingQuestionInstitutionsPayload
): Promise<BulkServiceStatusResult> {
  if (!payload.reason.trim()) {
    throw new Error('기관 노출 변경 사유를 입력해 주세요.');
  }
  if (payload.questionIds.length === 0) {
    throw new Error('대상 문항을 선택해 주세요.');
  }

  if (questionBankDataSource === 'mock') {
    return clearMockQuestionInstitutions(payload.questionIds);
  }
  return clearTopikWritingQuestionInstitutions(payload.questionIds, payload.reason);
}

export function fetchAssessmentQuestionSummariesSafe(signal?: AbortSignal) {
  return toSafeResult(() =>
    withRetry(() => loadSummaries(signal), { maxRetries: 1 })
  );
}

export function fetchAssessmentQuestionDetailSafe(
  questionId: string,
  signal?: AbortSignal
) {
  return toSafeResult(() =>
    withRetry(() => loadDetail(questionId, signal), { maxRetries: 1 })
  );
}

export function fetchQuestionBankTopicMasterSafe(signal?: AbortSignal) {
  return toSafeResult(() =>
    withRetry(() => loadTopicMaster(signal), { maxRetries: 1 })
  );
}

export function fetchQuestionBankTagMasterSafe(signal?: AbortSignal) {
  return toSafeResult(() =>
    withRetry(() => loadTagMaster(signal), { maxRetries: 1 })
  );
}

/**
 * P5-3 태그 마스터 활성/비활성 토글 — platform_admin 전용 RPC
 * `admin_update_tag_master_status` 경유(가드·감사는 RPC 내장). 사유 필수.
 */
async function updateTagMasterStatus(
  payload: UpdateTagMasterStatusPayload
): Promise<void> {
  if (!payload.reason.trim()) {
    throw new Error('태그 마스터 상태 변경 사유를 입력해 주세요.');
  }

  if (questionBankDataSource === 'mock') {
    await setMockTagMasterStatus(payload.tagCode, payload.nextActive);
    return;
  }
  await setTopikWritingTagMasterStatus(
    payload.tagCode,
    payload.nextActive,
    payload.reason
  );
}

export function updateTagMasterStatusSafe(payload: UpdateTagMasterStatusPayload) {
  return toSafeResult(() => updateTagMasterStatus(payload));
}

export function fetchQuestionBankTopicMasterCatalogSafe(signal?: AbortSignal) {
  return toSafeResult(() =>
    withRetry(() => loadTopicMasterCatalog(signal), { maxRetries: 1 })
  );
}

export function fetchQuestionBankTagMasterCatalogSafe(signal?: AbortSignal) {
  return toSafeResult(() =>
    withRetry(() => loadTagMasterCatalog(signal), { maxRetries: 1 })
  );
}

export function fetchQuestionBankActiveTagsSafe(signal?: AbortSignal) {
  return toSafeResult(() =>
    withRetry(() => loadActiveQuestionTags(signal), { maxRetries: 1 })
  );
}

export function updateAssessmentQuestionServiceStatusSafe(
  payload: UpdateAssessmentQuestionServiceStatusPayload,
  signal?: AbortSignal
) {
  return toSafeResult(() => updateServiceStatus(payload, signal));
}

export function updateAssessmentQuestionServiceStatusBulkSafe(
  payload: BulkUpdateAssessmentQuestionServiceStatusPayload
) {
  return toSafeResult(() => updateServiceStatusBulk(payload));
}

export function assignQuestionTagSafe(payload: AssignQuestionTagPayload) {
  return toSafeResult(() => assignQuestionTag(payload));
}

export function removeQuestionTagSafe(payload: RemoveQuestionTagPayload) {
  return toSafeResult(() => removeQuestionTag(payload));
}

export function fetchWritingQuestionInstitutionsSafe(
  questionId?: string,
  signal?: AbortSignal
) {
  return toSafeResult(() =>
    withRetry(() => loadQuestionInstitutions(questionId, signal), { maxRetries: 1 })
  );
}

export function setWritingQuestionInstitutionsSafe(
  payload: SetWritingQuestionInstitutionsPayload
) {
  return toSafeResult(() => setQuestionInstitutions(payload));
}

export function clearWritingQuestionInstitutionsSafe(
  payload: ClearWritingQuestionInstitutionsPayload
) {
  return toSafeResult(() => clearQuestionInstitutions(payload));
}
