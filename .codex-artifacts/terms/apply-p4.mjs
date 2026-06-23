// P4: apply admin_get_user_legal_consents + verify (is_current false/true, guard).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { runSql } from './db.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ADMIN = '2b329e99-587b-4042-9a51-6da6fe4a5c7f';
const asAdmin = (sql) => `begin; select set_config('request.jwt.claim.sub','${ADMIN}',true); ${sql} commit;`;

console.log('apply migration ...');
await runSql(readFileSync(join(ROOT, 'supabase/migrations-admin/20260622160000_user_legal_consents_read.sql'), 'utf8'));
await runSql("insert into public.admin_schema_migrations (name) values ('20260622160000_user_legal_consents_read.sql') on conflict do nothing");
console.log('  ok + tracked');

// pick a user who already has a terms consent (on the old placeholder version)
const picked = await runSql(`
  select user_id from public.user_consents where doc_type='terms' order by accepted_at desc limit 1;
`);
const userId = picked[0]?.user_id;
console.log('\ntest user (has placeholder terms consent):', userId);

console.log('\n1) consent versions for that user (expect terms is_current=false vs v2026.03):');
console.log(JSON.stringify(await runSql(asAdmin(`select * from public.admin_get_user_legal_consents('${userId}');`)), null, 2));

// the currently-published terms/ko document id (projected from POL-001)
const docRow = await runSql(`select id from public.legal_documents where doc_type='terms' and locale='ko' and version='v2026.03' and status='published' limit 1;`);
const docId = docRow[0]?.id;

console.log('\n2) record a v2026.03 re-consent for that user, then re-check (expect is_current=true):');
await runSql(`insert into public.user_consents (user_id, document_id, doc_type, version, source) values ('${userId}', '${docId}', 'terms', 'v2026.03', 're_consent');`);
console.log(JSON.stringify(await runSql(asAdmin(`select * from public.admin_get_user_legal_consents('${userId}');`)), null, 2));

console.log('\n3) cleanup test consent ...');
await runSql(`delete from public.user_consents where user_id='${userId}' and version='v2026.03' and source='re_consent';`);
console.log('  removed');

console.log('\n4) guard: call without admin claim (expect forbidden/unauthenticated):');
try {
  await runSql(`select * from public.admin_get_user_legal_consents('${userId}');`);
  console.log('  [FAIL] no error');
} catch (e) {
  console.log('  [PASS]', String(e).includes('unauthenticated') || String(e).includes('forbidden') ? 'rejected' : String(e).slice(0, 140));
}
