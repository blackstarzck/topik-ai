import { AppApiError } from '../../../shared/api/api-error';
import { toSafeResult, withRetry } from '../../../shared/api/safe-request';
import { usePermissionStore } from '../../system/model/permission-store';
import type { AdminPermissionAssignment } from '../../system/model/permission-types';
import { useCommunityStore } from '../model/community-store';
import type {
  CommunityAdminMemo,
  CommunityPolicyCode,
  CommunityPost,
  CommunityReport
} from '../model/types';

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

export type CommunityModeratorOption = Pick<
  AdminPermissionAssignment,
  'adminId' | 'name'
>;

export type CommunityModeratorOptions = {
  admins: CommunityModeratorOption[];
  currentAdmin: CommunityModeratorOption | null;
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

function formatNow(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const mi = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

function clonePost(post: CommunityPost): CommunityPost {
  return {
    ...post,
    adminNotes: post.adminNotes.map((memo) => ({ ...memo }))
  };
}

function cloneReport(report: CommunityReport): CommunityReport {
  return { ...report };
}

function createNotFoundError(message: string): AppApiError {
  return new AppApiError(message, {
    code: 'NOT_FOUND',
    status: 404,
    retryable: false
  });
}

async function loadCommunityPosts(signal?: AbortSignal): Promise<CommunityPost[]> {
  await sleep(180, signal);
  return useCommunityStore.getState().posts.map(clonePost);
}

async function loadCommunityReports(
  signal?: AbortSignal
): Promise<CommunityReport[]> {
  await sleep(180, signal);
  return useCommunityStore.getState().reports.map(cloneReport);
}

async function loadCommunityModeratorOptions(
  signal?: AbortSignal
): Promise<CommunityModeratorOptions> {
  await sleep(60, signal);
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
  signal?: AbortSignal
): Promise<CommunityPost> {
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
  reportId: string,
  signal?: AbortSignal
): Promise<CommunityReport> {
  await sleep(160, signal);
  const updatedReport = useCommunityStore.getState().resolveReport(reportId);

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

export function deleteCommunityPostSafe(postId: string, signal?: AbortSignal) {
  return toSafeResult(() => deleteCommunityPost(postId, signal));
}

export function addCommunityPostMemoSafe(
  payload: AddCommunityPostMemoPayload,
  signal?: AbortSignal
) {
  return toSafeResult(() => addCommunityPostMemo(payload, signal));
}

export function resolveCommunityReportSafe(
  reportId: string,
  signal?: AbortSignal
) {
  return toSafeResult(() => resolveCommunityReport(reportId, signal));
}
