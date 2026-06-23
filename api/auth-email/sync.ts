import { createClient } from '@supabase/supabase-js';

declare const process: {
  env: Record<string, string | undefined>;
};

/**
 * /api/auth-email/sync — admin이 편집한 인증 메일 템플릿을 Supabase Auth 내장
 * 템플릿에 동기화(push)한다. (docs/plans/auth-email-template-management-plan.md, P3)
 *
 * 흐름: 관리자 JWT 검증 → profiles.app_role 확인 → auth_email_templates 읽기 →
 *       Management API GET(스냅샷) → PATCH(mailer_subjects/templates_*_content) →
 *       GET 재검증(live == 푸시값) → { ok, snapshot, error } 반환.
 * 호출 측(브라우저)이 admin_mark_auth_email_synced로 결과를 감사 기록한다.
 *
 * 보안: Management API 토큰/Service Role 키는 서버 전용. 브라우저는 자신의
 *       access_token만 전달한다. 토큰/시크릿은 응답·로그에 노출하지 않는다.
 */

const AUTH_TYPES = [
  'confirmation',
  'magic_link',
  'recovery',
  'email_change',
  'invite',
  'reauthentication'
] as const;
type AuthEmailType = (typeof AUTH_TYPES)[number];

const ADMIN_ROLES = new Set(['content_admin', 'platform_admin']);
const MANAGEMENT_BASE = 'https://api.supabase.com/v1/projects';
const ERROR_SNIPPET_MAX = 200;

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return Response.json(body, init);
}

function subjectKey(authType: AuthEmailType): string {
  return `mailer_subjects_${authType}`;
}

function contentKey(authType: AuthEmailType): string {
  return `mailer_templates_${authType}_content`;
}

async function syncAuthEmailTemplate(request: Request): Promise<Response> {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  const managementToken = process.env.SUPABASE_MANAGEMENT_API_TOKEN ?? process.env.SUPABASE_ACCESS_TOKEN;
  const projectRef = process.env.SUPABASE_PROJECT_REF ?? 'fglggyfvzjdsbyckinqa';

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ ok: false, error: 'server_misconfigured' }, { status: 500 });
  }
  if (!managementToken) {
    return jsonResponse({ ok: false, error: 'management_token_missing' }, { status: 500 });
  }

  // 1) 관리자 JWT 검증
  const authHeader = request.headers.get('authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) {
    return jsonResponse({ ok: false, error: 'unauthenticated' }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  const userId = userData?.user?.id;
  if (userError || !userId) {
    return jsonResponse({ ok: false, error: 'invalid_session' }, { status: 401 });
  }

  // 2) app_role 게이트 (content_admin/platform_admin — private.is_admin과 동일 집합)
  const profileResult = await supabase
    .from('profiles')
    .select('app_role')
    .eq('id', userId)
    .maybeSingle();
  if (profileResult.error) {
    return jsonResponse({ ok: false, error: 'role_check_failed' }, { status: 500 });
  }
  const profile = profileResult.data as { app_role: string | null } | null;
  if (!profile || !ADMIN_ROLES.has(String(profile.app_role ?? ''))) {
    return jsonResponse({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  // 3) 요청 파싱
  let payload: { auth_type?: unknown };
  try {
    payload = (await request.json()) as { auth_type?: unknown };
  } catch {
    return jsonResponse({ ok: false, error: 'bad_request' }, { status: 400 });
  }
  const authTypeRaw = String(payload.auth_type ?? '');
  if (!(AUTH_TYPES as readonly string[]).includes(authTypeRaw)) {
    return jsonResponse({ ok: false, error: 'invalid_auth_type' }, { status: 400 });
  }
  const authType = authTypeRaw as AuthEmailType;

  // 4) DB 편집본 읽기 (편집 SoT)
  const templateResult = await supabase
    .from('auth_email_templates')
    .select('subject, body_html')
    .eq('auth_type', authType)
    .maybeSingle();
  if (templateResult.error) {
    return jsonResponse({ ok: false, error: 'template_read_failed' }, { status: 500 });
  }
  const template = templateResult.data as { subject: string | null; body_html: string | null } | null;
  if (!template) {
    return jsonResponse({ ok: false, error: 'template_not_found' }, { status: 404 });
  }
  const subject = String(template.subject ?? '');
  const bodyHtml = String(template.body_html ?? '');
  if (!subject.trim() || !bodyHtml.trim()) {
    return jsonResponse({ ok: false, error: 'template_empty' }, { status: 400 });
  }

  const sKey = subjectKey(authType);
  const cKey = contentKey(authType);
  const configUrl = `${MANAGEMENT_BASE}/${projectRef}/config/auth`;
  const managementHeaders = {
    Authorization: `Bearer ${managementToken}`,
    'Content-Type': 'application/json'
  };

  // 5) GET 이전 상태(롤백 스냅샷)
  let snapshot: Record<string, unknown> | null = null;
  try {
    const beforeRes = await fetch(configUrl, { headers: managementHeaders });
    if (!beforeRes.ok) {
      const text = await beforeRes.text();
      return jsonResponse(
        { ok: false, error: `management_get_failed: ${beforeRes.status} ${text.slice(0, ERROR_SNIPPET_MAX)}` },
        { status: 502 }
      );
    }
    const beforeCfg = (await beforeRes.json()) as Record<string, unknown>;
    snapshot = { [sKey]: beforeCfg[sKey] ?? null, [cKey]: beforeCfg[cKey] ?? null };
  } catch (error) {
    return jsonResponse(
      { ok: false, error: error instanceof Error ? error.message : 'management_get_error' },
      { status: 502 }
    );
  }

  // 6) PATCH (변경 키 일괄)
  try {
    const patchRes = await fetch(configUrl, {
      method: 'PATCH',
      headers: managementHeaders,
      body: JSON.stringify({ [sKey]: subject, [cKey]: bodyHtml })
    });
    if (!patchRes.ok) {
      const text = await patchRes.text();
      return jsonResponse(
        { ok: false, snapshot, error: `management_patch_failed: ${patchRes.status} ${text.slice(0, ERROR_SNIPPET_MAX)}` },
        { status: 502 }
      );
    }
  } catch (error) {
    return jsonResponse(
      { ok: false, snapshot, error: error instanceof Error ? error.message : 'management_patch_error' },
      { status: 502 }
    );
  }

  // 7) GET 재검증 (live == 푸시값일 때만 ok)
  try {
    const afterRes = await fetch(configUrl, { headers: managementHeaders });
    if (!afterRes.ok) {
      const text = await afterRes.text();
      return jsonResponse(
        { ok: false, snapshot, error: `management_verify_failed: ${afterRes.status} ${text.slice(0, ERROR_SNIPPET_MAX)}` },
        { status: 502 }
      );
    }
    const afterCfg = (await afterRes.json()) as Record<string, unknown>;
    const liveSubject = String(afterCfg[sKey] ?? '');
    const liveBody = String(afterCfg[cKey] ?? '');
    const matches = liveSubject === subject && liveBody === bodyHtml;
    return jsonResponse({
      ok: matches,
      snapshot,
      error: matches ? undefined : 'live config does not match pushed template'
    });
  } catch (error) {
    return jsonResponse(
      { ok: false, snapshot, error: error instanceof Error ? error.message : 'management_verify_error' },
      { status: 502 }
    );
  }
}

export function POST(request: Request): Promise<Response> | Response {
  return syncAuthEmailTemplate(request);
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method === 'POST') {
      return POST(request);
    }
    return jsonResponse(
      { error: 'Method Not Allowed', allow: ['POST'] },
      { status: 405, headers: { Allow: 'POST' } }
    );
  }
};
