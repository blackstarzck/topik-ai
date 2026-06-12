import { toSafeResult, withRetry } from '../../../shared/api/safe-request';
import { questionBankDataSource } from './question-bank-data-source';
import {
  loadLegacyDetail,
  loadLegacySummaries
} from './supabase-assessment-question-bank-service';
import {
  assignMockQuestionTag,
  loadMockActiveQuestionTags,
  loadMockDetail,
  loadMockSummaries,
  loadMockTagMaster,
  loadMockTagMasterCatalog,
  loadMockTopicMaster,
  loadMockTopicMasterCatalog,
  removeMockQuestionTag,
  setMockServiceStatus,
  setMockTagMasterStatus
} from './mock-question-bank-service';
import {
  assignTopikWritingQuestionTag,
  loadTopikWritingActiveQuestionTags,
  loadTopikWritingDetail,
  loadTopikWritingSummaries,
  loadTopikWritingTagMaster,
  loadTopikWritingTagMasterCatalog,
  loadTopikWritingTopicMaster,
  loadTopikWritingTopicMasterCatalog,
  removeTopikWritingQuestionTag,
  setTopikWritingServiceStatus,
  setTopikWritingTagMasterStatus
} from './topik-writing-question-bank-service';
import type {
  AssessmentQuestionDetail,
  AssessmentQuestionSummary,
  AssessmentServiceStatus,
  TopikWritingQuestionTagRow,
  TopikWritingTagMasterCatalogRow,
  TopikWritingTagMasterRow,
  TopikWritingTopicMasterCatalogRow,
  TopikWritingTopicMasterRow
} from '../model/assessment-question-bank-types';

/**
 * Facade — 페이지는 이 모듈만 호출한다. 실제 경로는 데이터 소스 스위치
 * (question-bank-data-source.ts)가 결정한다: topik_writing(신규 스키마, 기본) /
 * legacy(구 problems, 봉인 롤백 경로) / mock(D-12 — Supabase 미구성 시).
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

type AssignQuestionTagPayload = {
  questionId: string;
  tagCode: string;
};

type RemoveQuestionTagPayload = {
  tagAssignmentId: number;
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
  if (questionBankDataSource === 'topik_writing') {
    return loadTopikWritingSummaries(signal);
  }
  return loadLegacySummaries(signal);
}

async function loadDetail(
  questionId: string,
  signal?: AbortSignal
): Promise<AssessmentQuestionDetail> {
  if (questionBankDataSource === 'mock') {
    return loadMockDetail(questionId);
  }
  if (questionBankDataSource === 'topik_writing') {
    return loadTopikWritingDetail(questionId, signal);
  }
  return loadLegacyDetail(questionId, signal);
}

async function loadTopicMaster(
  signal?: AbortSignal
): Promise<TopikWritingTopicMasterRow[]> {
  if (questionBankDataSource === 'mock') {
    return loadMockTopicMaster();
  }
  if (questionBankDataSource === 'topik_writing') {
    return loadTopikWritingTopicMaster(signal);
  }
  // legacy: 17주제 마스터는 신규 스키마 전용 — 폐기 예정 8값 축으로 대체 표시.
  return ['생활', '학습', '사회', '문화', '경제', '교육', '환경', '기술'].map(
    (topicMain, index) => ({ topicMain, topicDetail: '', sortOrder: index + 1 })
  );
}

async function loadTagMaster(
  signal?: AbortSignal
): Promise<TopikWritingTagMasterRow[]> {
  if (questionBankDataSource === 'mock') {
    return loadMockTagMaster();
  }
  if (questionBankDataSource === 'topik_writing') {
    const rows = await loadTopikWritingTagMaster(signal);
    // D-6 방어: '서비스_노출상태' 그룹은 시드 제외가 원칙이지만, 사전에 끼어
    // 들어도 부여 옵션으로 노출하지 않는다(부여 차단은 RPC에도 내장).
    return rows.filter((row) => row.tagGroup !== '서비스_노출상태');
  }
  return [];
}

/**
 * P5-1 마스터 카탈로그(전수·비활성 포함) — /system/metadata 읽기 전용 조회
 * surface 전용. legacy 모드는 마스터 테이블이 없으므로 빈 배열(화면 empty
 * state)로 처리한다.
 */
async function loadTopicMasterCatalog(
  signal?: AbortSignal
): Promise<TopikWritingTopicMasterCatalogRow[]> {
  if (questionBankDataSource === 'mock') {
    return loadMockTopicMasterCatalog();
  }
  if (questionBankDataSource === 'topik_writing') {
    return loadTopikWritingTopicMasterCatalog(signal);
  }
  return [];
}

async function loadTagMasterCatalog(
  signal?: AbortSignal
): Promise<TopikWritingTagMasterCatalogRow[]> {
  if (questionBankDataSource === 'mock') {
    return loadMockTagMasterCatalog();
  }
  if (questionBankDataSource === 'topik_writing') {
    return loadTopikWritingTagMasterCatalog(signal);
  }
  return [];
}

async function loadActiveQuestionTags(
  signal?: AbortSignal
): Promise<TopikWritingQuestionTagRow[]> {
  if (questionBankDataSource === 'mock') {
    return loadMockActiveQuestionTags();
  }
  if (questionBankDataSource === 'topik_writing') {
    return loadTopikWritingActiveQuestionTags(signal);
  }
  return [];
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
  } else if (questionBankDataSource === 'topik_writing') {
    await setTopikWritingServiceStatus(
      payload.questionId,
      payload.nextStatus,
      payload.reason
    );
  } else {
    // legacy: 구 스키마에 물리 노출 상태가 없다 — 롤백 모드에서는 쓰기 불가.
    throw new Error('legacy 롤백 모드에서는 노출 상태를 변경할 수 없습니다.');
  }
  return loadDetail(payload.questionId, signal);
}

async function assignQuestionTag(payload: AssignQuestionTagPayload): Promise<void> {
  if (questionBankDataSource === 'mock') {
    await assignMockQuestionTag(payload.questionId, payload.tagCode);
    return;
  }
  if (questionBankDataSource === 'topik_writing') {
    await assignTopikWritingQuestionTag(payload.questionId, payload.tagCode);
    return;
  }
  throw new Error('legacy 롤백 모드에서는 태그를 편집할 수 없습니다.');
}

async function removeQuestionTag(payload: RemoveQuestionTagPayload): Promise<void> {
  if (questionBankDataSource === 'mock') {
    await removeMockQuestionTag(payload.tagAssignmentId);
    return;
  }
  if (questionBankDataSource === 'topik_writing') {
    await removeTopikWritingQuestionTag(payload.tagAssignmentId);
    return;
  }
  throw new Error('legacy 롤백 모드에서는 태그를 편집할 수 없습니다.');
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
  if (questionBankDataSource === 'topik_writing') {
    await setTopikWritingTagMasterStatus(
      payload.tagCode,
      payload.nextActive,
      payload.reason
    );
    return;
  }
  throw new Error('legacy 롤백 모드에서는 태그 마스터를 변경할 수 없습니다.');
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

export function assignQuestionTagSafe(payload: AssignQuestionTagPayload) {
  return toSafeResult(() => assignQuestionTag(payload));
}

export function removeQuestionTagSafe(payload: RemoveQuestionTagPayload) {
  return toSafeResult(() => removeQuestionTag(payload));
}
