import type { UserStatus, UserSummary } from '../model/types';
import { getMockUserById, getMockUserLearningOverview, mockUsers } from './mock-users';
import { toSafeResult, withRetry } from '../../../shared/api/safe-request';
import { isSupabaseConfigured } from '../../../shared/api/supabase-client';
import {
  addUserMemoViaRpc,
  deleteUserMemoViaRpc,
  getUserAccessLogsFromSupabase,
  getUserActivityFromSupabase,
  getUserCommunityPostsFromSupabase,
  getUserLegalConsentsFromSupabase,
  getUserMemosFromSupabase,
  getUserPaymentsFromSupabase,
  loadUserLearningOverviewFromSupabase,
  loadUsersFromSupabase,
  setUserStatusViaRpc,
  type UserAccessLog,
  type UserActivityEvent,
  type UserAdminMemo,
  type UserCommunityPost,
  type UserLegalConsent,
  type UserPaymentRecord
} from './supabase-users-service';

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

export function fetchUserLearningOverviewSafe(userId: string, signal?: AbortSignal) {
  return toSafeResult(async () => {
    if (isSupabaseConfigured) {
      return loadUserLearningOverviewFromSupabase(userId, signal);
    }
    await sleep(180, signal);
    return getMockUserLearningOverview(userId);
  });
}

export function getUserCommunityPosts(userId: string, signal?: AbortSignal) {
  return toSafeResult<UserCommunityPost[]>(async () => {
    if (isSupabaseConfigured) {
      return getUserCommunityPostsFromSupabase(userId, signal);
    }
    await sleep(120, signal);
    return [];
  });
}

export function getUserMemos(userId: string, signal?: AbortSignal) {
  return toSafeResult<UserAdminMemo[]>(async () => {
    if (isSupabaseConfigured) {
      return getUserMemosFromSupabase(userId, signal);
    }
    await sleep(120, signal);
    return [];
  });
}

export function getUserActivity(userId: string, signal?: AbortSignal) {
  return toSafeResult<UserActivityEvent[]>(async () => {
    if (isSupabaseConfigured) {
      return getUserActivityFromSupabase(userId, signal);
    }
    await sleep(120, signal);
    return [];
  });
}

export function getUserLegalConsents(userId: string, signal?: AbortSignal) {
  return toSafeResult<UserLegalConsent[]>(async () => {
    if (isSupabaseConfigured) {
      return getUserLegalConsentsFromSupabase(userId, signal);
    }
    await sleep(120, signal);
    return [];
  });
}

export function getUserPayments(userId: string, signal?: AbortSignal) {
  return toSafeResult<UserPaymentRecord[]>(async () => {
    if (isSupabaseConfigured) {
      return getUserPaymentsFromSupabase(userId, signal);
    }
    await sleep(120, signal);
    return [];
  });
}

export function getUserAccessLogs(userId: string, signal?: AbortSignal) {
  return toSafeResult<UserAccessLog[]>(async () => {
    if (isSupabaseConfigured) {
      return getUserAccessLogsFromSupabase(userId, signal);
    }
    await sleep(120, signal);
    return [];
  });
}

export function addUserMemo(
  userId: string,
  content: string,
  reason: string,
  signal?: AbortSignal
) {
  return toSafeResult(async () => {
    if (isSupabaseConfigured) {
      return addUserMemoViaRpc(userId, content, reason, signal);
    }
    await sleep(120, signal);
    return `${userId}-M${Date.now()}`;
  });
}

export function deleteUserMemo(memoId: string, reason: string, signal?: AbortSignal) {
  return toSafeResult(async () => {
    if (isSupabaseConfigured) {
      return deleteUserMemoViaRpc(memoId, reason, signal);
    }
    await sleep(120, signal);
    return memoId;
  });
}

export type {
  UserAccessLog,
  UserActivityEvent,
  UserAdminMemo,
  UserCommunityPost,
  UserLegalConsent,
  UserPaymentRecord
};
