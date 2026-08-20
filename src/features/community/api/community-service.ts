import { createNotFoundError } from '@/shared/api/api-error';
import { toSafeResult, withRetry } from '@/shared/api/safe-request';
import { useAuthStore } from '@/features/auth/model/auth-store';
import { usePermissionStore } from '@/features/system/model/permission-store';
import type { AdminPermissionAssignment } from '@/features/system/model/permission-types';
import { useCommunityStore } from '../model/community-store';
import type {
  CommunityAdminMemo,
  CommunityPolicyCode,
  CommunityPost,
  CommunityReport,
  CommunityReportResolutionAction
} from '../model/types';
import { communityDataSource } from './community-data-source';
import {
  addCommunityPostMemo as addSupabaseCommunityPostMemo,
  deleteCommunityPost as deleteSupabaseCommunityPost,
  hideCommunityPost as hideSupabaseCommunityPost,
  loadCommunityPosts as loadSupabaseCommunityPosts,
  loadCommunityReports as loadSupabaseCommunityReports,
  resolveCommunityReport as resolveSupabaseCommunityReport,
  showCommunityPost as showSupabaseCommunityPost
} from './supabase-community-service';
import { sleep } from '@/shared/api/supabase-service-utils';
import { formatNowSeconds as formatNow } from '@/shared/model/date-format';

export type ModerateCommunityPostPayload = {
  postId: string;
  reason: string;
  policyCode?: CommunityPolicyCode;
};

export type AddCommunityPostMemoPayload = {
  postId: string;
  title: string;
  type: string;
  authorId: string;
  authorName: string;
  content: string;
};

export type ResolveCommunityReportPayload = {
  reportId: string;
  action: CommunityReportResolutionAction;
  reason: string;
};

export type CommunityModeratorOption = Pick<
  AdminPermissionAssignment,
  'adminId' | 'name'
>;

export type CommunityModeratorOptions = {
  admins: CommunityModeratorOption[];
  currentAdmin: CommunityModeratorOption | null;
};

const isSupabaseSource = communityDataSource === 'supabase';

function clonePost(post: CommunityPost): CommunityPost {
  return {
    ...post,
    adminNotes: post.adminNotes.map((memo) => ({ ...memo }))
  };
}

function cloneReport(report: CommunityReport): CommunityReport {
  return { ...report };
}

async function loadCommunityPosts(signal?: AbortSignal): Promise<CommunityPost[]> {
  if (isSupabaseSource) {
    return loadSupabaseCommunityPosts(signal);
  }

  await sleep(180, signal);
  return useCommunityStore.getState().posts.map(clonePost);
}

async function loadCommunityReports(
  signal?: AbortSignal
): Promise<CommunityReport[]> {
  if (isSupabaseSource) {
    return loadSupabaseCommunityReports(signal);
  }

  await sleep(180, signal);
  return useCommunityStore.getState().reports.map(cloneReport);
}

async function loadCommunityModeratorOptions(
  signal?: AbortSignal
): Promise<CommunityModeratorOptions> {
  await sleep(60, signal);

  if (isSupabaseSource) {
    // Live path: moderator identity = the logged-in admin (auth session), NOT the
    // mock permission store. The page only consumes currentAdmin (memo author);
    // the admins list is unused by the live screen.
    const session = useAuthStore.getState().session;
    const currentAdmin = session
      ? { adminId: session.userId, name: session.displayName }
      : null;
    return { admins: currentAdmin ? [currentAdmin] : [], currentAdmin };
  }

  const { admins, currentAdminId } = usePermissionStore.getState();
  const adminOptions = admins.map(({ adminId, name }) => ({ adminId, name }));
  const currentAdmin =
    adminOptions.find((admin) => admin.adminId === currentAdminId) ??
    adminOptions[0] ??
    null;

  return {
    admins: adminOptions,
    currentAdmin
  };
}

async function showCommunityPost(
  payload: ModerateCommunityPostPayload,
  signal?: AbortSignal
): Promise<CommunityPost> {
  if (isSupabaseSource) {
    const updatedPost = await showSupabaseCommunityPost(payload, signal);
    if (!updatedPost) {
      throw createNotFoundError('게시글을 찾을 수 없습니다.');
    }
    return updatedPost;
  }

  await sleep(160, signal);
  const updatedPost = useCommunityStore.getState().showPost({
    ...payload,
    moderatedAt: formatNow()
  });

  if (!updatedPost) {
    throw createNotFoundError('게시글을 찾을 수 없습니다.');
  }

  return updatedPost;
}

async function hideCommunityPost(
  payload: ModerateCommunityPostPayload,
  signal?: AbortSignal
): Promise<CommunityPost> {
  if (isSupabaseSource) {
    const updatedPost = await hideSupabaseCommunityPost(payload, signal);
    if (!updatedPost) {
      throw createNotFoundError('게시글을 찾을 수 없습니다.');
    }
    return updatedPost;
  }

  await sleep(160, signal);
  const updatedPost = useCommunityStore.getState().hidePost({
    ...payload,
    moderatedAt: formatNow()
  });

  if (!updatedPost) {
    throw createNotFoundError('게시글을 찾을 수 없습니다.');
  }

  return updatedPost;
}

async function deleteCommunityPost(
  postId: string,
  reason: string,
  signal?: AbortSignal
): Promise<CommunityPost> {
  if (isSupabaseSource) {
    const deletedPost = await deleteSupabaseCommunityPost(postId, reason, signal);
    if (!deletedPost) {
      throw createNotFoundError('게시글을 찾을 수 없습니다.');
    }
    return deletedPost;
  }

  await sleep(160, signal);
  const deletedPost = useCommunityStore.getState().deletePost(postId);

  if (!deletedPost) {
    throw createNotFoundError('게시글을 찾을 수 없습니다.');
  }

  return deletedPost;
}

async function addCommunityPostMemo(
  payload: AddCommunityPostMemoPayload,
  signal?: AbortSignal
): Promise<CommunityPost> {
  if (isSupabaseSource) {
    const updatedPost = await addSupabaseCommunityPostMemo(payload, signal);
    if (!updatedPost) {
      throw createNotFoundError('게시글을 찾을 수 없습니다.');
    }
    return updatedPost;
  }

  await sleep(160, signal);
  const memo: Omit<CommunityAdminMemo, 'id' | 'createdAt'> = {
    title: payload.title,
    type: payload.type,
    authorId: payload.authorId,
    authorName: payload.authorName,
    content: payload.content
  };
  const updatedPost = useCommunityStore.getState().addPostMemo({
    postId: payload.postId,
    memo,
    createdAt: formatNow()
  });

  if (!updatedPost) {
    throw createNotFoundError('게시글을 찾을 수 없습니다.');
  }

  return updatedPost;
}

async function resolveCommunityReport(
  payload: ResolveCommunityReportPayload,
  signal?: AbortSignal
): Promise<CommunityReport> {
  if (isSupabaseSource) {
    const updatedReport = await resolveSupabaseCommunityReport(payload, signal);
    if (!updatedReport) {
      throw createNotFoundError('신고 항목을 찾을 수 없습니다.');
    }
    return updatedReport;
  }

  await sleep(160, signal);
  const updatedReport = useCommunityStore.getState().resolveReport({
    ...payload,
    resolvedAt: formatNow()
  });

  if (!updatedReport) {
    throw createNotFoundError('신고 항목을 찾을 수 없습니다.');
  }

  return updatedReport;
}

export function fetchCommunityPostsSafe(signal?: AbortSignal) {
  return toSafeResult(() =>
    withRetry(() => loadCommunityPosts(signal), { maxRetries: 1 })
  );
}

export function fetchCommunityReportsSafe(signal?: AbortSignal) {
  return toSafeResult(() =>
    withRetry(() => loadCommunityReports(signal), { maxRetries: 1 })
  );
}

export function fetchCommunityModeratorOptionsSafe(signal?: AbortSignal) {
  return toSafeResult(() =>
    withRetry(() => loadCommunityModeratorOptions(signal), { maxRetries: 1 })
  );
}

export function showCommunityPostSafe(
  payload: ModerateCommunityPostPayload,
  signal?: AbortSignal
) {
  return toSafeResult(() => showCommunityPost(payload, signal));
}

export function hideCommunityPostSafe(
  payload: ModerateCommunityPostPayload,
  signal?: AbortSignal
) {
  return toSafeResult(() => hideCommunityPost(payload, signal));
}

export function deleteCommunityPostSafe(
  postId: string,
  reasonOrSignal?: string | AbortSignal,
  signal?: AbortSignal
) {
  const reason = typeof reasonOrSignal === 'string' ? reasonOrSignal : '';
  const requestSignal =
    typeof reasonOrSignal === 'string' ? signal : reasonOrSignal;

  return toSafeResult(() => deleteCommunityPost(postId, reason, requestSignal));
}

export function addCommunityPostMemoSafe(
  payload: AddCommunityPostMemoPayload,
  signal?: AbortSignal
) {
  return toSafeResult(() => addCommunityPostMemo(payload, signal));
}

export function resolveCommunityReportSafe(
  reportId: string,
  actionOrSignal?: CommunityReportResolutionAction | AbortSignal,
  reason?: string,
  signal?: AbortSignal
) {
  const action =
    typeof actionOrSignal === 'string'
      ? actionOrSignal
      : ('hide_post' as CommunityReportResolutionAction);
  const requestSignal =
    typeof actionOrSignal === 'string' ? signal : actionOrSignal;

  return toSafeResult(() =>
    resolveCommunityReport(
      {
        reportId,
        action,
        reason: reason ?? '신고 처리'
      },
      requestSignal
    )
  );
}
