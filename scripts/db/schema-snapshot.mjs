#!/usr/bin/env node
// Snapshot the public/private schema surface (tables/columns, functions,
// policies, views) of the shared Supabase project as canonical JSON, for the
// P1 "기존 테이블 무변경 diff" gate: snapshot before and after migration, then
// compare with --diff excluding the topik_writing_* namespace we own.
//
// Usage:
//   node scripts/db/schema-snapshot.mjs --out snap.json
//   node scripts/db/schema-snapshot.mjs --diff before.json after.json [--exclude-own]

import { readFileSync, writeFileSync } from 'node:fs';

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF ?? 'fglggyfvzjdsbyckinqa';
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

async function runSql(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text}`);
  return JSON.parse(text);
}

const OWN_PREFIX = 'topik_writing_';
const OWN_FUNCTIONS = ['admin_update_topik_question', 'admin_assign_question_tag', 'admin_remove_question_tag'];

function isOwn(name) {
  return name.startsWith(OWN_PREFIX) || OWN_FUNCTIONS.includes(name);
}

async function snapshot() {
  const columns = await runSql(`
    select table_name, column_name, data_type, is_nullable, column_default
      from information_schema.columns
     where table_schema = 'public'
     order by table_name, ordinal_position`);
  const functions = await runSql(`
    select n.nspname as schema, p.proname as name, pg_get_function_identity_arguments(p.oid) as args,
           md5(pg_get_functiondef(p.oid)) as def_hash
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname in ('public', 'private') and p.prokind = 'f'
     order by 1, 2, 3`);
  const policies = await runSql(`
    select schemaname, tablename, policyname, cmd,
           md5(coalesce(pg_get_expr(polqual, polrelid), '') || coalesce(pg_get_expr(polwithcheck, polrelid), '')) as expr_hash
      from pg_policies pp
      join pg_policy pol on pol.polname = pp.policyname
      join pg_class c on c.oid = pol.polrelid and c.relname = pp.tablename
     order by 1, 2, 3`);
  const views = await runSql(`
    select table_name, md5(view_definition) as def_hash
      from information_schema.views
     where table_schema = 'public'
     order by table_name`);
  return { columns, functions, policies, views };
}

function key(entry, fields) {
  return fields.map((f) => entry[f]).join('|');
}

function diffSection(before, after, fields, ownField, excludeOwn) {
  const fmt = (e) => JSON.stringify(e);
  const beforeMap = new Map(before.map((e) => [key(e, fields), fmt(e)]));
  const afterMap = new Map(after.map((e) => [key(e, fields), fmt(e)]));
  const changes = [];
  for (const [k, v] of afterMap) {
    const ownName = k.split('|')[ownField];
    if (excludeOwn && isOwn(ownName)) continue;
    if (!beforeMap.has(k)) changes.push({ type: 'added', entry: v });
    else if (beforeMap.get(k) !== v) changes.push({ type: 'changed', before: beforeMap.get(k), after: v });
  }
  for (const [k, v] of beforeMap) {
    const ownName = k.split('|')[ownField];
    if (excludeOwn && isOwn(ownName)) continue;
    if (!afterMap.has(k)) changes.push({ type: 'removed', entry: v });
  }
  return changes;
}

const args = process.argv.slice(2);

if (args[0] === '--diff') {
  const before = JSON.parse(readFileSync(args[1], 'utf8'));
  const after = JSON.parse(readFileSync(args[2], 'utf8'));
  const excludeOwn = args.includes('--exclude-own');
  const result = {
    columns: diffSection(before.columns, after.columns, ['table_name', 'column_name'], 0, excludeOwn),
    functions: diffSection(before.functions, after.functions, ['schema', 'name', 'args'], 1, excludeOwn),
    policies: diffSection(before.policies, after.policies, ['schemaname', 'tablename', 'policyname'], 1, excludeOwn),
    views: diffSection(before.views, after.views, ['table_name'], 0, excludeOwn),
  };
  const total = Object.values(result).reduce((n, c) => n + c.length, 0);
  console.log(JSON.stringify(result, null, 2));
  console.log(`total differences${excludeOwn ? ' (excluding topik_writing_* namespace)' : ''}: ${total}`);
  process.exit(total === 0 ? 0 : 1);
}

if (!TOKEN) {
  console.error('SUPABASE_ACCESS_TOKEN is not set.');
  process.exit(1);
}
const outFlag = args.indexOf('--out');
const outPath = outFlag >= 0 ? args[outFlag + 1] : null;
const snap = await snapshot();
const json = JSON.stringify(snap, null, 2);
if (outPath) {
  writeFileSync(outPath, json);
  console.log(`snapshot written: ${outPath} (tables=${new Set(snap.columns.map((c) => c.table_name)).size}, functions=${snap.functions.length}, policies=${snap.policies.length}, views=${snap.views.length})`);
} else {
  console.log(json);
}
