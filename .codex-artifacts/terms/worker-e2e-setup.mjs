// Stage exactly one pending email attempt for bucheongosok so the REAL worker
// route can send it. Sets email_config 'live' only while the dispatcher runs
// (the pending attempt persists after restore; the worker ignores email_config).
import { runSql } from './db.mjs';

const ADMIN = '2b329e99-587b-4042-9a51-6da6fe4a5c7f';
const BUCHEON = '112a6b57-9564-4990-8bf3-6b536d622008';

await runSql(`update public.profiles set notification_prefs = coalesce(notification_prefs,'{}'::jsonb) || '{"legal_terms_changed": true}'::jsonb where id='${BUCHEON}';`);
await runSql(`insert into public.notification_settings (user_id, channels) values ('${BUCHEON}', '{"in_app": true, "email": true}'::jsonb) on conflict (user_id) do update set channels = coalesce(public.notification_settings.channels,'{}'::jsonb) || '{"in_app": true, "email": true}'::jsonb, updated_at = now();`);

const oldMode = (await runSql(`select mode from public.notification_email_config where id=true;`))[0]?.mode || 'disabled';
await runSql(`update public.notification_email_config set mode='live' where id=true;`);
await runSql(`begin; select set_config('request.jwt.claim.sub','${ADMIN}',true); select public.admin_send_terms_change_notification('이용약관 개정 — 워커 e2e') as r; commit;`);
console.log('dispatch:', JSON.stringify((await runSql(`select private.dispatch_admin_notifications() as r;`))[0]?.r));
await runSql(`update public.notification_email_config set mode='${oldMode}' where id=true;`);

const pend = await runSql(`
  select a.id as attempt_id, u.email, a.status
  from public.notification_delivery_attempts a join auth.users u on u.id=a.user_id
  where a.channel='email' and a.status='pending';`);
console.log('pending email attempts now:', JSON.stringify(pend));
