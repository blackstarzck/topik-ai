import { AppApiError } from '../../../shared/api/api-error';
import { toSafeResult, withRetry } from '../../../shared/api/safe-request';
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
  await sleep(220, signal);

  return useAssessmentQuestionBankStore.getState().questions;
}

async function updateReviewStatus(
  payload: UpdateAssessmentQuestionReviewStatusPayload,
  signal?: AbortSignal
): Promise<AssessmentQuestion> {
  await sleep(220, signal);

  const updated = useAssessmentQuestionBankStore
    .getState()
    .updateReviewStatus(payload);

  if (!updated) {
    throw createQuestionNotFoundError();
  }

  return updated;
}

async function updateOperationStatus(
  payload: UpdateAssessmentQuestionOperationStatusPayload,
  signal?: AbortSignal
): Promise<AssessmentQuestion> {
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

export function updateAssessmentQuestionReviewStatusSafe(
  payload: UpdateAssessmentQuestionReviewStatusPayload,
  signal?: AbortSignal
) {
  return toSafeResult(() => updateReviewStatus(payload, signal));
}

export function updateAssessmentQuestionOperationStatusSafe(
  payload: UpdateAssessmentQuestionOperationStatusPayload,
  signal?: AbortSignal
) {
  return toSafeResult(() => updateOperationStatus(payload, signal));
}
