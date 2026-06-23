// P1 verification: drive admin_sync_legal_document_from_operation_policy through
// the REAL platform_admin gate by simulating the admin JWT claim (request.jwt.claim.sub),
// reading POL-001 content straight from operation_policies (as the admin app would).
import { runSql } from './db.mjs';

const ADMIN = '2b329e99-587b-4042-9a51-6da6fe4a5c7f'; // e2e-admin@topik-ai.test (platform_admin)

console.log('1) project POL-001 (이용약관) via platform_admin gate ...');
const r1 = await runSql(`
begin;
select set_config('request.jwt.claim.sub', '${ADMIN}', true);
select public.admin_sync_legal_document_from_operation_policy(
  p.id, p.current_version_id, p.policy_type, p.version_label, p.effective_date, p.requires_consent,
  p.title, p.body_html, p.summary, p.title_en, p.body_html_en, p.summary_en
) as sync_result
from public.operation_policies p where p.id='POL-001';
commit;
`);
console.log('   batch result:', JSON.stringify(r1));

console.log('\n2) legal_documents terms state:');
const r2 = await runSql(`
select doc_type, locale, version, status, is_placeholder, length(body) as body_len, source_policy_id
from public.legal_documents where doc_type='terms' order by status, locale;
`);
console.log(JSON.stringify(r2, null, 2));
