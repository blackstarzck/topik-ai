import type { InstructorDetail } from '../model/types';
import { mockInstructors } from './mock-instructors';
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

async function loadInstructors(signal?: AbortSignal): Promise<InstructorDetail[]> {
  await sleep(320, signal);
  return mockInstructors;
}

export function fetchInstructorsSafe(signal?: AbortSignal) {
  return toSafeResult(() =>
    withRetry(() => loadInstructors(signal), { maxRetries: 1 })
  );
}
