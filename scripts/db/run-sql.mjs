#!/usr/bin/env node
// Run SQL against the v13 Supabase project via the Supabase Management API.
// Server-side tooling only (P1+ migration/smoke path) — never bundled into the client.
//
// Usage:
//   node scripts/db/run-sql.mjs --sql "select 1"
//   node scripts/db/run-sql.mjs --file supabase/migrations/0001_topic_master.sql
//
// Auth: SUPABASE_ACCESS_TOKEN env var (sbp_...). PROJECT_REF defaults to the
// v13 project; override with SUPABASE_PROJECT_REF.

import { readFileSync } from 'node:fs';

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF ?? 'fglggyfvzjdsbyckinqa';
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

if (!TOKEN) {
  console.error('SUPABASE_ACCESS_TOKEN is not set.');
  process.exit(1);
}

const args = process.argv.slice(2);
let sql = null;
for (let i = 0; i < args.length; i += 1) {
  if (args[i] === '--sql') sql = args[i + 1];
  if (args[i] === '--file') sql = readFileSync(args[i + 1], 'utf8');
}
if (!sql) {
  console.error('Provide --sql "<query>" or --file <path>.');
  process.exit(1);
}

const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${TOKEN}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ query: sql }),
});

const text = await res.text();
if (!res.ok) {
  console.error(`HTTP ${res.status}`);
  console.error(text);
  process.exit(1);
}
try {
  console.log(JSON.stringify(JSON.parse(text), null, 2));
} catch {
  console.log(text);
}
