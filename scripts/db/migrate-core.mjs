// Shared migration runner for the Management API path (no CLI auth / DB
// password on this machine — see docs/architecture/admin-data-source-transition.md).
// Each namespace gets its own tracker table and migrations directory:
//   - topik_writing_schema_migrations ← supabase/migrations      (migrate.mjs)
//   - admin_schema_migrations         ← supabase/migrations-admin (admin-migrate.mjs)

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF ?? 'fglggyfvzjdsbyckinqa';
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

export async function runSql(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  try { return JSON.parse(text); } catch { return text; }
}

function escapeLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

export async function runMigrate({ trackTable, migrationsDir, args }) {
  if (!TOKEN) {
    console.error('SUPABASE_ACCESS_TOKEN is not set.');
    process.exit(1);
  }

  await runSql(`create table if not exists public.${trackTable} (
    name text primary key,
    applied_at timestamptz not null default now()
  );
  do $$ begin
    if not exists (select 1 from pg_policies where tablename = '${trackTable}') then
      alter table public.${trackTable} enable row level security;
    end if;
  end $$;`);

  const rows = await runSql(`select name from public.${trackTable} order by name`);
  const applied = new Set(rows.map((r) => r.name));
  const local = existsSync(migrationsDir)
    ? readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()
    : [];

  if (args[0] === '--status') {
    if (local.length === 0) console.log(`(no migrations in ${migrationsDir})`);
    for (const f of local) {
      console.log(`${applied.has(f) ? '[applied]' : '[pending]'} ${f}`);
    }
    return;
  }

  if (args[0] === '--down') {
    const name = args[1];
    if (!name) { console.error('--down requires a migration file name'); process.exit(1); }
    const sql = readFileSync(join(migrationsDir, 'down', name), 'utf8');
    await runSql(sql);
    await runSql(`delete from public.${trackTable} where name = ${escapeLiteral(name)}`);
    console.log(`rolled back ${name}`);
    return;
  }

  let appliedCount = 0;
  for (const f of local) {
    if (applied.has(f)) continue;
    const sql = readFileSync(join(migrationsDir, f), 'utf8');
    process.stdout.write(`applying ${f} ... `);
    await runSql(sql);
    await runSql(`insert into public.${trackTable} (name) values (${escapeLiteral(f)}) on conflict do nothing`);
    console.log('ok');
    appliedCount += 1;
  }
  console.log(appliedCount === 0 ? 'nothing to apply (up to date)' : `applied ${appliedCount} migration(s)`);
}
