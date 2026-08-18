import type {
  CommunityAdminMemo,
  CommunityPolicyCode,
  CommunityPost,
  CommunityReport,
  CommunityReportResolutionAction
} from '../model/types';
import type {
  AddCommunityPostMemoPayload,
  ModerateCommunityPostPayload,
  ResolveCommunityReportPayload
} from './community-service';
import { requireClient, requireReason, throwIfAborted } from '@/shared/api/supabase-service-utils';
import { toDateOnly as toDate, toDateTimeMinutes as toDateTime } from '@/shared/model/date-format';

type CommunityPostRow = {
  id: string;
  title: string;
  content_html: string | null;
  author_id: string;
  author_name: string;
  board: string;
  status: string;
  last_moderation_policy_code: string | null;
  reports_count: number | null;
  created_at: string | null;
  updated_at: string | null;
  updated_by: string | null;
  community_post_admin_notes?: CommunityPostAdminNoteRow[];
};

type CommunityPostAdminNoteRow = {
  id: string;
  post_id: string;
  title: string;
  type: string;
  author_id: string;
  author_name: string;
  content: string;
  created_at: string | null;
};

type CommunityReportRow = {
  id: string;
  target_post_id: string | null;
  target_user_id: string;
  target_user_name: string;
  reporter_id: string;
  reporter_name: string;
  reason: string;
  reason_code: string | null;
  process_status: string;
  resolution_action: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string | null;
};

const UI_POST_STATUS_BY_DB: Record<string, string> = {
  published: '게시',
  hidden: '숨김'
};

const UI_REPORT_STATUS_BY_DB: Record<string, string> = {
  pending: '처리 대기',
  resolved: '처리 완료'
};

const POST_COLUMNS = [
  'id',
  'title',
  'content_html',
  'author_id',
  'author_name',
  'board',
  'status',
  'last_moderation_policy_code',
  'reports_count',
  'created_at',
  'updated_at',
  'updated_by',
  'community_post_admin_notes(id, post_id, title, type, author_id, author_name, content, created_at)'
].join(', ');

const REPORT_COLUMNS = [
  'id',
  'target_post_id',
  'target_user_id',
  'target_user_name',
  'reporter_id',
  'reporter_name',
  'reason',
  'reason_code',
  'process_status',
  'resolution_action',
  'resolved_by',
  'resolved_at',
  'created_at'
].join(', ');

function mapNoteRow(row: CommunityPostAdminNoteRow): CommunityAdminMemo {
  return {
    id: row.id,
    title: row.title,
    type: row.type,
    authorId: row.author_id,
    authorName: row.author_name,
    createdAt: toDateTime(row.created_at),
    content: row.content
  };
}

function mapPostRow(row: CommunityPostRow): CommunityPost {
  const notes = [...(row.community_post_admin_notes ?? [])]
    .sort((left, right) => (right.created_at ?? '').localeCompare(left.created_at ?? ''))
    .map(mapNoteRow);

  return {
    id: row.id,
    title: row.title,
    content: row.content_html ?? '',
    contentHtml: row.content_html ?? '',
    authorName: row.author_name,
    authorId: row.author_id,
    board: row.board,
    createdAt: toDate(row.created_at),
    views: 0,
    comments: 0,
    reports: row.reports_count ?? 0,
    status: UI_POST_STATUS_BY_DB[row.status] ?? '숨김',
    adminNotes: notes,
    lastModerationPolicyCode:
      (row.last_moderation_policy_code as CommunityPolicyCode | null) ?? undefined,
    lastModeratedAt: toDateTime(row.updated_at),
    lastModerationReason: undefined
  };
}

function mapReportRow(row: CommunityReportRow): CommunityReport {
  return {
    id: row.id,
    targetPostId: row.target_post_id ?? '',
    targetUserId: row.target_user_id,
    targetUserName: row.target_user_name,
    reporterId: row.reporter_id,
    reporterName: row.reporter_name,
    reason: row.reason,
    reasonCode: row.reason_code ?? undefined,
    createdAt: toDateTime(row.created_at),
    processStatus: UI_REPORT_STATUS_BY_DB[row.process_status] ?? '처리 대기',
    resolutionAction:
      (row.resolution_action as CommunityReportResolutionAction | null) ??
      undefined,
    resolvedBy: row.resolved_by ?? undefined,
    resolvedAt: toDateTime(row.resolved_at)
  };
}

export async function loadCommunityPosts(
  signal?: AbortSignal
): Promise<CommunityPost[]> {
  const client = requireClient();
  const { data, error } = await client
    .from('community_posts')
    .select(POST_COLUMNS)
    .order('created_at', { ascending: false });

  throwIfAborted(signal);
  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as unknown as CommunityPostRow[]).map(mapPostRow);
}

export async function loadCommunityPost(
  postId: string,
  signal?: AbortSignal
): Promise<CommunityPost | null> {
  const client = requireClient();
  const { data, error } = await client
    .from('community_posts')
    .select(POST_COLUMNS)
    .eq('id', postId)
    .maybeSingle();

  throwIfAborted(signal);
  if (error) {
    throw new Error(error.message);
  }

  return data ? mapPostRow(data as unknown as CommunityPostRow) : null;
}

export async function loadCommunityReports(
  signal?: AbortSignal
): Promise<CommunityReport[]> {
  const client = requireClient();
  const { data, error } = await client
    .from('community_reports')
    .select(REPORT_COLUMNS)
    .order('created_at', { ascending: false });

  throwIfAborted(signal);
  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as unknown as CommunityReportRow[]).map(mapReportRow);
}

export async function loadCommunityReport(
  reportId: string,
  signal?: AbortSignal
): Promise<CommunityReport | null> {
  const client = requireClient();
  const { data, error } = await client
    .from('community_reports')
    .select(REPORT_COLUMNS)
    .eq('id', reportId)
    .maybeSingle();

  throwIfAborted(signal);
  if (error) {
    throw new Error(error.message);
  }

  return data ? mapReportRow(data as unknown as CommunityReportRow) : null;
}

export async function showCommunityPost(
  payload: ModerateCommunityPostPayload,
  signal?: AbortSignal
): Promise<CommunityPost | null> {
  const client = requireClient();
  const reason = requireReason(payload.reason);
  const { error } = await client.rpc('admin_show_community_post', {
    p_post_id: payload.postId,
    p_reason: reason,
    p_policy_code: payload.policyCode ?? null
  });

  throwIfAborted(signal);
  if (error) {
    throw new Error(error.message);
  }

  return loadCommunityPost(payload.postId, signal);
}

export async function hideCommunityPost(
  payload: ModerateCommunityPostPayload,
  signal?: AbortSignal
): Promise<CommunityPost | null> {
  const client = requireClient();
  const reason = requireReason(payload.reason);
  const { error } = await client.rpc('admin_hide_community_post', {
    p_post_id: payload.postId,
    p_reason: reason,
    p_policy_code: payload.policyCode ?? null
  });

  throwIfAborted(signal);
  if (error) {
    throw new Error(error.message);
  }

  return loadCommunityPost(payload.postId, signal);
}

export async function deleteCommunityPost(
  postId: string,
  reason: string,
  signal?: AbortSignal
): Promise<CommunityPost | null> {
  const client = requireClient();
  const target = await loadCommunityPost(postId, signal);
  const { error } = await client.rpc('admin_delete_community_post', {
    p_post_id: postId,
    p_reason: requireReason(reason)
  });

  throwIfAborted(signal);
  if (error) {
    throw new Error(error.message);
  }

  return target;
}

export async function addCommunityPostMemo(
  payload: AddCommunityPostMemoPayload,
  signal?: AbortSignal
): Promise<CommunityPost | null> {
  const client = requireClient();
  const { error } = await client.rpc('admin_add_community_post_memo', {
    p_post_id: payload.postId,
    p_memo: {
      title: payload.title,
      type: payload.type,
      author_id: payload.authorId,
      author_name: payload.authorName,
      content: payload.content
    },
    p_reason: payload.content
  });

  throwIfAborted(signal);
  if (error) {
    throw new Error(error.message);
  }

  return loadCommunityPost(payload.postId, signal);
}

export async function resolveCommunityReport(
  payload: ResolveCommunityReportPayload,
  signal?: AbortSignal
): Promise<CommunityReport | null> {
  const client = requireClient();
  const { error } = await client.rpc('admin_resolve_community_report', {
    p_report_id: payload.reportId,
    p_action: payload.action,
    p_reason: requireReason(payload.reason)
  });

  throwIfAborted(signal);
  if (error) {
    throw new Error(error.message);
  }

  return loadCommunityReport(payload.reportId, signal);
}
