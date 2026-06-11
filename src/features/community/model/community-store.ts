import { create } from 'zustand';

import {
  createInitialCommunityPosts,
  createInitialCommunityReports
} from '../api/mock-community';
import type {
  CommunityAdminMemo,
  CommunityPolicyCode,
  CommunityPost,
  CommunityReport
} from './types';

type ModeratePostPayload = {
  postId: string;
  reason: string;
  policyCode?: CommunityPolicyCode;
  moderatedAt: string;
};

type AddPostMemoPayload = {
  postId: string;
  memo: Omit<CommunityAdminMemo, 'id' | 'createdAt'>;
  createdAt: string;
};

type CommunityState = {
  posts: CommunityPost[];
  reports: CommunityReport[];
  showPost: (payload: ModeratePostPayload) => CommunityPost | null;
  hidePost: (payload: ModeratePostPayload) => CommunityPost | null;
  deletePost: (postId: string) => CommunityPost | null;
  addPostMemo: (payload: AddPostMemoPayload) => CommunityPost | null;
  resolveReport: (reportId: string) => CommunityReport | null;
};

function clonePost(post: CommunityPost): CommunityPost {
  return {
    ...post,
    adminNotes: post.adminNotes.map((memo) => ({ ...memo }))
  };
}

function cloneReport(report: CommunityReport): CommunityReport {
  return { ...report };
}

function createMemoId(post: CommunityPost): string {
  return `${post.id}-MEMO-${String(post.adminNotes.length + 1).padStart(2, '0')}`;
}

function updatePostById(
  posts: CommunityPost[],
  postId: string,
  updater: (post: CommunityPost) => CommunityPost
): { posts: CommunityPost[]; updatedPost: CommunityPost | null } {
  let updatedPost: CommunityPost | null = null;
  const nextPosts = posts.map((post) => {
    if (post.id !== postId) {
      return post;
    }

    updatedPost = updater(post);
    return updatedPost;
  });

  return { posts: nextPosts, updatedPost };
}

export const useCommunityStore = create<CommunityState>((set, get) => ({
  posts: createInitialCommunityPosts(),
  reports: createInitialCommunityReports(),
  showPost: (payload) => {
    const { posts, updatedPost } = updatePostById(
      get().posts,
      payload.postId,
      (post) => ({
        ...post,
        status: '게시',
        lastModerationPolicyCode: undefined,
        lastModerationReason: payload.reason,
        lastModeratedAt: payload.moderatedAt
      })
    );

    if (!updatedPost) {
      return null;
    }

    set({ posts });
    return clonePost(updatedPost);
  },
  hidePost: (payload) => {
    const { posts, updatedPost } = updatePostById(
      get().posts,
      payload.postId,
      (post) => ({
        ...post,
        status: '숨김',
        lastModerationPolicyCode: payload.policyCode,
        lastModerationReason: payload.reason,
        lastModeratedAt: payload.moderatedAt
      })
    );

    if (!updatedPost) {
      return null;
    }

    set({ posts });
    return clonePost(updatedPost);
  },
  deletePost: (postId) => {
    const deletedPost = get().posts.find((post) => post.id === postId) ?? null;

    if (!deletedPost) {
      return null;
    }

    set({ posts: get().posts.filter((post) => post.id !== postId) });
    return clonePost(deletedPost);
  },
  addPostMemo: (payload) => {
    const { posts, updatedPost } = updatePostById(
      get().posts,
      payload.postId,
      (post) => {
        const nextMemo: CommunityAdminMemo = {
          id: createMemoId(post),
          ...payload.memo,
          createdAt: payload.createdAt
        };

        return {
          ...post,
          adminNotes: [nextMemo, ...post.adminNotes]
        };
      }
    );

    if (!updatedPost) {
      return null;
    }

    set({ posts });
    return clonePost(updatedPost);
  },
  resolveReport: (reportId) => {
    let updatedReport: CommunityReport | null = null;
    const reports = get().reports.map((report) => {
      if (report.id !== reportId) {
        return report;
      }

      updatedReport = {
        ...report,
        processStatus: '처리 완료'
      };
      return updatedReport;
    });

    if (!updatedReport) {
      return null;
    }

    set({ reports });
    return cloneReport(updatedReport);
  }
}));
