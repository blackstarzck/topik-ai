import { toSafeResult, withRetry } from '../../../shared/api/safe-request';
import {
  loadAssessmentQuestionFromSupabase,
  loadAssessmentQuestionsFromSupabase,
  setReviewStatusViaRpc
} from './supabase-assessment-question-bank-service';
import type {
  AssessmentQuestion,
  AssessmentQuestionOperationStatus,
  AssessmentQuestionReviewStatus
} from '../model/assessment-question-bank-types';

type UpdateAssessmentQuestionReviewStatusPayload = {
  questionId: string;
  nextStatus: AssessmentQuestionReviewStatus;
  reason: string;
};

type UpdateAssessmentQuestionReviewMemoPayload = {
  questionId: string;
  reviewMemo: string;
};

type UpdateAssessmentQuestionOperationStatusPayload = {
  questionId: string;
  nextStatus: AssessmentQuestionOperationStatus;
  reason: string;
};

async function loadQuestions(signal?: AbortSignal): Promise<AssessmentQuestion[]> {
  return loadAssessmentQuestionsFromSupabase(signal);
}

async function loadQuestion(
  questionId: string,
  signal?: AbortSignal
): Promise<AssessmentQuestion> {
  return loadAssessmentQuestionFromSupabase(questionId, signal);
}

async function updateReviewStatus(
  payload: UpdateAssessmentQuestionReviewStatusPayload,
  signal?: AbortSignal
): Promise<AssessmentQuestion> {
  await setReviewStatusViaRpc(payload.questionId, payload.nextStatus);
  return loadAssessmentQuestionFromSupabase(payload.questionId, signal);
}

async function updateReviewMemo(
  payload: UpdateAssessmentQuestionReviewMemoPayload,
  signal?: AbortSignal
): Promise<AssessmentQuestion> {
  const question = await loadAssessmentQuestionFromSupabase(payload.questionId, signal);
  return { ...question, reviewMemo: payload.reviewMemo };
}

async function updateOperationStatus(
  payload: UpdateAssessmentQuestionOperationStatusPayload,
  signal?: AbortSignal
): Promise<AssessmentQuestion> {
  void payload;

  if (signal?.aborted) {
    throw new DOMException('Request aborted', 'AbortError');
  }

  throw new Error(
    '운영 상태 변경은 lifecycle_status 적용 전까지 비활성화되어 있습니다.'
  );
}

export function fetchAssessmentQuestionsSafe(signal?: AbortSignal) {
  return toSafeResult(() =>
    withRetry(() => loadQuestions(signal), { maxRetries: 1 })
  );
}

export function fetchAssessmentQuestionSafe(
  questionId: string,
  signal?: AbortSignal
) {
  return toSafeResult(() =>
    withRetry(() => loadQuestion(questionId, signal), { maxRetries: 1 })
  );
}

export function updateAssessmentQuestionReviewStatusSafe(
  payload: UpdateAssessmentQuestionReviewStatusPayload,
  signal?: AbortSignal
) {
  return toSafeResult(() => updateReviewStatus(payload, signal));
}

export function updateAssessmentQuestionReviewMemoSafe(
  payload: UpdateAssessmentQuestionReviewMemoPayload,
  signal?: AbortSignal
) {
  return toSafeResult(() => updateReviewMemo(payload, signal));
}

export function updateAssessmentQuestionOperationStatusSafe(
  payload: UpdateAssessmentQuestionOperationStatusPayload,
  signal?: AbortSignal
) {
  return toSafeResult(() => updateOperationStatus(payload, signal));
}
