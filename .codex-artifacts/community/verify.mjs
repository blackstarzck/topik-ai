import { readFileSync } from 'node:fs';
const T = process.env.SUPABASE_ACCESS_TOKEN, R = 'fglggyfvzjdsbyckinqa';
async function q(sql) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${R}/database/query`, {
    method: 'POST', headers: { Authorization: `Bearer ${T}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(t);
  return JSON.parse(t);
}
function listFromConst(svc, name) {
  const m = svc.match(new RegExp('const ' + name + ' = \\[([\\s\\S]*?)\\]'));
  return m ? [...m[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]).sort() : [];
}
const svc = readFileSync('src/features/community/api/supabase-community-service.ts', 'utf8');
const map = { community_posts: 'POST_COLUMNS', community_reports: 'REPORT_COLUMNS', community_post_admin_notes: null };
for (const [tbl, cst] of Object.entries(map)) {
  const cnt = (await q(`select count(*)::int n from public.${tbl}`))[0].n;
  const rls = (await q(`select relforcerowsecurity f from pg_class where relname='${tbl}' and relnamespace='public'::regnamespace`))[0].f;
  const cols = (await q(`select column_name from information_schema.columns where table_schema='public' and table_name='${tbl}' order by 1`)).map((c) => c.column_name).sort();
  let extra = '';
  if (cst) {
    const want = listFromConst(svc, cst);
    const missing = want.filter((c) => !cols.includes(c));
    extra = ` | service selects ${want.length}, missing=${missing.join(',') || 'none'}`;
  }
  console.log(`${tbl}: rows=${cnt} forced=${rls} cols=${cols.length}${extra}`);
}
const fns = (await q("select proname, pg_get_function_identity_arguments(p.oid) a from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and proname like '%community%' order by 1")).map((f) => f.proname + '(' + f.a + ')');
console.log('functions:', fns.length);
fns.forEach((f) => console.log('  ', f));
// functional check: RP-003 seed is hide_post resolved → its target post should be hidden
const r3 = await q("select r.resolution_action, p.status post_status from public.community_reports r join public.community_posts p on p.id=r.target_post_id where r.id='RP-003'");
console.log('RP-003 (hide_post seed):', JSON.stringify(r3[0] || 'n/a'));
