import { toSafeResult, withRetry } from '@/shared/api/safe-request';
import {
  usePdfQuotaStore,
  type CreatePdfQuotaResetPayload,
  type SavePdfQuotaPolicyPayload
} from '../model/pdf-quota-store';
import type {
  PdfQuotaPolicy,
  PdfQuotaPolicyHistoryPage,
  PdfQuotaResetPage,
  PdfQuotaResetScope,
  PdfQuotaResetUserOption,
  PdfQuotaResetUserOptionPage
} from '../model/pdf-quota-types';
import { mockUsers } from '../../users/api/mock-users';
import { operationPdfQuotaDataSource } from './pdf-quota-data-source';
import {
  createPdfQuotaReset,
  loadPdfQuotaPolicies,
  loadPdfQuotaPolicyHistory,
  loadPdfQuotaResetUserOptions,
  loadPdfQuotaResets,
  savePdfQuotaPolicy,
  type CreatePdfQuotaResetResult
} from './supabase-pdf-quota-service';
import { sleep } from '@/shared/api/supabase-service-utils';

const isSupabaseSource = operationPdfQuotaDataSource === 'supabase';

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

function mapMockUserToResetOption(
  user: (typeof mockUsers)[number]
): PdfQuotaResetUserOption {
  return {
    id: user.id,
    email: user.email,
    displayName: user.realName,
    nickname: user.nickname,
    status: user.status
  };
}

async function loadResetUserOptions(
  input: { search?: string; page: number; pageSize: number },
  signal?: AbortSignal
): Promise<PdfQuotaResetUserOptionPage> {
  if (isSupabaseSource) {
    return loadPdfQuotaResetUserOptions(input, signal);
  }

  await sleep(200, signal);
  const keyword = input.search?.trim().toLowerCase() ?? '';
  const filtered = keyword
    ? mockUsers.filter((user) =>
        [user.id, user.email, user.realName, user.nickname].some((value) =>
          value.toLowerCase().includes(keyword)
        )
      )
    : mockUsers;
  const start = (input.page - 1) * input.pageSize;
  return {
    items: filtered.slice(start, start + input.pageSize).map(mapMockUserToResetOption),
    totalCount: filtered.length
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

export function fetchPdfQuotaResetUserOptionsSafe(
  input: { search?: string; page: number; pageSize: number },
  signal?: AbortSignal
) {
  return toSafeResult(() =>
    withRetry(() => loadResetUserOptions(input, signal), { maxRetries: 1 })
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
