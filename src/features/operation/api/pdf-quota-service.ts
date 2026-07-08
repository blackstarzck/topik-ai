import { toSafeResult, withRetry } from '../../../shared/api/safe-request';
import {
  usePdfQuotaStore,
  type CreatePdfQuotaResetPayload,
  type SavePdfQuotaPolicyPayload
} from '../model/pdf-quota-store';
import type {
  PdfQuotaPolicy,
  PdfQuotaPolicyHistoryPage,
  PdfQuotaResetPage,
  PdfQuotaResetScope
} from '../model/pdf-quota-types';
import { operationPdfQuotaDataSource } from './pdf-quota-data-source';
import {
  createPdfQuotaReset,
  loadPdfQuotaPolicies,
  loadPdfQuotaPolicyHistory,
  loadPdfQuotaResets,
  savePdfQuotaPolicy,
  type CreatePdfQuotaResetResult
} from './supabase-pdf-quota-service';

const isSupabaseSource = operationPdfQuotaDataSource === 'supabase';

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

async function loadPolicies(signal?: AbortSignal): Promise<PdfQuotaPolicy[]> {
  if (isSupabaseSource) {
    return loadPdfQuotaPolicies(signal);
  }

  await sleep(200, signal);
  return usePdfQuotaStore.getState().policies;
}

async function loadPolicyHistory(
  input: { page: number; pageSize: number },
  signal?: AbortSignal
): Promise<PdfQuotaPolicyHistoryPage> {
  if (isSupabaseSource) {
    return loadPdfQuotaPolicyHistory(input, signal);
  }

  await sleep(200, signal);
  const all = usePdfQuotaStore.getState().policyHistory;
  const start = (input.page - 1) * input.pageSize;
  return {
    items: all.slice(start, start + input.pageSize),
    totalCount: all.length
  };
}

async function loadResets(
  input: { page: number; pageSize: number; scope?: PdfQuotaResetScope | null },
  signal?: AbortSignal
): Promise<PdfQuotaResetPage> {
  if (isSupabaseSource) {
    return loadPdfQuotaResets(input, signal);
  }

  await sleep(200, signal);
  const all = usePdfQuotaStore
    .getState()
    .resets.filter((reset) => !input.scope || reset.scope === input.scope);
  const start = (input.page - 1) * input.pageSize;
  return {
    items: all.slice(start, start + input.pageSize),
    totalCount: all.length
  };
}

async function persistPolicy(
  payload: SavePdfQuotaPolicyPayload,
  signal?: AbortSignal
): Promise<string> {
  if (isSupabaseSource) {
    return savePdfQuotaPolicy(payload, signal);
  }

  await sleep(220, signal);
  return usePdfQuotaStore.getState().savePolicy(payload).id;
}

async function persistReset(
  payload: CreatePdfQuotaResetPayload,
  signal?: AbortSignal
): Promise<CreatePdfQuotaResetResult> {
  if (isSupabaseSource) {
    return createPdfQuotaReset(payload, signal);
  }

  await sleep(220, signal);
  const created = usePdfQuotaStore.getState().createReset(payload);
  return { resetId: created.id, targetCount: created.targetCount };
}

export function fetchPdfQuotaPoliciesSafe(signal?: AbortSignal) {
  return toSafeResult(() =>
    withRetry(() => loadPolicies(signal), { maxRetries: 1 })
  );
}

export function fetchPdfQuotaPolicyHistorySafe(
  input: { page: number; pageSize: number },
  signal?: AbortSignal
) {
  return toSafeResult(() =>
    withRetry(() => loadPolicyHistory(input, signal), { maxRetries: 1 })
  );
}

export function fetchPdfQuotaResetsSafe(
  input: { page: number; pageSize: number; scope?: PdfQuotaResetScope | null },
  signal?: AbortSignal
) {
  return toSafeResult(() =>
    withRetry(() => loadResets(input, signal), { maxRetries: 1 })
  );
}

export function savePdfQuotaPolicySafe(
  payload: SavePdfQuotaPolicyPayload,
  signal?: AbortSignal
) {
  return toSafeResult(() => persistPolicy(payload, signal));
}

export function createPdfQuotaResetSafe(
  payload: CreatePdfQuotaResetPayload,
  signal?: AbortSignal
) {
  return toSafeResult(() => persistReset(payload, signal));
}
