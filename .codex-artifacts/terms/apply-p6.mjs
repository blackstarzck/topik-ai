// P6: apply legal_terms_changed templates + trigger RPC, then dry-run the full
// trigger -> dispatch -> dispatcher pipeline and verify, then clean up test rows.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { runSql } from './db.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ADMIN = '2b329e99-587b-4042-9a51-6da6fe4a5c7f';

console.log('apply migration ...');
await runSql(readFileSync(join(ROOT, 'supabase/migrations-admin/20260622170000_legal_terms_change_notification.sql'), 'utf8'));
await runSql("insert into public.admin_schema_migrations (name) values ('20260622170000_legal_terms_change_notification.sql') on conflict do nothing");
console.log('  ok + tracked');

console.log('\n1) trigger admin_send_terms_change_notification (as platform_admin):');
const trig = await runSql(`
begin; select set_config('request.jwt.claim.sub','${ADMIN}',true);
select public.admin_send_terms_change_notification('e2e dry-run: 약관 v2026.03 개정 발송') as result;
commit;`);
const result = trig.find((r) => r.result)?.result;
console.log('  ', JSON.stringify(result));
const inAppDispatch = result.in_app_dispatch;
const emailDispatch = result.email_dispatch;

console.log('\n2) run dispatcher (private.dispatch_admin_notifications):');
console.log('  ', JSON.stringify(await runSql('select private.dispatch_admin_notifications() as r;')));

console.log('\n3) verify attempts + in-app cards:');
console.log(JSON.stringify(await runSql(`
select
  (select jsonb_object_agg(status, c) from (select status, count(*) c from public.notification_delivery_attempts where dispatch_id='${inAppDispatch}' group by status) t) as in_app_attempts,
  (select jsonb_object_agg(status, c) from (select status, count(*) c from public.notification_delivery_attempts where dispatch_id='${emailDispatch}' group by status) t) as email_attempts,
  (select count(*) from public.user_notifications un join public.notification_delivery_attempts a on a.id=un.delivery_attempt_id where a.dispatch_id='${inAppDispatch}') as in_app_cards,
  (select link_url from public.user_notifications un join public.notification_delivery_attempts a on a.id=un.delivery_attempt_id where a.dispatch_id='${inAppDispatch}' limit 1) as card_link;
`, ), null, 2));

console.log('\n4) cleanup dry-run rows (keep templates + group):');
await runSql(`delete from public.user_notifications where delivery_attempt_id in (select id from public.notification_delivery_attempts where dispatch_id in ('${inAppDispatch}','${emailDispatch}'));`);
await runSql(`delete from public.notification_delivery_attempts where dispatch_id in ('${inAppDispatch}','${emailDispatch}');`);
await runSql(`delete from public.notification_dispatches where id in ('${inAppDispatch}','${emailDispatch}');`);
console.log('  removed dry-run dispatches/attempts/cards');

console.log('\n5) guard: trigger without admin claim (expect rejected):');
try {
  await runSql(`select public.admin_send_terms_change_notification('x');`);
  console.log('  [FAIL] no error');
} catch (e) {
  console.log('  [PASS]', String(e).includes('unauthenticated') || String(e).includes('forbidden') ? 'rejected' : String(e).slice(0, 140));
}
