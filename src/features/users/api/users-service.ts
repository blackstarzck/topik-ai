import type { UserStatus, UserSummary } from '../model/types';
import { getMockUserById, getMockUserLearningOverview, mockUsers } from './mock-users';
import { toSafeResult, withRetry } from '../../../shared/api/safe-request';
import { isSupabaseConfigured } from '../../../shared/api/supabase-client';
import {
  addUserMemoViaRpc,
  deleteUserMemoViaRpc,
  getUserActivityFromSupabase,
  getUserCommunityPostsFromSupabase,
  getUserLegalConsentsFromSupabase,
  getUserMemosFromSupabase,
  getUserPaymentsFromSupabase,
  loadUserByIdFromSupabase,
  loadUserLearningOverviewFromSupabase,
  loadUsersFromSupabase,
  setUserStatusViaRpc,
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

// 회원 목록 "기관 소속" 필터를 mock 경로에서도 동일하게 적용(@affiliated/@general/특정 코드).
// 서버 경로는 get_admin_users(affiliation) 가 동일 의미로 거른다.
function filterMockUsersByAffiliation(
  users: UserSummary[],
  affiliation?: string | null
): UserSummary[] {
  const value = affiliation?.trim();
  if (!value) {
    return users;
  }
  if (value === '@affiliated') {
    return users.filter((user) => user.affiliationCode.trim() !== '');
  }
  if (value === '@general') {
    return users.filter((user) => user.affiliationCode.trim() === '');
  }
  return users.filter((user) => user.affiliationCode === value);
}

async function loadUsers(
  signal?: AbortSignal,
  affiliation?: string | null
): Promise<UserSummary[]> {
  // Phase B (read-first): real v13 directory when connected; mock otherwise (unchanged).
  if (isSupabaseConfigured) {
    return loadUsersFromSupabase(signal, affiliation);
  }
  await sleep(280, signal);
  return filterMockUsersByAffiliation(mockUsers, affiliation);
}

export function fetchUsersSafe(signal?: AbortSignal, affiliation?: string | null) {
  return toSafeResult(() =>
    withRetry(() => loadUsers(signal, affiliation), { maxRetries: 1 })
  );
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

/**
 * Detail read — single member. Supabase 모드에서는 id 로 그 회원만 직접 조회한다
 * (get_admin_user). get_admin_user 미배포 등으로 실패하면 구 경로(목록 상위 100명
 * 스캔)로 폴백해 회귀를 막는다. 미연결 시 mock.
 */
export function fetchUserByIdSafe(userId: string, signal?: AbortSignal) {
  return toSafeResult(async () => {
    if (!isSupabaseConfigured) {
      return getMockUserById(userId) ?? null;
    }
    try {
      return await loadUserByIdFromSupabase(userId, signal);
    } catch (error) {
      // 요청 취소는 그대로 전파(폴백 금지).
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw error;
      }
      // 폴백: 목록 상위 100명에서 find(단건 RPC가 아직 배포되지 않은 환경 대비).
      const users = await loadUsersFromSupabase(signal);
      return users.find((item) => item.id === userId) ?? null;
    }
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
  UserActivityEvent,
  UserAdminMemo,
  UserCommunityPost,
  UserLegalConsent,
  UserPaymentRecord
};
