import { AppApiError } from '../../../shared/api/api-error';
import { toSafeResult, withRetry } from '../../../shared/api/safe-request';
import { isSupabaseConfigured } from '../../../shared/api/supabase-client';
import {
  loadAssessmentQuestionFromSupabase,
  loadAssessmentQuestionsFromSupabase,
  setReviewStatusViaRpc
} from './supabase-assessment-question-bank-service';
import { useAssessmentQuestionBankStore } from '../model/assessment-question-bank-store';
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

function createQuestionNotFoundError(): AppApiError {
  return new AppApiError('문항 대상을 찾을 수 없습니다.', {
    code: 'NOT_FOUND',
    status: 404,
    retryable: false
  });
}

async function loadQuestions(signal?: AbortSignal): Promise<AssessmentQuestion[]> {
  // Phase C (read-first): real v13 writing question bank when connected; mock otherwise.
  if (isSupabaseConfigured) {
    return loadAssessmentQuestionsFromSupabase(signal);
  }

  await sleep(220, signal);

  return useAssessmentQuestionBankStore.getState().questions;
}

async function loadQuestion(
  questionId: string,
  signal?: AbortSignal
): Promise<AssessmentQuestion> {
  const questions = await loadQuestions(signal);
  const question =
    questions.find((candidate) => candidate.questionId === questionId) ?? null;

  if (!question) {
    throw createQuestionNotFoundError();
  }

  return question;
}

async function updateReviewStatus(
  payload: UpdateAssessmentQuestionReviewStatusPayload,
  signal?: AbortSignal
): Promise<AssessmentQuestion> {
  // Phase C write slice: real v13 audited RPC when connected; mock store otherwise.
  // The action `reason` is intentionally NOT sent — admin_update_problem records the
  // column diff automatically and v13 has no free-text reason sink. Re-read proves the
  // write landed.
  if (isSupabaseConfigured) {
    await setReviewStatusViaRpc(payload.questionId, payload.nextStatus);
    return loadAssessmentQuestionFromSupabase(payload.questionId, signal);
  }

  await sleep(220, signal);

  const updated = useAssessmentQuestionBankStore
    .getState()
    .updateReviewStatus(payload);

  if (!updated) {
    throw createQuestionNotFoundError();
  }

  return updated;
}

async function updateReviewMemo(
  payload: UpdateAssessmentQuestionReviewMemoPayload,
  signal?: AbortSignal
): Promise<AssessmentQuestion> {
  // Phase C: v13 has NO review-memo column (explanation is the learner-facing answer
  // explanation, not an internal note). So in connected mode the memo is a topik-ai-
  // local annotation: re-read the LIVE question and keep the typed memo in the UI
  // WITHOUT a DB write (no fabricated persistence). This also keeps the review page's
  // pre-action memo-save step from failing on the real UUID. The status change below
  // carries the audited write. (Persisting the memo would need an additive v13 column —
  // owner decision.)
  if (isSupabaseConfigured) {
    const question = await loadAssessmentQuestionFromSupabase(payload.questionId, signal);
    return { ...question, reviewMemo: payload.reviewMemo };
  }

  await sleep(220, signal);

  const updated = useAssessmentQuestionBankStore.getState().updateReviewMemo(payload);

  if (!updated) {
    throw createQuestionNotFoundError();
  }

  return updated;
}

async function updateOperationStatus(
  payload: UpdateAssessmentQuestionOperationStatusPayload,
  signal?: AbortSignal
): Promise<AssessmentQuestion> {
  // Phase C: operation status reconciles to lifecycle_status, whose migration (#31/#32)
  // is NOT applied yet. So in connected mode this write stays disabled (no fabricated
  // write) until the column + an admin_update_problem branch land. Mock mode unchanged.
  // (No UI wires this today; the guard is defensive for a future call site.)
  if (isSupabaseConfigured) {
    throw new Error('운영 상태 쓰기는 lifecycle_status 적용 전까지 비활성입니다 (Phase C 보류).');
  }

  await sleep(220, signal);

  const updated = useAssessmentQuestionBankStore
    .getState()
    .updateOperationStatus(payload);

  if (!updated) {
    throw createQuestionNotFoundError();
  }

  return updated;
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
