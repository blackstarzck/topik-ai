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
const svc = readFileSync('src/features/system/api/supabase-system-metadata-service.ts', 'utf8');
for (const [tbl, cst] of [['system_metadata_groups', 'GROUP_COLUMNS'], ['system_metadata_group_items', 'ITEM_COLUMNS']]) {
  const cnt = (await q(`select count(*)::int n from public.${tbl}`))[0].n;
  const rls = (await q(`select relforcerowsecurity f from pg_class where relname='${tbl}' and relnamespace='public'::regnamespace`))[0].f;
  const cols = (await q(`select column_name from information_schema.columns where table_schema='public' and table_name='${tbl}' order by 1`)).map((c) => c.column_name).sort();
  const want = listFromConst(svc, cst);
  const missing = want.filter((c) => !cols.includes(c));
  console.log(`${tbl}: rows=${cnt} forced=${rls} cols=${cols.length} | service selects ${want.length}, missing=${missing.join(',') || 'none'}`);
}
const mfns = (await q("select proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and proname like '%metadata%' order by 1")).map((f) => f.proname);
console.log('metadata functions:', mfns.length, '|', mfns.join(', '));
const ufns = (await q("select proname, pg_get_function_identity_arguments(p.oid) a from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and proname in ('get_admin_users','admin_set_user_status') order by 1"));
console.log('users hotfix RPCs:', ufns.map((f) => f.proname + '(' + f.a + ')').join(' | ') || 'MISSING');
