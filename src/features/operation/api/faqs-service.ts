import { AppApiError } from '../../../shared/api/api-error';
import { toSafeResult, withRetry } from '../../../shared/api/safe-request';
import { useOperationStore } from '../model/operation-store';
import type {
  OperationFaq,
  OperationFaqCuration,
  OperationFaqMetric,
  OperationFaqStatus
} from '../model/types';

export type SaveFaqPayload = Pick<
  OperationFaq,
  'question' | 'answer' | 'searchKeywords' | 'category' | 'status'
> & {
  id?: string;
};

export type ToggleFaqStatusPayload = {
  faqId: string;
  nextStatus: OperationFaqStatus;
};

export type SaveFaqCurationPayload = Pick<
  OperationFaqCuration,
  | 'faqId'
  | 'surface'
  | 'curationMode'
  | 'displayRank'
  | 'exposureStatus'
  | 'pinnedStartAt'
  | 'pinnedEndAt'
> & {
  id?: string;
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

function createFaqNotFoundError(): AppApiError {
  return new AppApiError('FAQ 대상을 찾을 수 없습니다.', {
    code: 'NOT_FOUND',
    status: 404,
    retryable: false
  });
}

async function loadFaqs(signal?: AbortSignal): Promise<OperationFaq[]> {
  await sleep(220, signal);
  return useOperationStore.getState().faqs;
}

async function loadFaqCurations(
  signal?: AbortSignal
): Promise<OperationFaqCuration[]> {
  await sleep(220, signal);
  return useOperationStore.getState().faqCurations;
}

async function loadFaqMetrics(signal?: AbortSignal): Promise<OperationFaqMetric[]> {
  await sleep(220, signal);
  return useOperationStore.getState().faqMetrics;
}

async function persistFaq(
  payload: SaveFaqPayload,
  signal?: AbortSignal
): Promise<OperationFaq> {
  await sleep(240, signal);

  if (payload.id) {
    const target = useOperationStore.getState().faqs.find((faq) => faq.id === payload.id);

    if (!target) {
      throw createFaqNotFoundError();
    }
  }

  return useOperationStore.getState().saveFaq(payload);
}

function createFaqCurationConflictError(): AppApiError {
  return new AppApiError(
    '같은 노출 위치와 순위를 사용하는 대표 FAQ가 이미 있습니다.',
    {
      code: 'CONFLICT',
      status: 409,
      retryable: false
    }
  );
}

function createFaqCurationVisibilityError(): AppApiError {
  return new AppApiError('비공개 FAQ는 노출 중 상태로 등록할 수 없습니다.', {
    code: 'INVALID_STATE',
    status: 400,
    retryable: false
  });
}

function createFaqCurationNotFoundError(): AppApiError {
  return new AppApiError('대표 FAQ 노출 설정 대상을 찾을 수 없습니다.', {
    code: 'NOT_FOUND',
    status: 404,
    retryable: false
  });
}

async function persistFaqCuration(
  payload: SaveFaqCurationPayload,
  signal?: AbortSignal
): Promise<OperationFaqCuration> {
  await sleep(240, signal);

  const store = useOperationStore.getState();
  const targetFaq = store.faqs.find((faq) => faq.id === payload.faqId);
  if (!targetFaq) {
    throw createFaqNotFoundError();
  }

  if (payload.exposureStatus === 'active' && targetFaq.status !== '공개') {
    throw createFaqCurationVisibilityError();
  }

  const duplicate = store.faqCurations.find(
    (curation) =>
      curation.surface === payload.surface &&
      curation.displayRank === payload.displayRank &&
      curation.id !== payload.id
  );

  if (duplicate) {
    throw createFaqCurationConflictError();
  }

  return store.saveFaqCuration(payload);
}

async function persistFaqStatus(
  payload: ToggleFaqStatusPayload,
  signal?: AbortSignal
): Promise<OperationFaq> {
  await sleep(220, signal);
  const updated = useOperationStore.getState().toggleFaqStatus(payload);

  if (!updated) {
    throw createFaqNotFoundError();
  }

  return updated;
}

async function removeFaqCuration(
  curationId: string,
  signal?: AbortSignal
): Promise<OperationFaqCuration> {
  await sleep(220, signal);
  const removed = useOperationStore.getState().deleteFaqCuration(curationId);

  if (!removed) {
    throw createFaqCurationNotFoundError();
  }

  return removed;
}

async function removeFaq(faqId: string, signal?: AbortSignal): Promise<OperationFaq> {
  await sleep(220, signal);
  const removed = useOperationStore.getState().deleteFaq(faqId);

  if (!removed) {
    throw createFaqNotFoundError();
  }

  return removed;
}

export function fetchFaqsSafe(signal?: AbortSignal) {
  return toSafeResult(() => withRetry(() => loadFaqs(signal), { maxRetries: 1 }));
}

export function fetchFaqCurationsSafe(signal?: AbortSignal) {
  return toSafeResult(() =>
    withRetry(() => loadFaqCurations(signal), { maxRetries: 1 })
  );
}

export function fetchFaqMetricsSafe(signal?: AbortSignal) {
  return toSafeResult(() =>
    withRetry(() => loadFaqMetrics(signal), { maxRetries: 1 })
  );
}

export function saveFaqSafe(payload: SaveFaqPayload, signal?: AbortSignal) {
  return toSafeResult(() => persistFaq(payload, signal));
}

export function saveFaqCurationSafe(
  payload: SaveFaqCurationPayload,
  signal?: AbortSignal
) {
  return toSafeResult(() => persistFaqCuration(payload, signal));
}

export function toggleFaqStatusSafe(
  payload: ToggleFaqStatusPayload,
  signal?: AbortSignal
) {
  return toSafeResult(() => persistFaqStatus(payload, signal));
}

export function deleteFaqSafe(faqId: string, signal?: AbortSignal) {
  return toSafeResult(() => removeFaq(faqId, signal));
}

export function deleteFaqCurationSafe(
  curationId: string,
  signal?: AbortSignal
) {
  return toSafeResult(() => removeFaqCuration(curationId, signal));
}
