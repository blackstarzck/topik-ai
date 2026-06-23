import { readFileSync } from 'node:fs';
const T = process.env.SUPABASE_ACCESS_TOKEN, R = 'fglggyfvzjdsbyckinqa';
async function q(sql) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${R}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${T}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(t);
  return JSON.parse(t);
}
const rows = await q("select id, event_type, visibility_status, progress_status from public.operation_events order by id");
console.log('seed rows:', rows.length);
rows.forEach((x) => console.log('  ', x.id, x.event_type, x.visibility_status + '/' + x.progress_status));
const rls = await q("select relforcerowsecurity f from pg_class where relname='operation_events' and relnamespace='public'::regnamespace");
console.log('RLS forced:', rls[0].f);
const cols = (await q("select column_name from information_schema.columns where table_schema='public' and table_name='operation_events' order by 1")).map((c) => c.column_name).sort();
const svc = readFileSync('src/features/operation/api/supabase-operation-events-service.ts', 'utf8');
const m = svc.match(/const EVENT_COLUMNS = \[([\s\S]*?)\]\.join/);
const want = [...m[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]).sort();
const missing = want.filter((c) => !cols.includes(c));
const extra = cols.filter((c) => !want.includes(c));
console.log('service selects', want.length, 'cols; table has', cols.length);
console.log('missing in table:', missing.join(',') || 'none');
console.log('extra (not selected, e.g. created_at):', extra.join(',') || 'none');
const fns = (await q("select proname, pg_get_function_identity_arguments(p.oid) args from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and proname like 'admin_%operation_event%' order by 1")).map((f) => f.proname + '(' + f.args + ')');
console.log('RPCs:', fns.length);
fns.forEach((f) => console.log('  ', f));
