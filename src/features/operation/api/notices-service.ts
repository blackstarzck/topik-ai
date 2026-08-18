import { AppApiError } from '@/shared/api/api-error';
import { toSafeResult, withRetry } from '@/shared/api/safe-request';
import { useOperationStore } from '../model/operation-store';
import type { OperationNotice, OperationNoticeStatus } from '../model/types';
import { operationNoticesDataSource } from './operation-notices-data-source';
import {
  deleteOperationNotice,
  loadOperationNotice,
  loadOperationNotices,
  saveOperationNotice,
  setOperationNoticeStatus
} from './supabase-operation-notices-service';
import { sleep } from '@/shared/api/supabase-service-utils';

export type SaveNoticePayload = Pick<OperationNotice, 'title' | 'bodyHtml'> & {
  id?: string;
  reason?: string;
};

export type ToggleNoticeStatusPayload = {
  noticeId: string;
  nextStatus: OperationNoticeStatus;
  reason?: string;
};

const isSupabaseSource = operationNoticesDataSource === 'supabase';

function createNoticeNotFoundError(): AppApiError {
  return new AppApiError('공지 대상을 찾을 수 없습니다.', {
    code: 'NOT_FOUND',
    status: 404,
    retryable: false
  });
}

async function loadNotices(signal?: AbortSignal): Promise<OperationNotice[]> {
  if (isSupabaseSource) {
    return loadOperationNotices(signal);
  }

  await sleep(220, signal);
  return useOperationStore.getState().notices;
}

async function loadNotice(
  noticeId: string,
  signal?: AbortSignal
): Promise<OperationNotice> {
  if (isSupabaseSource) {
    const notice = await loadOperationNotice(noticeId, signal);
    if (!notice) {
      throw createNoticeNotFoundError();
    }
    return notice;
  }

  await sleep(220, signal);
  const notice = useOperationStore
    .getState()
    .notices.find((item) => item.id === noticeId);

  if (!notice) {
    throw createNoticeNotFoundError();
  }

  return notice;
}

async function persistNotice(
  payload: SaveNoticePayload,
  signal?: AbortSignal
): Promise<OperationNotice> {
  if (isSupabaseSource) {
    return saveOperationNotice(payload, signal);
  }

  await sleep(240, signal);

  if (payload.id) {
    const target = useOperationStore
      .getState()
      .notices.find((notice) => notice.id === payload.id);

    if (!target) {
      throw createNoticeNotFoundError();
    }
  }

  return useOperationStore.getState().saveNotice(payload);
}

async function persistNoticeStatus(
  payload: ToggleNoticeStatusPayload,
  signal?: AbortSignal
): Promise<OperationNotice> {
  if (isSupabaseSource) {
    const updated = await setOperationNoticeStatus(payload, signal);
    if (!updated) {
      throw createNoticeNotFoundError();
    }
    return updated;
  }

  await sleep(220, signal);
  const updated = useOperationStore.getState().toggleNoticeStatus(payload);

  if (!updated) {
    throw createNoticeNotFoundError();
  }

  return updated;
}

async function removeNotice(
  noticeId: string,
  reason?: string,
  signal?: AbortSignal
): Promise<OperationNotice> {
  if (isSupabaseSource) {
    const removed = await deleteOperationNotice(noticeId, reason, signal);
    if (!removed) {
      throw createNoticeNotFoundError();
    }
    return removed;
  }

  await sleep(220, signal);
  const removed = useOperationStore.getState().deleteNotice(noticeId);

  if (!removed) {
    throw createNoticeNotFoundError();
  }

  return removed;
}

export function fetchNoticesSafe(signal?: AbortSignal) {
  return toSafeResult(() =>
    withRetry(() => loadNotices(signal), { maxRetries: 1 })
  );
}

export function fetchNoticeSafe(noticeId: string, signal?: AbortSignal) {
  return toSafeResult(() =>
    withRetry(() => loadNotice(noticeId, signal), { maxRetries: 1 })
  );
}

export function saveNoticeSafe(
  payload: SaveNoticePayload,
  signal?: AbortSignal
) {
  return toSafeResult(() => persistNotice(payload, signal));
}

export function toggleNoticeStatusSafe(
  payload: ToggleNoticeStatusPayload,
  signal?: AbortSignal
) {
  return toSafeResult(() => persistNoticeStatus(payload, signal));
}

export function deleteNoticeSafe(
  noticeId: string,
  reasonOrSignal?: string | AbortSignal,
  signal?: AbortSignal
) {
  const reason = typeof reasonOrSignal === 'string' ? reasonOrSignal : undefined;
  const resolvedSignal =
    typeof reasonOrSignal === 'string' ? signal : reasonOrSignal ?? signal;
  return toSafeResult(() => removeNotice(noticeId, reason, resolvedSignal));
}
