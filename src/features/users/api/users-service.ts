import type { UserStatus, UserSummary } from '../model/types';
import { getMockUserById, mockUsers } from './mock-users';
import { toSafeResult, withRetry } from '../../../shared/api/safe-request';
import { isSupabaseConfigured } from '../../../shared/api/supabase-client';
import { loadUsersFromSupabase, setUserStatusViaRpc } from './supabase-users-service';

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
  // Phase B (read-first): real v13 directory when connected; mock otherwise (unchanged).
  if (isSupabaseConfigured) {
    return loadUsersFromSupabase(signal);
  }
  await sleep(280, signal);
  return mockUsers;
}

export function fetchUsersSafe(signal?: AbortSignal) {
  return toSafeResult(() => withRetry(() => loadUsers(signal), { maxRetries: 1 }));
}

/**
 * Phase B write seam — suspend(정지)/unsuspend(정상) via the audited RPC. In mock mode
 * this is a no-op success (the page already updates local state). withdraw(탈퇴) is
 * blocked downstream (D-F). Page buttons adopt this in the next slice.
 */
export function setUserStatusSafe(userId: string, nextStatus: UserStatus) {
  return toSafeResult(async () => {
    if (isSupabaseConfigured) {
      await setUserStatusViaRpc(userId, nextStatus);
    }
  });
}

/** Detail read — single member. Real directory lookup when connected, else mock. */
export function fetchUserByIdSafe(userId: string, signal?: AbortSignal) {
  return toSafeResult(async () => {
    if (isSupabaseConfigured) {
      const users = await loadUsersFromSupabase(signal);
      return users.find((item) => item.id === userId) ?? null;
    }
    return getMockUserById(userId) ?? null;
  });
}
