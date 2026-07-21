import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

declare const process: {
  env: Record<string, string | undefined>;
};

type WorkerSchema = {
  public: {
    Tables: {
      notification_delivery_attempts: {
        Row: {
          id: string;
          user_id: string;
          dispatch_id: string;
          template_key: string;
          retry_count: number;
          created_at: string;
        };
        Insert: never;
        Update: {
          status?: string;
          provider_message_id?: string | null;
          error_code?: string | null;
          error_message?: string | null;
          retry_count?: number;
          sent_at?: string | null;
        };
        Relationships: [];
      };
      notification_dispatches: {
        Row: { id: string; template_id: string | null };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      notification_templates: {
        Row: {
          id: string;
          template_key: string;
          channel: string;
          status: string;
          class: string | null;
          subject: string | null;
          body_html: string | null;
          link_url: string | null;
          cta_label: string | null;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      profiles: {
        Row: { id: string; display_name: string | null };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      user_marketing_consent: {
        Row: { user_id: string; unsubscribe_token: string };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      admin_backup_report_events: {
        Row: { received_at: string };
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

type WorkerSupabaseClient = SupabaseClient<WorkerSchema, 'public'>;

type PendingAttempt = {
  id: string;
  user_id: string;
  dispatch_id: string;
  template_key: string;
  retry_count: number;
};

type ResolvedContent = {
  subject: string | null;
  bodyHtml: string | null;
  linkUrl: string | null;
  ctaLabel: string | null;
  templateClass: string | null;
  displayName: string | null;
};

const BATCH_LIMIT = 50;
const MAX_RETRY = 3;
const ERROR_MESSAGE_MAX = 500;
const DEFAULT_FROM = '도토리 토픽 <guest@keduall.com>';
const DISPLAY_NAME_FALLBACK = '학습자';
const SITE_URL_FALLBACK = 'https://app.talkpik.ai';

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return Response.json(body, init);
}

// 온프레미스 백업 서버가 통째로 죽어 보고 자체가 끊긴 경우(dead-man)를 잡는
// 신선도 판정. 임계 시간은 백업 주기 6h x 4회 + 여유 = 기본 26h.
export function isBackupReportStale(
  lastReceivedAt: string | null,
  now: Date,
  thresholdHours: number
): boolean {
  if (!lastReceivedAt) return true;
  const last = Date.parse(lastReceivedAt);
  if (Number.isNaN(last)) return true;
  return now.getTime() - last > thresholdHours * 3600 * 1000;
}

type BackupFreshness = 'fresh' | 'alerted' | 'skipped' | 'check_failed';

async function checkBackupReportFreshness(
  supabase: WorkerSupabaseClient,
  transporter: ReturnType<typeof nodemailer.createTransport>,
  fromAddress: string
): Promise<BackupFreshness> {
  const recipients = (process.env.BACKUP_ALERT_EMAILS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  if (recipients.length === 0) return 'skipped';
  const thresholdHours = Number(process.env.BACKUP_DEADMAN_HOURS ?? 26);
  try {
    const { data, error } = await supabase
      .from('admin_backup_report_events')
      .select('received_at')
      .order('received_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const lastReceivedAt = data?.received_at ?? null;
    if (!isBackupReportStale(lastReceivedAt, new Date(), thresholdHours)) {
      return 'fresh';
    }
    await transporter.sendMail({
      from: fromAddress,
      to: recipients.join(', '),
      subject: '[topik-prod 백업 경보] 백업 보고 두절 감지',
      text: [
        `백업 보고가 ${thresholdHours}시간 이상 수신되지 않았습니다.`,
        `마지막 수신: ${lastReceivedAt ?? '기록 없음'}`,
        '온프레미스 백업 서버 상태(전원·네트워크·타이머)를 확인하세요.',
        '상세: 관리자 화면 시스템 > 백업 관리'
      ].join('\n')
    });
    return 'alerted';
  } catch (error) {
    console.error('[dispatch-email] backup freshness check failed', error);
    return 'check_failed';
  }
}

function siteBaseUrl(): string {
  return (
    process.env.SITE_URL ??
    process.env.VITE_SITE_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    SITE_URL_FALLBACK
  ).replace(/\/+$/, '');
}

function resolveCtaHref(linkUrl: string | null): string | null {
  const path = (linkUrl ?? '').trim();
  if (!path) return null;
  return /^https?:\/\//i.test(path)
    ? path
    : `${siteBaseUrl()}/${path.replace(/^\/+/, '')}`;
}

// CTA 삽입 규칙(관리자가 메시지 ▸ 메일 템플릿에서 관리):
//   1) 본문에 {{cta_url}} 변수가 있으면 → CTA 링크로 치환하고 자동 버튼은 붙이지 않는다
//      (관리자가 편집기에서 버튼을 직접 만들어 스타일까지 제어). 링크 미설정 시 서비스 홈으로 치환.
//   2) 변수가 없고 CTA 링크가 있으면 → 본문 하단에 기본 앵커를 자동 삽입,
//      문구는 template.cta_label(빈 값이면 '알림 확인하기').
function applyCta(html: string, linkUrl: string | null, ctaLabel: string | null): string {
  const href = resolveCtaHref(linkUrl);

  if (html.includes('{{cta_url}}')) {
    return html.split('{{cta_url}}').join(href ?? siteBaseUrl());
  }

  if (!href) return html;
  const label = (ctaLabel ?? '').trim() || '알림 확인하기';
  return `${html}\n<p><a href="${href}">${label}</a></p>`;
}

function appendUnsubscribeLink(html: string, token: string | null): string {
  const value = (token ?? '').trim();
  if (!value) return html;
  const href = `${siteBaseUrl()}/api/notifications/unsubscribe?token=${encodeURIComponent(value)}`;
  return `${html}\n<p style="font-size:12px;color:#888"><a href="${href}">수신거부</a></p>`;
}

function renderDisplayName(source: string | null, displayName: string | null): string {
  const name =
    displayName && displayName.trim().length > 0
      ? displayName.trim()
      : DISPLAY_NAME_FALLBACK;
  return (source ?? '').split('{{display_name}}').join(name);
}

async function resolveUnsubscribeToken(
  supabase: WorkerSupabaseClient,
  userId: string
): Promise<string | null> {
  const { data } = await supabase
    .from('user_marketing_consent')
    .select('unsubscribe_token')
    .eq('user_id', userId)
    .maybeSingle();

  return data?.unsubscribe_token ?? null;
}

async function resolveRecipientEmail(
  supabase: WorkerSupabaseClient,
  userId: string
): Promise<string | null> {
  const { data, error } = await supabase.auth.admin.getUserById(userId);
  if (error || !data?.user?.email) return null;
  return data.user.email;
}

async function resolveContent(
  supabase: WorkerSupabaseClient,
  attempt: PendingAttempt
): Promise<ResolvedContent | null> {
  let subject: string | null = null;
  let bodyHtml: string | null = null;
  let linkUrl: string | null = null;
  let ctaLabel: string | null = null;
  let templateClass: string | null = null;
  let resolved = false;

  const { data: dispatch } = await supabase
    .from('notification_dispatches')
    .select('template_id')
    .eq('id', attempt.dispatch_id)
    .maybeSingle();

  if (dispatch?.template_id) {
    const { data: template } = await supabase
      .from('notification_templates')
      .select('subject, body_html, link_url, cta_label, class')
      .eq('id', dispatch.template_id)
      .maybeSingle();

    if (template) {
      subject = template.subject;
      bodyHtml = template.body_html;
      linkUrl = template.link_url;
      ctaLabel = template.cta_label;
      templateClass = template.class;
      resolved = true;
    }
  }

  if (!resolved) {
    const { data: byKey } = await supabase
      .from('notification_templates')
      .select('subject, body_html, link_url, cta_label, class')
      .eq('template_key', attempt.template_key)
      .eq('channel', 'email')
      .eq('status', 'active')
      .maybeSingle();

    if (!byKey) return null;
    subject = byKey.subject;
    bodyHtml = byKey.body_html;
    linkUrl = byKey.link_url;
    ctaLabel = byKey.cta_label;
    templateClass = byKey.class;
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', attempt.user_id)
    .maybeSingle();

  return {
    subject,
    bodyHtml,
    linkUrl,
    ctaLabel,
    templateClass,
    displayName: profile?.display_name ?? null
  };
}

async function applyFailure(
  supabase: WorkerSupabaseClient,
  attempt: PendingAttempt,
  errorCode: string,
  errorMessage: string
): Promise<void> {
  const nextRetry = (attempt.retry_count ?? 0) + 1;
  const terminal = nextRetry >= MAX_RETRY;
  const { error } = await supabase
    .from('notification_delivery_attempts')
    .update({
      status: terminal ? 'failed' : 'pending',
      error_code: errorCode,
      error_message: errorMessage,
      retry_count: nextRetry,
      sent_at: null
    })
    .eq('id', attempt.id);

  if (error) {
    console.error('[dispatch-email] mark failure failed', attempt.id, error.message);
  }
}

async function dispatchPendingEmailAttempts(): Promise<Response> {
  // 발송 transport = 커스텀 SMTP(예: Daou Office outbound). SMTP 미구성 시 정직한
  // no-op(503) — attempt를 일절 건드리지 않는다. (Resend 의존 제거)
  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  if (!smtpHost || !smtpUser || !smtpPass) {
    return jsonResponse({ ok: false, error: 'smtp_not_configured' }, { status: 503 });
  }

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ ok: false, error: 'server_misconfigured' }, { status: 500 });
  }

  const supabase = createClient<WorkerSchema, 'public'>(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false }
  });
  const fromAddress = process.env.SMTP_FROM ?? DEFAULT_FROM;
  const smtpPort = Number(process.env.SMTP_PORT ?? 465);
  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465, // 465 = implicit TLS
    auth: { user: smtpUser, pass: smtpPass }
  });

  const { data: attempts, error: selectError } = await supabase
    .from('notification_delivery_attempts')
    .select('id, user_id, dispatch_id, template_key, retry_count, created_at')
    .eq('channel', 'email')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(BATCH_LIMIT);

  if (selectError) {
    console.error('[dispatch-email] select pending failed', selectError.message);
    return jsonResponse({ ok: false, error: 'query_failed' }, { status: 500 });
  }

  const pending = (attempts ?? []) as PendingAttempt[];
  let processed = 0;
  let sent = 0;
  let failed = 0;

  for (const attempt of pending) {
    processed += 1;

    const recipient = await resolveRecipientEmail(supabase, attempt.user_id);
    if (!recipient) {
      failed += 1;
      await applyFailure(
        supabase,
        attempt,
        'no_recipient_email',
        'could not resolve recipient email'
      );
      continue;
    }

    const content = await resolveContent(supabase, attempt);
    if (!content) {
      failed += 1;
      await applyFailure(
        supabase,
        attempt,
        'no_template',
        'could not resolve active email template'
      );
      continue;
    }

    const subject = renderDisplayName(content.subject, content.displayName);
    let html = applyCta(
      renderDisplayName(content.bodyHtml, content.displayName),
      content.linkUrl,
      content.ctaLabel
    );

    if (content.templateClass === 'marketing') {
      const token = await resolveUnsubscribeToken(supabase, attempt.user_id);
      html = appendUnsubscribeLink(html, token);
    }

    // SMTP 전송. 정직성 경계: 전송이 성공(resolve)했을 때만 'sent'로 기록.
    try {
      const info = await transporter.sendMail({
        from: fromAddress,
        to: recipient,
        subject,
        html
      });

      const { error: updateError } = await supabase
        .from('notification_delivery_attempts')
        .update({
          status: 'sent',
          provider_message_id: info.messageId ?? null,
          error_code: null,
          error_message: null,
          sent_at: new Date().toISOString()
        })
        .eq('id', attempt.id);

      if (updateError) {
        console.error('[dispatch-email] mark sent failed', attempt.id, updateError.message);
      }
      sent += 1;
    } catch (error) {
      failed += 1;
      await applyFailure(
        supabase,
        attempt,
        'smtp_error',
        error instanceof Error ? error.message.slice(0, ERROR_MESSAGE_MAX) : 'smtp send error'
      );
    }
  }

  // 일일 크론에 편승한 백업 dead-man 감시. 발송 처리 결과에는 영향을 주지 않는다.
  const backupFreshness = await checkBackupReportFreshness(supabase, transporter, fromAddress);

  return jsonResponse({ ok: true, processed, sent, failed, backupFreshness });
}

function isAuthorizedManualWorkerRequest(request: Request): boolean {
  const workerSecret = process.env.NOTIFICATION_WORKER_SECRET;
  const provided = request.headers.get('x-worker-secret');
  return Boolean(workerSecret && provided === workerSecret);
}

function isAuthorizedCronRequest(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  const provided = request.headers.get('authorization');
  return Boolean(cronSecret && provided === `Bearer ${cronSecret}`);
}

// 관리자 즉시 발송 kick — 초대 등 클릭 유발 트랜잭셔널 메일이 cron 주기(최대 15분)를
// 기다리지 않도록, 활성 관리자 세션(Bearer JWT)이면 워커 실행을 허용한다.
// 검증 패턴은 api/admin/invite.ts 와 동일(JWT → admin_accounts active 확인).
// 실패해도 attempt 는 pending 그대로라 cron 이 수거한다(자가 복구).
async function isAuthorizedAdminRequest(request: Request): Promise<boolean> {
  const authHeader = request.headers.get('authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) return false;

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  if (!supabaseUrl || !serviceRoleKey) return false;

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false }
  });
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  const callerId = userData?.user?.id;
  if (userError || !callerId) return false;

  const { data: account, error: accountError } = await supabase
    .from('admin_accounts')
    .select('status')
    .eq('id', callerId)
    .maybeSingle();
  if (accountError) return false;
  return (account as { status: string | null } | null)?.status === 'active';
}

export function GET(request: Request): Promise<Response> | Response {
  if (!isAuthorizedCronRequest(request)) {
    return jsonResponse({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  return dispatchPendingEmailAttempts();
}

export async function POST(request: Request): Promise<Response> {
  if (!isAuthorizedManualWorkerRequest(request) && !(await isAuthorizedAdminRequest(request))) {
    return jsonResponse({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  return dispatchPendingEmailAttempts();
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method === 'GET') return GET(request);
    if (request.method === 'POST') return POST(request);
    return jsonResponse(
      { error: 'Method Not Allowed', allow: ['GET', 'POST'] },
      { status: 405, headers: { Allow: 'GET, POST' } }
    );
  }
};
