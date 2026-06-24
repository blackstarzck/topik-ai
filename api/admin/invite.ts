import { createClient } from '@supabase/supabase-js';

declare const process: {
  env: Record<string, string | undefined>;
};

/**
 * /api/admin/invite — 슈퍼 관리자(platform_admin)가 새 관리자 계정을 이메일로 초대한다.
 * (관리자 계정 분리 계획 Phase 6)
 *
 * 흐름: 호출자 JWT 검증 → admin_accounts에서 active platform_admin 재확인 →
 *       auth.admin.inviteUserByEmail(account_type='admin' 메타) → handle_new_user가
 *       만든 임시 profiles row 삭제(관리자 물리 분리 유지) → admin_finalize_invite RPC로
 *       admin_accounts(status='invited') + 권한 그랜트 + 감사 기록.
 *
 * 보안: Service Role 키는 서버 전용. 브라우저는 자신의 access_token만 전달한다.
 *       admin_finalize_invite는 service_role 전용(EXECUTE)이며 p_caller_id를
 *       다시 platform_admin으로 검증한다.
 */

const ALLOWED_ROLES = new Set(['platform_admin', 'content_admin', 'org_admin']);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return Response.json(body, init);
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

  // 4) Supabase 초대 발송 (account_type='admin' → 학습자 가입과 구분).
  const inviteOptions: { data: Record<string, unknown>; redirectTo?: string } = {
    data: { account_type: 'admin' }
  };
  if (redirectTo) inviteOptions.redirectTo = redirectTo;
  const { data: invited, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(
    email,
    inviteOptions
  );
  const invitedUserId = invited?.user?.id;
  if (inviteError || !invitedUserId) {
    const message = inviteError?.message ?? 'invite_failed';
    // 이미 가입된 이메일 등은 409로 구분.
    const status = /already|registered|exists/i.test(message) ? 409 : 502;
    return jsonResponse({ ok: false, error: message }, { status });
  }

  // 5) 물리 분리 유지: handle_new_user가 만든 임시 profiles row 삭제.
  //    (신규 계정이라 종속 학습자 데이터 없음 → cascade 안전. 감사 FK는 auth.users라 무관.)
  const { error: deleteError } = await supabase.from('profiles').delete().eq('id', invitedUserId);
  if (deleteError) {
    // 분리 실패 시 인박스 오염 방지를 위해 알리되, 계정 자체는 생성됨.
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

  return jsonResponse({ ok: true, invited_user_id: invitedUserId });
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
