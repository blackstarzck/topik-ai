import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

declare const process: {
  env: Record<string, string | undefined>;
};

/**
 * /api/admin/invite — 슈퍼 관리자(platform_admin)가 새 관리자 계정을 이메일로 초대한다.
 * (관리자 계정 분리 계획 Phase 6)
 *
 * 흐름: 호출자 JWT 검증 → admin_accounts에서 active platform_admin 재확인 →
 *       auth.admin.generateLink(type=invite)로 사용자 생성 + 초대 링크 발급(메일 미발송) →
 *       handle_new_user가 만든 임시 profiles row 삭제(관리자 물리 분리 유지) →
 *       admin_finalize_invite RPC로 admin_accounts(status='invited')+권한 그랜트+감사 →
 *       앱 SMTP(nodemailer, SMTP_* env)로 초대 메일 직접 발송.
 *
 * 메일 경로: Supabase Auth 내장 메일(프로젝트 SMTP)이 아니라 앱 SMTP를 사용한다.
 *       관리자 초대만 영향(v13 가입 인증메일 등 공유 auth 메일 설정은 건드리지 않음).
 *
 * 보안: Service Role 키·SMTP 자격증명은 서버 전용. 브라우저는 자신의 access_token만 전달.
 *       admin_finalize_invite는 service_role 전용(EXECUTE)이며 p_caller_id를
 *       다시 platform_admin으로 검증한다.
 */

const ALLOWED_ROLES = new Set(['platform_admin', 'content_admin', 'org_admin']);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLE_LABEL: Record<string, string> = {
  platform_admin: '슈퍼 관리자',
  content_admin: '콘텐츠 관리자',
  org_admin: '기관 관리자'
};

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return Response.json(body, init);
}

function inviteEmailHtml(actionLink: string, role: string): string {
  const label = ROLE_LABEL[role] ?? role;
  return `<div style="font-family:Apple SD Gothic Neo,Malgun Gothic,sans-serif;line-height:1.6;color:#1f1f1f">
  <h2 style="margin:0 0 12px">TOPIK 관리자 콘솔 초대</h2>
  <p>${label} 권한으로 관리자 콘솔에 초대되었습니다. 아래 버튼을 눌러 비밀번호를 설정하고 로그인하면 계정이 활성화됩니다.</p>
  <p style="margin:20px 0"><a href="${actionLink}" style="display:inline-block;padding:11px 20px;background:#1677ff;color:#fff;border-radius:6px;text-decoration:none">초대 수락 · 비밀번호 설정</a></p>
  <p style="color:#888;font-size:12px">버튼이 열리지 않으면 다음 주소를 복사해 여세요:<br>${actionLink}</p>
</div>`;
}

async function handleInvite(request: Request): Promise<Response> {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  const redirectTo = process.env.ADMIN_INVITE_REDIRECT_URL;
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ ok: false, error: 'server_misconfigured' }, { status: 500 });
  }

  // 1) 호출자 JWT 검증
  const authHeader = request.headers.get('authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) {
    return jsonResponse({ ok: false, error: 'unauthenticated' }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  const callerId = userData?.user?.id;
  if (userError || !callerId) {
    return jsonResponse({ ok: false, error: 'invalid_session' }, { status: 401 });
  }

  // 2) 슈퍼 관리자 게이트 — active platform_admin만 관리자 초대 가능.
  const callerResult = await supabase
    .from('admin_accounts')
    .select('role, status')
    .eq('id', callerId)
    .maybeSingle();
  if (callerResult.error) {
    return jsonResponse({ ok: false, error: 'role_check_failed' }, { status: 500 });
  }
  const caller = callerResult.data as { role: string | null; status: string | null } | null;
  if (!caller || caller.status !== 'active' || caller.role !== 'platform_admin') {
    return jsonResponse({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  // 3) 요청 파싱
  let payload: { email?: unknown; role?: unknown; permission_keys?: unknown };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return jsonResponse({ ok: false, error: 'bad_request' }, { status: 400 });
  }
  const email = String(payload.email ?? '').trim().toLowerCase();
  const role = String(payload.role ?? '');
  const permissionKeys = Array.isArray(payload.permission_keys)
    ? payload.permission_keys.map((k) => String(k)).filter((k) => k.trim().length > 0)
    : [];
  if (!EMAIL_RE.test(email)) {
    return jsonResponse({ ok: false, error: 'invalid_email' }, { status: 400 });
  }
  if (!ALLOWED_ROLES.has(role)) {
    return jsonResponse({ ok: false, error: 'invalid_role' }, { status: 400 });
  }

  // 4) 초대 링크 생성 (메일 미발송) — 사용자 생성 + action_link 반환.
  const linkOptions: { data: Record<string, unknown>; redirectTo?: string } = {
    data: { account_type: 'admin' }
  };
  if (redirectTo) linkOptions.redirectTo = redirectTo;
  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: 'invite',
    email,
    options: linkOptions
  });
  const invitedUserId = linkData?.user?.id;
  const actionLink = linkData?.properties?.action_link;
  if (linkError || !invitedUserId || !actionLink) {
    const message = linkError?.message ?? 'invite_link_failed';
    // 이미 가입된 이메일 등은 409로 구분.
    const status = /already|registered|exists/i.test(message) ? 409 : 502;
    return jsonResponse({ ok: false, error: message }, { status });
  }

  // 5) 물리 분리 유지: handle_new_user가 만든 임시 profiles row 삭제.
  //    (신규 계정이라 종속 학습자 데이터 없음 → cascade 안전. 감사 FK는 auth.users라 무관.)
  const { error: deleteError } = await supabase.from('profiles').delete().eq('id', invitedUserId);
  if (deleteError) {
    return jsonResponse(
      { ok: false, error: `profile_separation_failed: ${deleteError.message}`, invited_user_id: invitedUserId },
      { status: 500 }
    );
  }

  // 6) admin_accounts 등록 + 권한 그랜트 + 감사 (service_role 전용 RPC).
  const { error: finalizeError } = await supabase.rpc('admin_finalize_invite', {
    p_caller_id: callerId,
    p_user_id: invitedUserId,
    p_email: email,
    p_display_name: null,
    p_role: role,
    p_keys: permissionKeys
  });
  if (finalizeError) {
    return jsonResponse(
      { ok: false, error: `finalize_failed: ${finalizeError.message}`, invited_user_id: invitedUserId },
      { status: 500 }
    );
  }

  // 7) 초대 메일 발송 — 앱 SMTP(nodemailer). 계정은 이미 생성됐으므로, 메일 실패는
  //    경고로만 반환(ok:true)하고 재발송 가능 상태로 둔다.
  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  if (!smtpHost || !smtpUser || !smtpPass) {
    return jsonResponse({ ok: true, invited_user_id: invitedUserId, email_sent: false, warning: 'smtp_not_configured' });
  }
  const smtpPort = Number(process.env.SMTP_PORT ?? 465);
  const fromAddress = process.env.SMTP_FROM ?? smtpUser;
  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: { user: smtpUser, pass: smtpPass }
  });
  try {
    await transporter.sendMail({
      from: fromAddress,
      to: email,
      subject: 'TOPIK 관리자 콘솔 초대',
      html: inviteEmailHtml(actionLink, role)
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'email_send_error';
    return jsonResponse({ ok: true, invited_user_id: invitedUserId, email_sent: false, warning: `email_send_failed: ${message}` });
  }

  return jsonResponse({ ok: true, invited_user_id: invitedUserId, email_sent: true });
}

export function POST(request: Request): Promise<Response> | Response {
  return handleInvite(request);
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
