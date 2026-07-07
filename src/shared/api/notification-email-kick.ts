import { isSupabaseConfigured, supabaseClient } from './supabase-client';

/**
 * 알림 이메일 워커 즉시 실행 kick.
 *
 * 기관 초대처럼 관리자 클릭으로 발생하는 트랜잭셔널 메일이 cron 주기(최대 15분)를
 * 기다리지 않도록, 발송 대기열 적재 직후 워커(/api/notifications/dispatch-email)를
 * 관리자 세션 토큰으로 즉시 호출한다.
 *
 * fire-and-forget: 호출 실패(네트워크/콜드스타트/env 미구성)는 무시한다 —
 * attempt 는 pending 그대로 남아 cron 이 수거하므로 발송 자체는 유실되지 않는다.
 * mock 모드(Supabase 미구성)에서는 no-op.
 */
export async function kickNotificationEmailDispatch(): Promise<void> {
  if (!isSupabaseConfigured || !supabaseClient) {
    return;
  }

  try {
    const { data } = await supabaseClient.auth.getSession();
    const accessToken = data.session?.access_token;
    if (!accessToken) {
      return;
    }

    await fetch('/api/notifications/dispatch-email', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` }
    });
  } catch {
    // cron 백업이 수거 — 침묵 실패가 설계.
  }
}
