#!/usr/bin/env node
// Apply supabase/migrations/*.sql to the shared v13 Supabase project in filename
// order, tracked in topik_writing_schema_migrations (our namespace). Management
// API is the execution path (no CLI auth / DB password on this machine — see
// docs/architecture/admin-data-source-transition.md §10.4 절차).
//
// Usage:
//   node scripts/db/migrate.mjs            # apply pending
//   node scripts/db/migrate.mjs --status   # list applied/pending
//   node scripts/db/migrate.mjs --down <name>  # run down/<name>.sql and untrack
//
// Auth: SUPABASE_ACCESS_TOKEN env var (sbp_...).

import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF ?? 'fglggyfvzjdsbyckinqa';
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'supabase', 'migrations');
const TRACK_TABLE = 'topik_writing_schema_migrations';

if (!TOKEN) {
  console.error('SUPABASE_ACCESS_TOKEN is not set.');
  process.exit(1);
}

async function runSql(sql) {
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

async function ensureTrackTable() {
  await runSql(`create table if not exists public.${TRACK_TABLE} (
    name text primary key,
    applied_at timestamptz not null default now()
  );
  do $$ begin
    if not exists (select 1 from pg_policies where tablename = '${TRACK_TABLE}') then
      alter table public.${TRACK_TABLE} enable row level security;
    end if;
  end $$;`);
}

async function appliedNames() {
  const rows = await runSql(`select name from public.${TRACK_TABLE} order by name`);
  return new Set(rows.map((r) => r.name));
}

function localMigrations() {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
}

const args = process.argv.slice(2);

await ensureTrackTable();
const applied = await appliedNames();
const local = localMigrations();

if (args[0] === '--status') {
  for (const f of local) {
    console.log(`${applied.has(f) ? '[applied]' : '[pending]'} ${f}`);
  }
  process.exit(0);
}

if (args[0] === '--down') {
  const name = args[1];
  if (!name) { console.error('--down requires a migration file name'); process.exit(1); }
  const sql = readFileSync(join(MIGRATIONS_DIR, 'down', name), 'utf8');
  await runSql(sql);
  await runSql(`delete from public.${TRACK_TABLE} where name = ${escapeLiteral(name)}`);
  console.log(`rolled back ${name}`);
  process.exit(0);
}

function escapeLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

let appliedCount = 0;
for (const f of local) {
  if (applied.has(f)) continue;
  const sql = readFileSync(join(MIGRATIONS_DIR, f), 'utf8');
  process.stdout.write(`applying ${f} ... `);
  await runSql(sql);
  await runSql(`insert into public.${TRACK_TABLE} (name) values (${escapeLiteral(f)}) on conflict do nothing`);
  console.log('ok');
  appliedCount += 1;
}
console.log(appliedCount === 0 ? 'nothing to apply (up to date)' : `applied ${appliedCount} migration(s)`);
