export type CommunityPostStatus = string;

export type CommunityPolicyCode =
  | 'SPAM'
  | 'ABUSE'
  | 'AD'
  | 'PRIVACY'
  | 'DUPLICATE'
  | 'OTHER';

export type CommunityAdminMemo = {
  id: string;
  title: string;
  type: string;
  authorId: string;
  authorName: string;
  createdAt: string;
  content: string;
};

export type CommunityPost = {
  id: string;
  title: string;
  content: string;
  contentHtml: string;
  authorName: string;
  authorId: string;
  board: string;
  createdAt: string;
  views: number;
  comments: number;
  reports: number;
  status: CommunityPostStatus;
  adminNotes: CommunityAdminMemo[];
  lastModerationPolicyCode?: CommunityPolicyCode;
  lastModerationReason?: string;
  lastModeratedAt?: string;
};

export type CommunityReportProcessStatus = string;

export type CommunityReport = {
  id: string;
  targetPostId: string;
  targetUserId: string;
  targetUserName: string;
  reporterId: string;
  reporterName: string;
  reason: string;
  createdAt: string;
  processStatus: CommunityReportProcessStatus;
};
