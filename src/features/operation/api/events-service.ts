import { AppApiError } from '../../../shared/api/api-error';
import { toSafeResult, withRetry } from '../../../shared/api/safe-request';
import { useOperationStore } from '../model/operation-store';
import type { OperationEvent } from '../model/types';

export type SaveEventPayload = {
  id?: string;
  title: string;
  summary: string;
  bodyHtml: string;
  slug: string;
  eventType: OperationEvent['eventType'];
  visibilityStatus: OperationEvent['visibilityStatus'];
  startAt: string;
  endAt: string;
  exposureChannels: OperationEvent['exposureChannels'];
  targetGroupId: string;
  targetGroupName: string;
  participantLimit: number | null;
  rewardType: OperationEvent['rewardType'];
  rewardPolicyId: string;
  rewardPolicyName: string;
  bannerImageUrl: string;
  landingUrl: string;
  messageTemplateName: string;
  metaTitle: string;
  metaDescription: string;
  ogImageUrl: string;
  canonicalUrl: string;
  indexingPolicy: OperationEvent['indexingPolicy'];
  adminMemo: string;
};

type EventActionPayload = {
  eventId: string;
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

function createEventNotFoundError(): AppApiError {
  return new AppApiError('이벤트 대상을 찾을 수 없습니다.', {
    code: 'NOT_FOUND',
    status: 404,
    retryable: false
  });
}

async function loadEvents(signal?: AbortSignal): Promise<OperationEvent[]> {
  await sleep(220, signal);
  return useOperationStore.getState().events;
}

async function loadEvent(
  eventId: string,
  signal?: AbortSignal
): Promise<OperationEvent> {
  await sleep(220, signal);
  const event = useOperationStore.getState().events.find((item) => item.id === eventId);

  if (!event) {
    throw createEventNotFoundError();
  }

  return event;
}

async function persistEvent(
  payload: SaveEventPayload,
  signal?: AbortSignal
): Promise<OperationEvent> {
  await sleep(260, signal);

  if (payload.id) {
    const target = useOperationStore.getState().events.find((event) => event.id === payload.id);

    if (!target) {
      throw createEventNotFoundError();
    }
  }

  return useOperationStore.getState().saveEvent(payload);
}

async function scheduleEventPublish(
  payload: EventActionPayload,
  signal?: AbortSignal
): Promise<OperationEvent> {
  await sleep(220, signal);
  const updated = useOperationStore.getState().scheduleEventPublish(payload);

  if (!updated) {
    throw createEventNotFoundError();
  }

  return updated;
}

async function publishEvent(
  payload: EventActionPayload,
  signal?: AbortSignal
): Promise<OperationEvent> {
  await sleep(220, signal);
  const updated = useOperationStore.getState().publishEvent(payload);

  if (!updated) {
    throw createEventNotFoundError();
  }

  return updated;
}

async function finishEvent(
  payload: EventActionPayload,
  signal?: AbortSignal
): Promise<OperationEvent> {
  await sleep(220, signal);
  const updated = useOperationStore.getState().endEvent(payload);

  if (!updated) {
    throw createEventNotFoundError();
  }

  return updated;
}

export function fetchEventsSafe(signal?: AbortSignal) {
  return toSafeResult(() =>
    withRetry(() => loadEvents(signal), { maxRetries: 1 })
  );
}

export function fetchEventSafe(eventId: string, signal?: AbortSignal) {
  return toSafeResult(() =>
    withRetry(() => loadEvent(eventId, signal), { maxRetries: 1 })
  );
}

export function saveEventSafe(
  payload: SaveEventPayload,
  signal?: AbortSignal
) {
  return toSafeResult(() => persistEvent(payload, signal));
}

export function scheduleEventPublishSafe(
  payload: EventActionPayload,
  signal?: AbortSignal
) {
  return toSafeResult(() => scheduleEventPublish(payload, signal));
}

export function publishEventSafe(
  payload: EventActionPayload,
  signal?: AbortSignal
) {
  return toSafeResult(() => publishEvent(payload, signal));
}

export function endEventSafe(
  payload: EventActionPayload,
  signal?: AbortSignal
) {
  return toSafeResult(() => finishEvent(payload, signal));
}
