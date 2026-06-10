import { toSafeResult, withRetry } from '../../../shared/api/safe-request';
import { questionBankDataSource } from './question-bank-data-source';
import {
  loadLegacyDetail,
  loadLegacySummaries,
  setLegacyReviewAction
} from './supabase-assessment-question-bank-service';
import {
  loadMockActiveQuestionTags,
  loadMockDetail,
  loadMockSummaries,
  loadMockTopicMaster,
  saveMockReviewMemo,
  setMockReviewAction
} from './mock-question-bank-service';
import {
  loadTopikWritingActiveQuestionTags,
  loadTopikWritingDetail,
  loadTopikWritingSummaries,
  loadTopikWritingTopicMaster,
  saveTopikWritingReviewMemo,
  setTopikWritingReviewAction
} from './topik-writing-question-bank-service';
import type {
  AssessmentQuestionDetail,
  AssessmentQuestionSummary,
  AssessmentReviewAction,
  AssessmentServiceStatus,
  TopikWritingQuestionTagRow,
  TopikWritingTopicMasterRow
} from '../model/assessment-question-bank-types';

/**
 * Facade — 페이지는 이 모듈만 호출한다. 실제 경로는 P3 컷오버 스위치
 * (question-bank-data-source.ts)가 결정한다: topik_writing(신규 스키마) /
 * legacy(구 problems, 봉인 롤백 경로) / mock(D-12 — Supabase 미구성 시).
 */

type UpdateAssessmentQuestionReviewPayload = {
  questionId: string;
  action: AssessmentReviewAction;
  reason: string;
};

type SaveAssessmentQuestionReviewMemoPayload = {
  questionId: string;
  memo: string;
};

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

async function updateReview(
  payload: UpdateAssessmentQuestionReviewPayload,
  signal?: AbortSignal
): Promise<AssessmentQuestionDetail> {
  if (questionBankDataSource === 'mock') {
    await setMockReviewAction(payload.questionId, payload.action);
  } else if (questionBankDataSource === 'topik_writing') {
    await setTopikWritingReviewAction(payload.questionId, payload.action, payload.reason);
  } else {
    await setLegacyReviewAction(payload.questionId, payload.action);
  }
  return loadDetail(payload.questionId, signal);
}

async function saveReviewMemo(
  payload: SaveAssessmentQuestionReviewMemoPayload,
  signal?: AbortSignal
): Promise<AssessmentQuestionDetail> {
  if (questionBankDataSource === 'mock') {
    await saveMockReviewMemo(payload.questionId, payload.memo);
    return loadDetail(payload.questionId, signal);
  }
  if (questionBankDataSource === 'topik_writing') {
    // D-7: content_team_memo 실영속 + 감사 payload.review_note 동일 본문.
    await saveTopikWritingReviewMemo(payload.questionId, payload.memo);
    return loadDetail(payload.questionId, signal);
  }
  // legacy: 구 스키마에 메모 영속 컬럼이 없다 — 화면 상태로만 유지(알려진 가짜
  // 저장, P3 컷오버가 해소). 동작 보존을 위해 재조회 후 로컬 적용한다.
  const detail = await loadDetail(payload.questionId, signal);
  return { ...detail, contentTeamMemo: payload.memo };
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
  void payload;

  if (signal?.aborted) {
    throw new DOMException('Request aborted', 'AbortError');
  }

  // P4 게이트: service_status write는 P4(운영 쓰기 개방)에서 OPERATION_WRITE_ENABLED
  // 제거와 함께 활성화한다(D-6). RPC(admin_update_topik_question)는 이미 지원한다.
  throw new Error('운영 상태(service_status) 변경은 P4 운영 쓰기 개방에서 활성화됩니다.');
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

export function updateAssessmentQuestionReviewSafe(
  payload: UpdateAssessmentQuestionReviewPayload,
  signal?: AbortSignal
) {
  return toSafeResult(() => updateReview(payload, signal));
}

export function saveAssessmentQuestionReviewMemoSafe(
  payload: SaveAssessmentQuestionReviewMemoPayload,
  signal?: AbortSignal
) {
  return toSafeResult(() => saveReviewMemo(payload, signal));
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
