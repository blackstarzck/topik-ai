import { toSafeResult, withRetry } from '../../../shared/api/safe-request';
import { createMockSystemLogs } from './mock-system-logs';
import type { SystemLogRow } from '../model/system-log-types';

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

async function loadSystemLogs(signal?: AbortSignal): Promise<SystemLogRow[]> {
  await sleep(180, signal);
  return createMockSystemLogs();
}

export function fetchSystemLogsSafe(signal?: AbortSignal) {
  return toSafeResult(() =>
    withRetry(() => loadSystemLogs(signal), { maxRetries: 1 })
  );
}
