import type { UserSummary } from '../model/types';
import { mockUsers } from './mock-users';
import { toSafeResult, withRetry } from '../../../shared/api/safe-request';

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

async function loadUsers(signal?: AbortSignal): Promise<UserSummary[]> {
  await sleep(280, signal);
  return mockUsers;
}

export function fetchUsersSafe(signal?: AbortSignal) {
  return toSafeResult(() => withRetry(() => loadUsers(signal), { maxRetries: 1 }));
}
