import { supabaseClient } from '../../../shared/api/supabase-client';
import type { AuthEmailStatus, AuthEmailSyncStatus, AuthEmailTemplate, AuthEmailType } from '../model/auth-email-types';
import { AUTH_EMAIL_TYPE_ORDER } from '../model/auth-email-types';

/**
 * Supabase 어댑터 — auth_email_templates (admin-0020).
 * 읽기: RLS admin select. 쓰기: admin RPC 2종(p_reason 필수) 단일 경로.
 * 동기화: 서버 엔드포인트(/api/auth-email/sync)가 Management API로 PATCH+GET을
 *         수행하고, 검증된 live 상태를 admin_mark_auth_email_synced로 기록한다.
 */

const COLUMNS =
  'id, auth_type, subject, body_html, status, sync_status, synced_at, sync_error, last_live_checked_at, updated_at';

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

function toDateTime(ts: string | null | undefined): string | undefined {
  return ts ? ts.slice(0, 16).replace('T', ' ') : undefined;
}

const ORDER_INDEX: Record<string, number> = AUTH_EMAIL_TYPE_ORDER.reduce(
  (acc, authType, index) => {
    acc[authType] = index;
    return acc;
  },
  {} as Record<string, number>
);

function mapRow(row: Record<string, unknown>): AuthEmailTemplate {
  return {
    id: String(row.id),
    authType: row.auth_type as AuthEmailType,
    subject: (row.subject as string) ?? '',
    bodyHtml: (row.body_html as string) ?? '',
    status: (row.status as AuthEmailStatus) ?? 'draft',
    syncStatus: (row.sync_status as AuthEmailSyncStatus) ?? 'draft',
    syncedAt: toDateTime(row.synced_at as string | null),
    syncError: (row.sync_error as string | null) ?? undefined,
    lastLiveCheckedAt: toDateTime(row.last_live_checked_at as string | null),
    updatedAt: toDateTime(row.updated_at as string | null)
  };
}

export async function listSupabaseAuthEmailTemplates(): Promise<AuthEmailTemplate[]> {
  const client = requireClient();
  const { data, error } = await client.from('auth_email_templates').select(COLUMNS);
  if (error) {
    throw new Error(error.message);
  }
  return (data ?? [])
    .map((row) => mapRow(row as Record<string, unknown>))
    .sort((a, b) => (ORDER_INDEX[a.authType] ?? 99) - (ORDER_INDEX[b.authType] ?? 99));
}

async function loadOne(authType: AuthEmailType): Promise<AuthEmailTemplate | null> {
  const client = requireClient();
  const { data, error } = await client
    .from('auth_email_templates')
    .select(COLUMNS)
    .eq('auth_type', authType)
    .maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  return data ? mapRow(data as Record<string, unknown>) : null;
}

export async function saveSupabaseAuthEmailTemplate(input: {
  authType: AuthEmailType;
  subject: string;
  bodyHtml: string;
  status?: string;
  reason?: string;
}): Promise<AuthEmailTemplate> {
  const client = requireClient();
  const reason = requireReason(input.reason);
  const template: Record<string, unknown> = {
    subject: input.subject,
    body_html: input.bodyHtml
  };
  if (input.status) {
    template.status = input.status;
  }
  const { error } = await client.rpc('admin_save_auth_email_template', {
    p_auth_type: input.authType,
    p_template: template,
    p_reason: reason
  });
  if (error) {
    throw new Error(error.message);
  }
  const saved = await loadOne(input.authType);
  if (!saved) {
    throw new Error('저장된 인증 메일 템플릿을 다시 불러오지 못했습니다.');
  }
  return saved;
}

export async function syncSupabaseAuthEmailTemplate(
  authType: AuthEmailType,
  reason?: string
): Promise<AuthEmailTemplate> {
  const client = requireClient();
  const trimmedReason = requireReason(reason);

  // Management API 토큰은 서버 전용 — 브라우저는 자신의 access_token으로 서버를 호출한다.
  const { data: sessionData } = await client.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) {
    throw new Error('로그인 세션이 없습니다. 다시 로그인 후 시도하세요.');
  }

  let result: { ok?: boolean; live_hash?: string; snapshot?: unknown; error?: string } = {};
  let httpOk = false;
  let httpStatus = 0;
  try {
    const res = await fetch('/api/auth-email/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ auth_type: authType, reason: trimmedReason })
    });
    httpOk = res.ok;
    httpStatus = res.status;
    result = (await res.json().catch(() => ({}))) as typeof result;
  } catch (networkError) {
    result = { ok: false, error: networkError instanceof Error ? networkError.message : 'network error' };
  }

  const succeeded = Boolean(httpOk && result.ok);

  // 성공/실패 모두 감사 기록(단일 경로).
  const { error: markError } = await client.rpc('admin_mark_auth_email_synced', {
    p_auth_type: authType,
    p_result: {
      ok: succeeded,
      live_hash: result.live_hash ?? null,
      snapshot: result.snapshot ?? null,
      error: result.error ?? (httpOk ? null : `HTTP ${httpStatus || 0}`)
    },
    p_reason: trimmedReason
  });
  if (markError) {
    throw new Error(markError.message);
  }

  if (!succeeded) {
    throw new Error(result.error || `동기화 실패 (HTTP ${httpStatus || 0})`);
  }

  const saved = await loadOne(authType);
  if (!saved) {
    throw new Error('동기화 후 인증 메일 템플릿을 다시 불러오지 못했습니다.');
  }
  return saved;
}
