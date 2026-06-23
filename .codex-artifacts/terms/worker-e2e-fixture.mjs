// Insert ONE pending email attempt for bucheongosok directly (bypassing the
// dispatcher's eligibility logic, which a concurrent session is currently
// churning). The real worker route reads pending attempts + sends — this tests
// that committed worker code over HTTP, isolated from the contended pipeline.
import { runSql } from './db.mjs';

const ADMIN = '2b329e99-587b-4042-9a51-6da6fe4a5c7f';
const BUCHEON = '112a6b57-9564-4990-8bf3-6b536d622008';

const tplId = (await runSql(
  `select id from public.notification_templates where template_key='legal_terms_changed' and channel='email' limit 1;`,
))[0]?.id;
if (!tplId) { console.error('email template missing'); process.exit(1); }

const dispatchId = (await runSql(`
  insert into public.notification_dispatches
    (template_id, template_key, channels, target_type, status, actor_id, reason, dedupe_key, started_at, completed_at)
  values
    ('${tplId}', 'legal_terms_changed', '["email"]'::jsonb, 'group', 'completed', '${ADMIN}', 'worker route e2e',
     'worker-e2e-' || gen_random_uuid()::text, now(), now())
  returning id;`))[0].id;

const attemptId = (await runSql(`
  insert into public.notification_delivery_attempts
    (dispatch_id, user_id, channel, template_key, status)
  values ('${dispatchId}', '${BUCHEON}', 'email', 'legal_terms_changed', 'pending')
  returning id;`))[0].id;

console.log('dispatch:', dispatchId);
console.log('attempt :', attemptId);
console.log('pending email attempts:', JSON.stringify(await runSql(
  `select a.id, u.email, a.status from public.notification_delivery_attempts a join auth.users u on u.id=a.user_id where a.channel='email' and a.status='pending';`,
)));
