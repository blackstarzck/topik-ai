// Apply P1 migrations to the shared dev DB via the Management API, then verify.
//  1) topik-ai: 20260622140000_operation_policies_en_content.sql  (+ track in admin_schema_migrations)
//  2) v13:      20260622150000_legal_documents_projection.sql      (idempotent; CLI tracker untouched)
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { runSql } from './db.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..'); // topik-ai
const V13 = join(ROOT, '..', 'topik-project', 'v13');

const opFile = join(ROOT, 'supabase/migrations-admin/20260622140000_operation_policies_en_content.sql');
const v13File = join(V13, 'supabase/migrations/20260622150000_legal_documents_projection.sql');

console.log('applying topik-ai migration ...');
await runSql(readFileSync(opFile, 'utf8'));
await runSql(
  "insert into public.admin_schema_migrations (name) values ('20260622140000_operation_policies_en_content.sql') on conflict do nothing",
);
console.log('  ok + tracked');

console.log('applying v13 migration ...');
await runSql(readFileSync(v13File, 'utf8'));
console.log('  ok');

console.log('\n--- verify ---');
const v = await runSql(`
select
  (select exists(select 1 from information_schema.columns where table_schema='public' and table_name='operation_policies' and column_name='body_html_en')) as op_has_en,
  (select length(body_html) from public.operation_policies where id='POL-001') as pol001_ko_len,
  (select length(body_html_en) from public.operation_policies where id='POL-001') as pol001_en_len,
  (select position('제22조' in body_html) > 0 from public.operation_policies where id='POL-001') as pol001_ko_art22,
  (select position('Article 22' in body_html_en) > 0 from public.operation_policies where id='POL-001') as pol001_en_art22,
  (select title_en from public.operation_policies where id='POL-001') as pol001_title_en,
  (select exists(select 1 from information_schema.columns where table_schema='public' and table_name='legal_documents' and column_name='source_policy_id')) as ld_has_source,
  (select exists(select 1 from pg_proc where proname='admin_sync_legal_document_from_operation_policy')) as has_sync_rpc;
`);
console.log(JSON.stringify(v, null, 2));
