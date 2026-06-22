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

function siteBaseUrl(): string {
  return (
    process.env.SITE_URL ??
    process.env.VITE_SITE_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    SITE_URL_FALLBACK
  ).replace(/\/+$/, '');
}

function appendCtaLink(html: string, linkUrl: string | null): string {
  const path = (linkUrl ?? '').trim();
  if (!path) return html;
  const href = /^https?:\/\//i.test(path)
    ? path
    : `${siteBaseUrl()}/${path.replace(/^\/+/, '')}`;
  return `${html}\n<p><a href="${href}">알림 확인하기</a></p>`;
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
      .select('subject, body_html, link_url, class')
      .eq('id', dispatch.template_id)
      .maybeSingle();

    if (template) {
      subject = template.subject;
      bodyHtml = template.body_html;
      linkUrl = template.link_url;
      templateClass = template.class;
      resolved = true;
    }
  }

  if (!resolved) {
    const { data: byKey } = await supabase
      .from('notification_templates')
      .select('subject, body_html, link_url, class')
      .eq('template_key', attempt.template_key)
      .eq('channel', 'email')
      .eq('status', 'active')
      .maybeSingle();

    if (!byKey) return null;
    subject = byKey.subject;
    bodyHtml = byKey.body_html;
    linkUrl = byKey.link_url;
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
    let html = appendCtaLink(
      renderDisplayName(content.bodyHtml, content.displayName),
      content.linkUrl
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

  return jsonResponse({ ok: true, processed, sent, failed });
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

export function GET(request: Request): Promise<Response> | Response {
  if (!isAuthorizedCronRequest(request)) {
    return jsonResponse({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  return dispatchPendingEmailAttempts();
}

export function POST(request: Request): Promise<Response> | Response {
  if (!isAuthorizedManualWorkerRequest(request)) {
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
