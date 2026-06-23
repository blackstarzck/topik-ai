// Full production pipeline via Daou SMTP: trigger -> dispatcher(live) -> worker
// SMTP send -> mark sent. Replicates the worker's exact path (resolve recipient,
// render template, nodemailer sendMail) filtered to bucheongosok's attempt.
import nodemailer from 'nodemailer';
import { runSql } from './db.mjs';

const ADMIN = '2b329e99-587b-4042-9a51-6da6fe4a5c7f';
const BUCHEON = '112a6b57-9564-4990-8bf3-6b536d622008';
const SITE = (process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || 'https://app.talkpik.ai').replace(/\/+$/, '');
const sqlStr = (s) => String(s).split("'").join("''");
const renderName = (s, n) => (s || '').split('{{display_name}}').join(n || '회원');
const appendCta = (html, link) => {
  const p = (link || '').trim();
  if (!p) return html;
  const href = /^https?:\/\//i.test(p) ? p : `${SITE}/${p.replace(/^\/+/, '')}`;
  return `${html}\n<p><a href="${href}">약관 확인 및 동의하기</a></p>`;
};

console.log('1) ensure bucheongosok eligible (pref + email channel)');
await runSql(`update public.profiles set notification_prefs = coalesce(notification_prefs,'{}'::jsonb) || '{"legal_terms_changed": true}'::jsonb where id='${BUCHEON}';`);
await runSql(`insert into public.notification_settings (user_id, channels) values ('${BUCHEON}', '{"in_app": true, "email": true}'::jsonb) on conflict (user_id) do update set channels = coalesce(public.notification_settings.channels,'{}'::jsonb) || '{"in_app": true, "email": true}'::jsonb, updated_at = now();`);

const oldMode = (await runSql(`select mode from public.notification_email_config where id=true;`))[0]?.mode || 'disabled';
await runSql(`update public.notification_email_config set mode='live' where id=true;`);

try {
  console.log('2) trigger + dispatch');
  await runSql(`begin; select set_config('request.jwt.claim.sub','${ADMIN}',true); select public.admin_send_terms_change_notification('이용약관 v2026.03 개정 안내 (SMTP)') as r; commit;`);
  console.log('   dispatch:', JSON.stringify((await runSql(`select private.dispatch_admin_notifications() as r;`))[0]?.r));

  console.log('3) worker SMTP send for bucheongosok pending attempt');
  const att = (await runSql(`
    select a.id as attempt_id, t.subject, t.body_html, t.link_url, u.email, p.display_name
    from public.notification_delivery_attempts a
    join public.notification_dispatches d on d.id = a.dispatch_id
    join public.notification_templates t on t.id = d.template_id
    join auth.users u on u.id = a.user_id
    join public.profiles p on p.id = a.user_id
    where a.user_id='${BUCHEON}' and a.channel='email' and a.template_key='legal_terms_changed' and a.status='pending'
    order by a.created_at desc limit 1;`))[0];
  if (!att) { console.log('   no pending attempt'); }
  else {
    const port = Number(process.env.SMTP_PORT || 465);
    const transporter = nodemailer.createTransport({ host: process.env.SMTP_HOST, port, secure: port === 465, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });
    const subject = renderName(att.subject, att.display_name);
    const html = appendCta(renderName(att.body_html, att.display_name), att.link_url);
    const info = await transporter.sendMail({ from: process.env.SMTP_FROM, to: att.email, subject, html });
    await runSql(`update public.notification_delivery_attempts set status='sent', provider_message_id='${sqlStr(info.messageId)}', sent_at=now(), error_code=null, error_message=null where id='${att.attempt_id}';`);
    console.log(`   SENT via SMTP to ${att.email} | ${info.messageId} | ${info.response}`);
  }
} finally {
  await runSql(`update public.notification_email_config set mode='${oldMode}' where id=true;`);
  console.log('4) restored email_config.mode ->', oldMode);
}

console.log('\n5) verify bucheongosok:');
console.log(JSON.stringify(await runSql(`
  select
    (select status from public.notification_delivery_attempts where user_id='${BUCHEON}' and channel='email' and template_key='legal_terms_changed' order by created_at desc limit 1) as email_status,
    (select provider_message_id from public.notification_delivery_attempts where user_id='${BUCHEON}' and channel='email' and template_key='legal_terms_changed' order by created_at desc limit 1) as email_msg_id,
    (select count(*) from public.user_notifications where user_id='${BUCHEON}' and template_key='legal_terms_changed') as in_app_cards;
`), null, 2));
