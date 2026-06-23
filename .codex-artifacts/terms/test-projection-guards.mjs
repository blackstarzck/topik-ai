// P1 guard tests for admin_sync_legal_document_from_operation_policy:
//  (a) unauthenticated  -> rejected
//  (b) immutability     -> same version + different body rejected
//  (c) idempotency      -> same content re-sync succeeds, no row explosion
import { runSql } from './db.mjs';

const ADMIN = '2b329e99-587b-4042-9a51-6da6fe4a5c7f';
const callFromPolicy = (bodyExpr) => `
select public.admin_sync_legal_document_from_operation_policy(
  p.id, p.current_version_id, p.policy_type, p.version_label, p.effective_date, p.requires_consent,
  p.title, ${bodyExpr}, p.summary, p.title_en, p.body_html_en, p.summary_en
)
from public.operation_policies p where p.id='POL-001';`;

async function expectError(label, sql, needle) {
  try {
    await runSql(sql);
    console.log(`  [FAIL] ${label}: expected error but succeeded`);
    return false;
  } catch (e) {
    const ok = String(e).includes(needle);
    console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${label}: ${ok ? 'rejected as expected' : String(e).slice(0, 160)}`);
    return ok;
  }
}

// (a) no JWT claim -> unauthenticated
await expectError(
  'unauthenticated',
  `${callFromPolicy('p.body_html')}`,
  'unauthenticated',
);

// (b) immutability: admin, same version, tampered ko body
await expectError(
  'immutability (same version, different body)',
  `begin; select set_config('request.jwt.claim.sub','${ADMIN}',true);
   ${callFromPolicy("p.body_html || '<!--tampered-->'")}
   commit;`,
  'immutable version conflict',
);

// (c) idempotency: admin, identical content -> success
const idem = await runSql(
  `begin; select set_config('request.jwt.claim.sub','${ADMIN}',true);
   ${callFromPolicy('p.body_html')}
   commit;`,
);
console.log('  [idempotency] re-sync ok:', JSON.stringify(idem));

const counts = await runSql(`
select status, count(*) from public.legal_documents where doc_type='terms' group by status order by status;
`);
console.log('  terms row counts by status:', JSON.stringify(counts));
