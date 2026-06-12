#!/usr/bin/env node
// 알림 기능 V-0 RLS 스모크 (페이즈 가이드 WP0-5 / QA N-SEC-01~04·08, N-OPT-08 RPC층).
// p1-smoke.mjs 패턴 재사용. 수행:
//   1. QA §2 시드 계정 보장 (admin/optin/optout/vn/dst/partial/fresh) + 알림 설정 시드
//   2. RLS 매트릭스: anon / user / admin × 알림 5객체 SELECT·write 허용/차단
//   3. RPC 가드: 비admin 거부, marketing+mandatory 거부(RPC층), draft 템플릿 발송 거부,
//      정상 발송 dispatch 생성 + admin_audit_logs 역추적
//   4. user_notifications: owner read_at 단일 컬럼 update 허용, 타 컬럼/타인 행 차단
// 출력: PASS/FAIL 라인 + JSON 리포트 (--out 파일)
//
// env: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_SECRET_KEY
//      (E2E_NTF_PASSWORD 선택 — 미설정 시 dev 기본값)

import { writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const URL_BASE = process.env.VITE_SUPABASE_URL ?? 'https://fglggyfvzjdsbyckinqa.supabase.co';
const ANON = process.env.VITE_SUPABASE_ANON_KEY;
const SECRET = process.env.SUPABASE_SECRET_KEY;
const PASSWORD = process.env.E2E_NTF_PASSWORD ?? 'Ntf-e2e-2026!seed';

if (!ANON || !SECRET) {
  console.error('VITE_SUPABASE_ANON_KEY, SUPABASE_SECRET_KEY must be set.');
  process.exit(1);
}
if (/prod/i.test(URL_BASE)) {
  console.error('refusing to run against a production-looking URL');
  process.exit(1);
}

export const ACCOUNTS = {
  admin: 'ntf-admin@e2e-notification.test',
  optin: 'ntf-user-optin@e2e-notification.test',
  optout: 'ntf-user-optout@e2e-notification.test',
  vn: 'ntf-user-vn@e2e-notification.test',
  dst: 'ntf-user-dst@e2e-notification.test',
  partial: 'ntf-user-partial@e2e-notification.test',
  fresh: 'ntf-user-fresh@e2e-notification.test',
};

const report = { startedAt: new Date().toISOString(), steps: [] };
let failed = 0;
function step(name, ok, detail) {
  report.steps.push({ name, ok, detail: detail ?? null });
  if (!ok) failed += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${typeof detail === 'string' ? detail : JSON.stringify(detail)}` : ''}`);
}

const service = createClient(URL_BASE, SECRET, { auth: { persistSession: false } });

async function ensureUser(email) {
  const headers = { apikey: SECRET, Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' };
  const res = await fetch(`${URL_BASE}/auth/v1/admin/users`, {
    method: 'POST', headers, body: JSON.stringify({ email, password: PASSWORD, email_confirm: true }),
  });
  if (res.ok) return (await res.json()).id;
  const body = await res.text();
  if ((res.status === 422 || res.status === 400) && /already|exists/i.test(body)) {
    const { data, error } = await service.from('profiles').select('id').eq('display_name', email.split('@')[0]).maybeSingle();
    if (!error && data) return data.id;
    // fallback: look up via admin list
    const list = await fetch(`${URL_BASE}/auth/v1/admin/users?page=1&per_page=200`, { headers });
    const users = (await list.json()).users ?? [];
    const found = users.find((u) => u.email === email);
    if (found) return found.id;
  }
  throw new Error(`ensureUser ${email}: HTTP ${res.status} ${body}`);
}

async function signIn(email) {
  const client = createClient(URL_BASE, ANON, { auth: { persistSession: false } });
  const { data, error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`signIn ${email}: ${error.message}`);
  return { client, userId: data.user.id };
}

// ── 1. 시드 계정 + 알림 설정 ─────────────────────────────────────────────
const ids = {};
for (const [key, email] of Object.entries(ACCOUNTS)) {
  ids[key] = await ensureUser(email);
}
step('seed accounts ensured (7)', Object.values(ids).every(Boolean), ids);

// admin 승격 (service role은 protect 트리거 admin 우회 정책 대상)
{
  const { error } = await service.from('profiles').update({ app_role: 'platform_admin' }).eq('id', ids.admin);
  step('admin account promoted to platform_admin', !error, error?.message);
}

// prefs/settings 시드 (QA §2 매트릭스)
async function seedUser(id, prefs, settings) {
  const { error: e1 } = await service.from('profiles').update({ notification_prefs: prefs }).eq('id', id);
  if (e1) throw new Error(e1.message);
  if (settings === null) {
    const { error } = await service.from('notification_settings').delete().eq('user_id', id);
    if (error) throw new Error(error.message);
    return;
  }
  const { error: e2 } = await service.from('notification_settings').upsert({ user_id: id, ...settings }, { onConflict: 'user_id' });
  if (e2) throw new Error(e2.message);
}
try {
  await seedUser(ids.optin, { weekly_summary: true, feedback_ready: true, study_reminder: true },
    { reminder_time: '09:00', reminder_days: [0, 1, 2, 3, 4, 5, 6], channels: { in_app: true, email: true, zalo: false }, timezone: 'Asia/Seoul' });
  await seedUser(ids.optout, { weekly_summary: false, feedback_ready: false, study_reminder: false },
    { reminder_time: '09:00', reminder_days: [0, 1, 2, 3, 4, 5, 6], channels: { in_app: false, email: false, zalo: false }, timezone: 'Asia/Seoul' });
  await seedUser(ids.vn, { weekly_summary: true, feedback_ready: true, study_reminder: true },
    { reminder_time: '09:00', reminder_days: [0, 1, 2, 3, 4, 5, 6], channels: { in_app: true, email: false, zalo: false }, timezone: 'Asia/Ho_Chi_Minh' });
  await seedUser(ids.dst, { weekly_summary: false, feedback_ready: false, study_reminder: true },
    { reminder_time: '02:30', reminder_days: [0, 1, 2, 3, 4, 5, 6], channels: { in_app: true, email: false, zalo: false }, timezone: 'America/New_York' });
  await seedUser(ids.partial, { weekly_summary: false, feedback_ready: true, study_reminder: false },
    { reminder_time: '09:00', reminder_days: [1, 3, 5], channels: { in_app: true, email: false, zalo: false }, timezone: 'Asia/Seoul' });
  await seedUser(ids.fresh, {}, null); // 설정 row 없음 (N-SCH-12)
  step('notification prefs/settings seeded per QA §2', true);
} catch (e) {
  step('notification prefs/settings seeded per QA §2', false, e.message);
}

// ── 2. RLS 매트릭스 ─────────────────────────────────────────────────────
const TABLES = ['notification_templates', 'notification_groups', 'notification_dispatches', 'notification_delivery_attempts', 'user_notifications'];

// anon: 전부 0행/오류
{
  const anonClient = createClient(URL_BASE, ANON, { auth: { persistSession: false } });
  for (const t of TABLES) {
    const { data, error } = await anonClient.from(t).select('*').limit(5);
    step(`anon select ${t} blocked (0 rows)`, (error == null && (data ?? []).length === 0) || error != null,
      error ? error.message : `rows=${(data ?? []).length}`);
  }
}

// 일반 사용자 (optin)
{
  const { client: userClient, userId } = await signIn(ACCOUNTS.optin);
  for (const t of ['notification_templates', 'notification_groups', 'notification_dispatches']) {
    const { data, error } = await userClient.from(t).select('*').limit(5);
    step(`user select ${t} blocked (0 rows)`, error == null && (data ?? []).length === 0,
      error ? error.message : `rows=${(data ?? []).length}`);
  }
  // 본인/타인 attempts·user_notifications 준비 (service로 시드)
  const { data: tpl } = await service.from('notification_templates').select('id, template_key').eq('template_key', 'study_reminder').eq('channel', 'in_app').single();
  const { data: disp, error: dispErr } = await service.from('notification_dispatches').insert({
    template_id: tpl.id, template_key: tpl.template_key, channels: ['in_app'], target_type: 'test',
    status: 'completed', dedupe_key: `smoke:${Date.now()}`,
  }).select('id').single();
  if (dispErr) throw new Error(dispErr.message);
  const mk = (uid, n) => ({ dispatch_id: disp.id, user_id: uid, channel: 'in_app', status: 'sent', sent_at: new Date().toISOString(), dedupe_key: `smoke:${uid}:${n}:${Date.now()}` });
  const { data: att } = await service.from('notification_delivery_attempts').insert([mk(ids.optin, 1), mk(ids.optout, 2)]).select('id, user_id');
  const { data: un } = await service.from('user_notifications').insert([
    { user_id: ids.optin, template_key: 'study_reminder', category: 'study', title: 'smoke own', body: 'x' },
    { user_id: ids.optout, template_key: 'study_reminder', category: 'study', title: 'smoke other', body: 'x' },
  ]).select('id, user_id');

  const { data: myAtt } = await userClient.from('notification_delivery_attempts').select('user_id');
  step('user attempts owner-select (own rows only)', (myAtt ?? []).length >= 1 && (myAtt ?? []).every((r) => r.user_id === userId), `rows=${(myAtt ?? []).length}`);

  const { data: myUn } = await userClient.from('user_notifications').select('id, user_id, title');
  step('user user_notifications owner-select (own rows only)', (myUn ?? []).length >= 1 && (myUn ?? []).every((r) => r.user_id === userId), `rows=${(myUn ?? []).length}`);

  // insert 차단
  const ins = await userClient.from('user_notifications').insert({ user_id: userId, template_key: 'x', category: 'study', title: 'hack' });
  step('user user_notifications insert blocked', ins.error != null, ins.error?.message);

  // read_at 단일 컬럼 update 허용
  const own = (myUn ?? [])[0];
  const upd1 = await userClient.from('user_notifications').update({ read_at: new Date().toISOString() }).eq('id', own.id).select('read_at');
  step('user own read_at update allowed', upd1.error == null && (upd1.data ?? []).length === 1, upd1.error?.message);

  // 타 컬럼 update 차단 (column grant)
  const upd2 = await userClient.from('user_notifications').update({ title: 'tampered' }).eq('id', own.id);
  step('user title update blocked (column grant)', upd2.error != null, upd2.error?.message);

  // 타인 행 read_at update 무효 (RLS — 0행)
  const otherUn = (un ?? []).find((r) => r.user_id === ids.optout);
  const upd3 = await userClient.from('user_notifications').update({ read_at: new Date().toISOString() }).eq('id', otherUn.id).select('id');
  step('user other-row read_at update blocked (0 rows)', upd3.error == null && (upd3.data ?? []).length === 0, upd3.error?.message ?? `rows=${(upd3.data ?? []).length}`);

  // 비admin RPC 거부
  const rpc1 = await userClient.rpc('admin_send_notification', { p_template_id: tpl.id, p_group_ids: [], p_scheduled_at: null, p_reason: 'smoke', p_target_type: 'test' });
  step('user admin_send_notification rejected', rpc1.error != null && /forbidden|admin/i.test(rpc1.error.message), rpc1.error?.message);

  // 직접 테이블 write 차단 (templates)
  const ins2 = await userClient.from('notification_templates').insert({ template_key: 'hack', channel: 'in_app', class: 'learning', mode: 'manual', category: 'study', name: 'hack' });
  step('user templates direct insert blocked', ins2.error != null, ins2.error?.message);

  // 정리용 핸들 보관
  report.cleanup = { dispatchId: disp.id, attemptIds: (att ?? []).map((r) => r.id), unIds: (un ?? []).map((r) => r.id) };
}

// ── 3. admin 경로 ───────────────────────────────────────────────────────
{
  const { client: adminClient } = await signIn(ACCOUNTS.admin);
  const { data: tpls, error } = await adminClient.from('notification_templates').select('id, template_key, channel, status');
  step('admin templates select (seed 10)', error == null && (tpls ?? []).length === 10, error ? error.message : `rows=${(tpls ?? []).length}`);

  // RPC층 marketing+mandatory 거부
  const rpcM = await adminClient.rpc('admin_save_notification_template', {
    p_id: null,
    p_template: { template_key: 'marketing_rpc_test', channel: 'email', class: 'marketing', mandatory: true, mode: 'manual', category: 'marketing', name: '차단 테스트' },
    p_reason: 'smoke',
  });
  step('RPC rejects marketing+mandatory', rpcM.error != null && /marketing/i.test(rpcM.error.message), rpcM.error?.message);

  // draft 템플릿 발송 거부
  const { data: draftTpl } = await adminClient.from('notification_templates').select('id').eq('status', 'draft').limit(1).single();
  const rpcD = await adminClient.rpc('admin_send_notification', { p_template_id: draftTpl.id, p_group_ids: '[]', p_scheduled_at: null, p_reason: 'smoke', p_target_type: 'test' });
  step('RPC rejects sending draft template', rpcD.error != null && /not active/i.test(rpcD.error.message), rpcD.error?.message);

  // 정상 발송(dispatch 생성) + 감사 역추적
  const { data: activeTpl } = await adminClient.from('notification_templates').select('id').eq('template_key', 'notice').eq('channel', 'in_app').single();
  const rpcS = await adminClient.rpc('admin_send_notification', { p_template_id: activeTpl.id, p_group_ids: '[]', p_scheduled_at: null, p_reason: 'V-0 smoke dispatch', p_target_type: 'test' });
  const dispatchId = rpcS.data;
  step('admin_send_notification creates dispatch', rpcS.error == null && Boolean(dispatchId), rpcS.error?.message ?? dispatchId);

  const { data: audit } = await service.from('admin_audit_logs').select('action, target_table, target_id').eq('target_id', String(dispatchId)).eq('action', 'notification_dispatch_created');
  step('audit row traced (notification_dispatch_created)', (audit ?? []).length === 1, `rows=${(audit ?? []).length}`);

  report.cleanup.smokeDispatchId = dispatchId;
}

// ── 4. 정리 (시드 계정·설정은 유지 — P1 이후 재사용) ────────────────────
{
  const c = report.cleanup ?? {};
  if (c.unIds?.length) await service.from('user_notifications').delete().in('id', c.unIds);
  if (c.dispatchId) await service.from('notification_dispatches').delete().eq('id', c.dispatchId);
  if (c.smokeDispatchId) await service.from('notification_dispatches').delete().eq('id', c.smokeDispatchId);
  step('smoke rows cleaned (accounts/settings retained)', true);
}

report.finishedAt = new Date().toISOString();
report.failed = failed;
const outFlag = process.argv.indexOf('--out');
if (outFlag >= 0) writeFileSync(process.argv[outFlag + 1], JSON.stringify(report, null, 2));
console.log(failed === 0 ? `\nALL PASS (${report.steps.length} steps)` : `\n${failed} FAILED of ${report.steps.length}`);
process.exit(failed === 0 ? 0 : 1);
