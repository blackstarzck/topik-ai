#!/usr/bin/env node
// Phase 7 (admin identity separation): physically remove admins' profiles rows.
//
// After the separation, admin identity lives in public.admin_accounts and nothing reads
// profiles.app_role for admins. This deletes the now-vestigial profiles row of each
// admin — completing the physical separation. DESTRUCTIVE and effectively irreversible
// (restore from backup only), so it is GUARDED and DRY-RUN by default.
//
// Safety:
//   * Dry-run by default: prints each candidate, its dependent learner-data row count
//     across every FK-to-profiles table, and the full profiles row (backup JSON).
//   * Deletes ONLY with both --apply AND env PHASE7_CONFIRM=DELETE.
//   * Deletes a row ONLY if it has ZERO dependent rows in any learner-owned table
//     (so an admin who somehow authored learner content is never cascade-destroyed).
//   * The admin_audit_logs FK was already repointed to auth.users, so audit history
//     is preserved after the profiles row is gone.
//
// Usage (dry-run):   node scripts/db/phase7-delete-admin-profiles.mjs
// Usage (apply):     PHASE7_CONFIRM=DELETE node scripts/db/phase7-delete-admin-profiles.mjs --apply

import { readFileSync, existsSync } from 'node:fs';

if (!process.env.SUPABASE_ACCESS_TOKEN && existsSync('.env.local')) {
  for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const m = /^\s*SUPABASE_ACCESS_TOKEN\s*=\s*(.+?)\s*$/.exec(line);
    if (m) { process.env.SUPABASE_ACCESS_TOKEN = m[1].replace(/^["']|["']$/g, ''); break; }
  }
}
const PROJECT_REF = process.env.SUPABASE_PROJECT_REF ?? 'fglggyfvzjdsbyckinqa';
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
if (!TOKEN) { console.error('SUPABASE_ACCESS_TOKEN not set'); process.exit(1); }

const APPLY = process.argv.includes('--apply') && process.env.PHASE7_CONFIRM === 'DELETE';

async function runSql(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql })
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text}`);
  return JSON.parse(text);
}

// All (table, column) pairs with a FK referencing public.profiles(id).
const fks = await runSql(`
  select c.conrelid::regclass::text as tbl, a.attname as col
  from pg_constraint c
  join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
  where c.contype = 'f' and c.confrelid = 'public.profiles'::regclass
  order by 1`);

// Admins that still have a profiles row (deletion candidates).
const candidates = await runSql(`
  select a.id, a.email, a.role
  from public.admin_accounts a
  join public.profiles p on p.id = a.id
  order by a.email`);

if (!candidates.length) {
  console.log('No admin still has a profiles row — physical separation already complete.');
  process.exit(0);
}

console.log(`Mode: ${APPLY ? 'APPLY (will delete)' : 'DRY-RUN (no changes)'}`);
console.log(`FK-to-profiles tables checked: ${fks.length}`);

let deleted = 0;
for (const admin of candidates) {
  const id = admin.id;
  const countSql = fks
    .map((f) => `select '${f.tbl}.${f.col}' as ref, count(*)::int as n from ${f.tbl} where ${f.col} = '${id}'`)
    .join('\nunion all\n');
  const counts = await runSql(countSql);
  const deps = counts.filter((r) => r.n > 0);
  const backup = await runSql(`select row_to_json(p) as row from public.profiles p where p.id = '${id}'`);

  console.log(`\n=== ${admin.email} (${admin.role}, ${id}) ===`);
  console.log(`backup profiles row: ${JSON.stringify(backup[0]?.row)}`);
  if (deps.length) {
    console.log(`SKIP: has dependent learner data → ${deps.map((d) => `${d.ref}=${d.n}`).join(', ')}`);
    continue;
  }
  console.log('dependent learner-data rows: 0 (safe to delete)');
  if (APPLY) {
    await runSql(`delete from public.profiles where id = '${id}'`);
    console.log('DELETED profiles row.');
    deleted += 1;
  }
}

console.log(`\nDone. ${APPLY ? `${deleted} profiles row(s) deleted.` : 'Dry-run only — re-run with --apply and PHASE7_CONFIRM=DELETE to delete.'}`);
