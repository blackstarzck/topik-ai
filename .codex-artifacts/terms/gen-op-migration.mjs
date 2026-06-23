// Generates supabase/migrations-admin/20260622140000_operation_policies_en_content.sql
// - ALTER operation_policies ADD title_en/body_html_en/summary_en
// - UPDATE POL-001 with the canonical Korean body (sourced byte-exact from the
//   mock file) + the English translation (terms-en.html). Dollar-quoted to avoid
//   any escaping. Idempotent; converges fresh + existing dev rows.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const mock = readFileSync(
  join(ROOT, 'src/features/operation/api/mock-operation-policies.ts'),
  'utf8',
);
const START = "'<h2>TOPIK AI 이용약관</h2>";
const s = mock.indexOf(START);
if (s < 0) throw new Error('POL-001 Korean body marker not found in mock');
const bodyStart = s + 1; // skip opening single quote
const bodyEnd = mock.indexOf("',", bodyStart);
if (bodyEnd < 0) throw new Error('POL-001 Korean body terminator not found');
const ko = mock.slice(bodyStart, bodyEnd);

const en = readFileSync(join(ROOT, '.codex-artifacts/terms/terms-en.html'), 'utf8').trim();

for (const [name, val] of [['ko', ko], ['en', en]]) {
  if (val.includes(`$${name}$`)) throw new Error(`dollar tag collision in ${name}`);
}

const summaryEn =
  'Baseline terms summarizing the conditions of use of the Service, account operation standards, and payment and content usage restrictions.';

const sql = `-- =====================================================================
-- topik-ai admin - Operation policies - English content + baseline sync
-- Adds optional per-policy English fields (title_en/body_html_en/summary_en)
-- to operation_policies so the admin manages ko+en in ONE place (single SoT),
-- and brings POL-001 (이용약관) to its canonical ko body + en translation.
-- Idempotent: re-running converges both fresh installs and the existing dev row.
-- Owner: topik-ai (operation_policies is a topik-ai-owned admin table).
-- down: supabase/migrations-admin/down/20260622140000_operation_policies_en_content.sql
-- =====================================================================

alter table public.operation_policies
  add column if not exists title_en     text,
  add column if not exists body_html_en text,
  add column if not exists summary_en   text;

comment on column public.operation_policies.body_html_en is
  'Optional English body (admin-managed). Projected to v13 legal_documents (locale en).';

update public.operation_policies
set body_html    = $ko$${ko}$ko$,
    title_en     = 'TOPIK AI Terms of Service',
    summary_en   = $sen$${summaryEn}$sen$,
    body_html_en = $en$${en}$en$,
    updated_at   = now()
where id = 'POL-001';
`;

const out = join(ROOT, 'supabase/migrations-admin/20260622140000_operation_policies_en_content.sql');
writeFileSync(out, sql, 'utf8');
console.log('wrote', out);
console.log('ko len', ko.length, 'en len', en.length);
