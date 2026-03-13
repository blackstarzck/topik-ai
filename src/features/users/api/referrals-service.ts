import type { ReferralSummary } from '../model/referrals-types';
import { mockReferrals } from './mock-referrals';
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

async function loadReferrals(signal?: AbortSignal): Promise<ReferralSummary[]> {
  await sleep(320, signal);
  return mockReferrals;
}

export function fetchReferralsSafe(signal?: AbortSignal) {
  return toSafeResult(() =>
    withRetry(() => loadReferrals(signal), {
      maxRetries: 1
    })
  );
}
