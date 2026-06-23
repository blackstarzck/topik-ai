// Reusable dev-DB query helper for the terms-versioning work.
// Loads SUPABASE_ACCESS_TOKEN from .env.local and runs SQL via the Supabase
// Management API (same path as scripts/db/migrate-core.mjs). NEVER prints the token.
//
// Usage:
//   node .codex-artifacts/terms/db.mjs "select 1"          # ad-hoc query
//   import { runSql } from './db.mjs'                        # programmatic
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function loadEnvLocal() {
  let raw = '';
  try {
    raw = readFileSync(join(ROOT, '.env.local'), 'utf8');
  } catch {
    return;
  }
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
}

loadEnvLocal();

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF ?? 'fglggyfvzjdsbyckinqa';
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

export async function runSql(sql) {
  if (!TOKEN) throw new Error('SUPABASE_ACCESS_TOKEN not set (.env.local)');
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: sql }),
    },
  );
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text}`);
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

const argSql = process.argv[2];
if (argSql) {
  runSql(argSql)
    .then((r) => console.log(JSON.stringify(r, null, 2)))
    .catch((e) => {
      console.error(String(e));
      process.exit(1);
    });
}
