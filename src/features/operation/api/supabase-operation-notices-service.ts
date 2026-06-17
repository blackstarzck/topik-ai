import { supabaseClient } from '../../../shared/api/supabase-client';
import type { OperationNotice, OperationNoticeStatus } from '../model/types';
import type { SaveNoticePayload, ToggleNoticeStatusPayload } from './notices-service';

type OperationNoticeRow = {
  id: string;
  title: string;
  body_html: string;
  status: string;
  author: string;
  created_at: string | null;
  updated_at: string | null;
  updated_by: string | null;
};

const DB_NOTICE_STATUS_BY_UI: Record<OperationNoticeStatus, string> = {
  게시: 'published',
  숨김: 'hidden'
};

const UI_NOTICE_STATUS_BY_DB: Record<string, OperationNoticeStatus> = {
  published: '게시',
  hidden: '숨김'
};

const NOTICE_COLUMNS =
  'id, title, body_html, status, author, created_at, updated_at, updated_by';

function requireClient() {
  if (!supabaseClient) {
    throw new Error('Supabase client not configured');
  }
  return supabaseClient;
}

function requireReason(reason: string | undefined): string {
  const trimmed = (reason ?? '').trim();
  if (!trimmed) {
    throw new Error('사유/근거를 입력하세요. (RPC p_reason 필수)');
  }
  return trimmed;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new DOMException('Request aborted', 'AbortError');
  }
}

function toDate(ts: string | null | undefined): string {
  return ts ? ts.slice(0, 10) : '';
}

function toDateTime(ts: string | null | undefined): string {
  return ts ? ts.slice(0, 16).replace('T', ' ') : '';
}

function mapNoticeRow(row: OperationNoticeRow): OperationNotice {
  return {
    id: row.id,
    title: row.title,
    author: row.author,
    createdAt: toDate(row.created_at),
    status: UI_NOTICE_STATUS_BY_DB[row.status] ?? '숨김',
    bodyHtml: row.body_html,
    updatedAt: toDateTime(row.updated_at),
    updatedBy: row.updated_by ?? row.author
  };
}

export async function loadOperationNotices(
  signal?: AbortSignal
): Promise<OperationNotice[]> {
  const client = requireClient();
  const { data, error } = await client
    .from('operation_notices')
    .select(NOTICE_COLUMNS)
    .order('created_at', { ascending: false });

  throwIfAborted(signal);
  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as unknown as OperationNoticeRow[]).map(mapNoticeRow);
}

export async function loadOperationNotice(
  noticeId: string,
  signal?: AbortSignal
): Promise<OperationNotice | null> {
  const client = requireClient();
  const { data, error } = await client
    .from('operation_notices')
    .select(NOTICE_COLUMNS)
    .eq('id', noticeId)
    .maybeSingle();

  throwIfAborted(signal);
  if (error) {
    throw new Error(error.message);
  }

  return data ? mapNoticeRow(data as unknown as OperationNoticeRow) : null;
}

function defaultSaveReason(payload: SaveNoticePayload): string {
  return payload.id ? '공지 제목/본문 수정' : '신규 공지 저장(초기 상태: 숨김)';
}

export async function saveOperationNotice(
  payload: SaveNoticePayload,
  signal?: AbortSignal
): Promise<OperationNotice> {
  const client = requireClient();
  const reason = requireReason(payload.reason ?? defaultSaveReason(payload));

  const { data, error } = await client.rpc('admin_save_operation_notice', {
    p_id: payload.id ?? null,
    p_notice: {
      title: payload.title,
      body_html: payload.bodyHtml
    },
    p_reason: reason
  });

  throwIfAborted(signal);
  if (error) {
    throw new Error(error.message);
  }

  const saved = await loadOperationNotice(String(data), signal);
  if (!saved) {
    throw new Error('저장된 공지를 다시 불러오지 못했습니다.');
  }
  return saved;
}

export async function setOperationNoticeStatus(
  payload: ToggleNoticeStatusPayload,
  signal?: AbortSignal
): Promise<OperationNotice | null> {
  const client = requireClient();
  const reason = requireReason(payload.reason);
  const { error } = await client.rpc('admin_toggle_operation_notice_status', {
    p_notice_id: payload.noticeId,
    p_next_status: DB_NOTICE_STATUS_BY_UI[payload.nextStatus],
    p_reason: reason
  });

  throwIfAborted(signal);
  if (error) {
    throw new Error(error.message);
  }

  return loadOperationNotice(payload.noticeId, signal);
}

export async function deleteOperationNotice(
  noticeId: string,
  reason?: string,
  signal?: AbortSignal
): Promise<OperationNotice | null> {
  const client = requireClient();
  const confirmedReason = requireReason(reason);
  const target = await loadOperationNotice(noticeId, signal);
  const { error } = await client.rpc('admin_delete_operation_notice', {
    p_notice_id: noticeId,
    p_reason: confirmedReason
  });

  throwIfAborted(signal);
  if (error) {
    throw new Error(error.message);
  }

  return target;
}
