// P7 real send: deliver the 이용약관 변경 알림 (in-app + email) to bucheongosok@gmail.com.
// Faithful to the production path (trigger -> dispatcher -> worker), but the email
// transport is filtered to ONLY bucheongosok's attempt (isolated; no concurrent spam).
import { runSql } from './db.mjs';

const ADMIN = '2b329e99-587b-4042-9a51-6da6fe4a5c7f';
const BUCHEON = '112a6b57-9564-4990-8bf3-6b536d622008';
const RESEND_KEY = process.env.RESEND_API_KEY;
const FROM = process.env.RESEND_FROM || 'onboarding@resend.dev';
const SITE = (process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://app.talkpik.ai').replace(/\/+$/, '');

if (!RESEND_KEY) { console.error('RESEND_API_KEY missing in .env.local'); process.exit(1); }

const renderName = (s, n) => (s || '').split('{{display_name}}').join(n || '학습자');
const appendCta = (html, link) => {
  const p = (link || '').trim();
  if (!p) return html;
  const href = /^https?:\/\//i.test(p) ? p : `${SITE}/${p.replace(/^\/+/, '')}`;
  return `${html}\n<p><a href="${href}">약관 확인 및 동의하기</a></p>`;
};

console.log('1) make bucheongosok eligible for the operational email (pref + email channel)');
await runSql(`update public.profiles set notification_prefs = coalesce(notification_prefs,'{}'::jsonb) || '{"legal_terms_changed": true}'::jsonb where id='${BUCHEON}';`);
await runSql(`insert into public.notification_settings (user_id, channels) values ('${BUCHEON}', '{"in_app": true, "email": true}'::jsonb)
  on conflict (user_id) do update set channels = coalesce(public.notification_settings.channels,'{}'::jsonb) || '{"in_app": true, "email": true}'::jsonb, updated_at = now();`);

console.log('2) email transport -> live (capture old mode)');
const oldMode = (await runSql(`select mode from public.notification_email_config where id=true;`))[0]?.mode || 'disabled';
await runSql(`update public.notification_email_config set mode='live' where id=true;`);

try {
  console.log('3) trigger admin_send_terms_change_notification (as platform_admin)');
  const trig = await runSql(`begin; select set_config('request.jwt.claim.sub','${ADMIN}',true);
    select public.admin_send_terms_change_notification('이용약관 v2026.03 개정 안내 — 전체 회원 알림') as result; commit;`);
  console.log('   ', JSON.stringify(trig.find((r) => r.result)?.result));

  console.log('4) run dispatcher');
  console.log('   ', JSON.stringify((await runSql(`select private.dispatch_admin_notifications() as r;`))[0]?.r));

  console.log('5) send bucheongosok pending email via Resend (worker logic, filtered)');
  const att = (await runSql(`
    select a.id as attempt_id, t.subject, t.body_html, t.link_url, u.email, p.display_name
    from public.notification_delivery_attempts a
    join public.notification_dispatches d on d.id = a.dispatch_id
    join public.notification_templates t on t.id = d.template_id
    join auth.users u on u.id = a.user_id
    join public.profiles p on p.id = a.user_id
    where a.user_id='${BUCHEON}' and a.channel='email' and a.template_key='legal_terms_changed' and a.status='pending'
    order by a.created_at desc limit 1;`))[0];

  if (!att) {
    console.log('   NO pending email attempt for bucheongosok — check eligibility.');
  } else {
    const subject = renderName(att.subject, att.display_name);
    const html = appendCta(renderName(att.body_html, att.display_name), att.link_url);
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: att.email, subject, html }),
    });
    const text = await resp.text();
    console.log('   resend HTTP', resp.status, text.slice(0, 220));
    if (resp.ok) {
      let mid = null; try { mid = JSON.parse(text).id; } catch { /* */ }
      await runSql(`update public.notification_delivery_attempts set status='sent', provider_message_id=${mid ? `'${mid}'` : 'null'}, sent_at=now(), error_code=null, error_message=null where id='${att.attempt_id}';`);
      console.log(`   SENT to ${att.email} (message id ${mid})`);
    }
  }
} finally {
  console.log(`6) restore email_config.mode -> ${oldMode}`);
  await runSql(`update public.notification_email_config set mode='${oldMode}' where id=true;`);
}

console.log('\n7) verify bucheongosok:');
console.log(JSON.stringify(await runSql(`
  select
    (select status from public.notification_delivery_attempts where user_id='${BUCHEON}' and channel='email' and template_key='legal_terms_changed' order by created_at desc limit 1) as email_status,
    (select provider_message_id from public.notification_delivery_attempts where user_id='${BUCHEON}' and channel='email' and template_key='legal_terms_changed' order by created_at desc limit 1) as email_msg_id,
    (select count(*) from public.user_notifications where user_id='${BUCHEON}' and template_key='legal_terms_changed') as in_app_cards,
    (select link_url from public.user_notifications where user_id='${BUCHEON}' and template_key='legal_terms_changed' order by created_at desc limit 1) as card_link;
`), null, 2));
