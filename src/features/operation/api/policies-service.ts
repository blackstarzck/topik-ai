import { AppApiError } from '../../../shared/api/api-error';
import { toSafeResult, withRetry } from '../../../shared/api/safe-request';
import { useOperationPolicyStore } from '../model/policy-store';
import type {
  OperationPolicy,
  OperationPolicyHistoryEntry,
  OperationPolicyStatus
} from '../model/policy-types';

export type SavePolicyPayload = Pick<
  OperationPolicy,
  | 'category'
  | 'policyType'
  | 'title'
  | 'versionLabel'
  | 'effectiveDate'
  | 'exposureSurfaces'
  | 'requiresConsent'
  | 'trackingStatus'
  | 'relatedAdminPages'
  | 'relatedUserPages'
  | 'sourceDocuments'
  | 'summary'
  | 'legalReferences'
  | 'bodyHtml'
  | 'adminMemo'
> & {
  id?: string;
};

export type TogglePolicyStatusPayload = {
  policyId: string;
  nextStatus: OperationPolicyStatus;
};

export type DeletePolicyPayload = {
  policyId: string;
  reason: string;
};

export type PublishPolicyHistoryVersionPayload = {
  policyId: string;
  historyId: string;
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

function createPolicyNotFoundError(): AppApiError {
  return new AppApiError('정책 대상을 찾을 수 없습니다.', {
    code: 'NOT_FOUND',
    status: 404,
    retryable: false
  });
}

async function loadPolicies(signal?: AbortSignal): Promise<OperationPolicy[]> {
  await sleep(220, signal);
  return useOperationPolicyStore.getState().policies;
}

async function loadPolicy(
  policyId: string,
  signal?: AbortSignal
): Promise<OperationPolicy> {
  await sleep(220, signal);
  const policy = useOperationPolicyStore
    .getState()
    .policies.find((item) => item.id === policyId);

  if (!policy) {
    throw createPolicyNotFoundError();
  }

  return policy;
}

async function loadPolicyHistory(
  policyId: string,
  signal?: AbortSignal
): Promise<OperationPolicyHistoryEntry[]> {
  await sleep(180, signal);

  const storeState = useOperationPolicyStore.getState();
  const target = storeState.policies.find((item) => item.id === policyId);
  const histories = storeState.policyHistories
    .filter((entry) => entry.policyId === policyId)
    .sort((left, right) => {
      const changedAtCompare = right.changedAt.localeCompare(left.changedAt);

      if (changedAtCompare !== 0) {
        return changedAtCompare;
      }

      return right.id.localeCompare(left.id);
    });

  if (!target && histories.length === 0) {
    throw createPolicyNotFoundError();
  }

  return histories;
}

async function persistPolicy(
  payload: SavePolicyPayload,
  signal?: AbortSignal
): Promise<OperationPolicy> {
  await sleep(240, signal);

  if (payload.id) {
    const target = useOperationPolicyStore
      .getState()
      .policies.find((policy) => policy.id === payload.id);

    if (!target) {
      throw createPolicyNotFoundError();
    }
  }

  return useOperationPolicyStore.getState().savePolicy(payload);
}

async function persistPolicyStatus(
  payload: TogglePolicyStatusPayload,
  signal?: AbortSignal
): Promise<OperationPolicy> {
  await sleep(220, signal);
  const updated = useOperationPolicyStore.getState().togglePolicyStatus(payload);

  if (!updated) {
    throw createPolicyNotFoundError();
  }

  return updated;
}

async function persistPolicyDelete(
  payload: DeletePolicyPayload,
  signal?: AbortSignal
): Promise<OperationPolicy> {
  await sleep(220, signal);
  const deleted = useOperationPolicyStore.getState().deletePolicy(payload);

  if (!deleted) {
    throw createPolicyNotFoundError();
  }

  return deleted;
}

async function persistPolicyHistoryVersionPublish(
  payload: PublishPolicyHistoryVersionPayload,
  signal?: AbortSignal
): Promise<OperationPolicy> {
  await sleep(220, signal);
  const published = useOperationPolicyStore
    .getState()
    .publishPolicyHistoryVersion(payload);

  if (!published) {
    throw createPolicyNotFoundError();
  }

  return published;
}

export function fetchPoliciesSafe(signal?: AbortSignal) {
  return toSafeResult(() =>
    withRetry(() => loadPolicies(signal), { maxRetries: 1 })
  );
}

export function fetchPolicySafe(policyId: string, signal?: AbortSignal) {
  return toSafeResult(() =>
    withRetry(() => loadPolicy(policyId, signal), { maxRetries: 1 })
  );
}

export function fetchPolicyHistorySafe(policyId: string, signal?: AbortSignal) {
  return toSafeResult(() =>
    withRetry(() => loadPolicyHistory(policyId, signal), { maxRetries: 1 })
  );
}

export function savePolicySafe(payload: SavePolicyPayload, signal?: AbortSignal) {
  return toSafeResult(() => persistPolicy(payload, signal));
}

export function togglePolicyStatusSafe(
  payload: TogglePolicyStatusPayload,
  signal?: AbortSignal
) {
  return toSafeResult(() => persistPolicyStatus(payload, signal));
}

export function deletePolicySafe(
  payload: DeletePolicyPayload,
  signal?: AbortSignal
) {
  return toSafeResult(() => persistPolicyDelete(payload, signal));
}

export function publishPolicyHistoryVersionSafe(
  payload: PublishPolicyHistoryVersionPayload,
  signal?: AbortSignal
) {
  return toSafeResult(() => persistPolicyHistoryVersionPublish(payload, signal));
}
