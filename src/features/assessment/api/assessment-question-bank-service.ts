import { toSafeResult, withRetry } from '../../../shared/api/safe-request';
import { questionBankDataSource } from './question-bank-data-source';
import {
  loadLegacyDetail,
  loadLegacySummaries
} from './supabase-assessment-question-bank-service';
import {
  loadMockActiveQuestionTags,
  loadMockDetail,
  loadMockSummaries,
  loadMockTopicMaster,
  setMockServiceStatus
} from './mock-question-bank-service';
import {
  loadTopikWritingActiveQuestionTags,
  loadTopikWritingDetail,
  loadTopikWritingSummaries,
  loadTopikWritingTopicMaster,
  setTopikWritingServiceStatus
} from './topik-writing-question-bank-service';
import type {
  AssessmentQuestionDetail,
  AssessmentQuestionSummary,
  AssessmentServiceStatus,
  TopikWritingQuestionTagRow,
  TopikWritingTopicMasterRow
} from '../model/assessment-question-bank-types';

/**
 * Facade — 페이지는 이 모듈만 호출한다. 실제 경로는 데이터 소스 스위치
 * (question-bank-data-source.ts)가 결정한다: topik_writing(신규 스키마, 기본) /
 * legacy(구 problems, 봉인 롤백 경로) / mock(D-12 — Supabase 미구성 시).
 *
 * 인바운드 모델(결정 기록 §0): 조회 + 노출 통제(service_status — P4 개방)만
 * 제공한다. 검수 쓰기·검수 메모는 2026-06-11 검수 개념 삭제로 제거됐다.
 * 태그 부여/제거는 P4에서 결선한다(admin_assign/remove_question_tag RPC 존재).
 */

/**
 * P4 게이트 (D-6, 실행계획안 §8): service_status write는 P4(관리 포인트 개방)
 * 에서 이 플래그 제거와 함께 활성화한다. RPC·어댑터 경로는 결선돼 있다.
 */
const SERVICE_STATUS_WRITE_ENABLED = false;

type UpdateAssessmentQuestionServiceStatusPayload = {
  questionId: string;
  nextStatus: AssessmentServiceStatus;
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

  if (!SERVICE_STATUS_WRITE_ENABLED) {
    throw new Error('노출 상태(service_status) 변경은 P4 관리 포인트 개방에서 활성화됩니다.');
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
