#!/usr/bin/env node
// Permission-gate parity: does the live schema still enforce what the applied
// migration files say it enforces?
//
// Why this exists. On 2026-08-06 a dev audit found 48 admin RPCs running with only
// a role check while the files (and production) required a permission key as well.
// Nothing had failed: 20260617211000 was still pending when the 20260623283000-block
// landed, and when it finally ran its CREATE OR REPLACE bodies replayed over the
// newer definitions and dropped their gates. A clean replay produces the correct
// state, so the shadow contract could never see it — only a live environment that
// applied out of order was wrong, and only for a month.
//
// So the direction that matters is: files expect a key, live does not have it.
// The reverse (live has a key the files do not textually declare) is normal here —
// the house pattern edits live definitions through pg_get_functiondef surgery inside
// do-blocks, which no static parser can read. That direction is reported, never failed.
//
// Scoping: expectations come from the last APPLIED file that defines each function,
// in name order. Pending migrations are ignored, so an environment that is simply
// behind does not look like drift.
//
// Usage:
//   SUPABASE_PROJECT_REF=<ref> node scripts/db/verify-permission-gate-parity.mjs
//   ... --json-out <path>   write the full report
//   ... --namespace admin|writing|all   (default: all)

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadLocalEnv, runSql } from './migrate-core.mjs';

const NAMESPACES = {
  admin: { dir: 'supabase/migrations-admin', trackTable: 'admin_schema_migrations' },
  writing: { dir: 'supabase/migrations', trackTable: 'topik_writing_schema_migrations' },
};

const FUNCTION_HEAD = /create\s+or\s+replace\s+function\s+public\.([a-z0-9_]+)\s*\(/gi;
const KEY_CALL = /admin_has_permission\s*\(\s*[^,]+,\s*'([a-z0-9.-]+)'/g;
const ADMIN_FUNCTION = /^(admin_|get_admin_|search_admin_)/;

function fail(message) {
  console.error(message);
  process.exit(1);
}

// Split a migration file into per-function slices and record the permission keys each
// body checks. Slicing on the next CREATE OR REPLACE header keeps one function's keys
// from bleeding into its neighbour, which matters in the phase8 files where a dozen
// functions share a file and only some are gated.
export function parseDeclaredGates(sql) {
  const heads = [];
  FUNCTION_HEAD.lastIndex = 0;
  let match = FUNCTION_HEAD.exec(sql);
  while (match) {
    heads.push({ name: match[1], at: match.index });
    match = FUNCTION_HEAD.exec(sql);
  }

  const declared = new Map();
  for (let index = 0; index < heads.length; index += 1) {
    const end = index + 1 < heads.length ? heads[index + 1].at : sql.length;
    const body = sql.slice(heads[index].at, end);
    const keys = new Set();
    KEY_CALL.lastIndex = 0;
    let keyMatch = KEY_CALL.exec(body);
    while (keyMatch) {
      keys.add(keyMatch[1]);
      keyMatch = KEY_CALL.exec(body);
    }
    // Last header for a name inside one file wins, same as Postgres would resolve it.
    declared.set(heads[index].name, [...keys].sort());
  }
  return declared;
}

// Name order is replay order. Only applied files count, and the last one to define a
// function owns the expectation — that is precisely the rule the out-of-order apply
// broke, so the checker has to model it rather than union every file's keys.
export function resolveExpectedGates({ files, appliedNames }) {
  const appliedSet = new Set(appliedNames);
  const expected = new Map();
  for (const file of [...files].sort((a, b) => a.name.localeCompare(b.name))) {
    if (!appliedSet.has(file.name)) continue;
    for (const [fname, keys] of parseDeclaredGates(file.sql)) {
      if (!ADMIN_FUNCTION.test(fname)) continue;
      expected.set(fname, { keys, file: file.name });
    }
  }
  return expected;
}

export function diffGates({ expected, live }) {
  const missing = [];
  const extra = [];
  for (const [fname, exp] of expected) {
    if (exp.keys.length === 0) continue;
    const actual = live.get(fname);
    if (!actual) continue; // function absent live: a schema-shape problem other checks own
    const have = new Set(actual.keys);
    const absent = exp.keys.filter((key) => !have.has(key));
    if (absent.length > 0) {
      missing.push({ fname, expectedKeys: exp.keys, liveKeys: actual.keys, declaredBy: exp.file });
    }
  }
  for (const [fname, actual] of live) {
    if (actual.keys.length === 0) continue;
    const exp = expected.get(fname);
    if (!exp || exp.keys.length === 0) extra.push({ fname, liveKeys: actual.keys });
  }
  return { missing, extra };
}

function readMigrationFiles(dir) {
  return readdirSync(dir)
    .filter((name) => /^\d{14}_[a-z0-9_]+\.sql$/.test(name))
    .map((name) => ({ name, sql: readFileSync(join(dir, name), 'utf8') }));
}

async function loadLive({ target, trackTable }) {
  const [appliedRows, functionRows] = await Promise.all([
    runSql({ ...target, sql: `select name from public.${trackTable} order by name` }),
    runSql({
      ...target,
      sql: `
select p.proname as fname,
       (select coalesce(array_agg(distinct m[1] order by m[1]), '{}'::text[])
        from regexp_matches(p.prosrc, 'admin_has_permission\\s*\\(\\s*[^,]+,\\s*''([a-z0-9.\\-]+)''', 'g') as m
       ) as keys
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname ~ '^(admin_|get_admin_|search_admin_)'
order by p.proname`,
    }),
  ]);
  return {
    appliedNames: appliedRows.map((row) => row.name),
    live: new Map(functionRows.map((row) => [row.fname, { keys: row.keys ?? [] }])),
  };
}

async function main() {
  loadLocalEnv();
  const args = process.argv.slice(2);
  const jsonOutIndex = args.indexOf('--json-out');
  const jsonOut = jsonOutIndex >= 0 ? args[jsonOutIndex + 1] : null;
  const nsIndex = args.indexOf('--namespace');
  const requested = nsIndex >= 0 ? args[nsIndex + 1] : 'all';

  const projectRef = process.env.SUPABASE_PROJECT_REF;
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!projectRef || !token) fail('SUPABASE_PROJECT_REF and SUPABASE_ACCESS_TOKEN are required.');

  const namespaces = requested === 'all' ? Object.keys(NAMESPACES) : [requested];
  for (const ns of namespaces) {
    if (!NAMESPACES[ns]) fail(`Unknown namespace: ${ns}`);
  }

  const target = { projectRef, token };
  const report = { projectRef, namespaces: {}, missingTotal: 0 };

  for (const ns of namespaces) {
    const { dir, trackTable } = NAMESPACES[ns];
    const { appliedNames, live } = await loadLive({ target, trackTable });
    const expected = resolveExpectedGates({ files: readMigrationFiles(dir), appliedNames });
    const { missing, extra } = diffGates({ expected, live });
    report.namespaces[ns] = {
      appliedCount: appliedNames.length,
      expectedGatedCount: [...expected.values()].filter((e) => e.keys.length > 0).length,
      missing,
      extraCount: extra.length,
    };
    report.missingTotal += missing.length;

    console.log(
      `[${ns}] applied=${appliedNames.length} `
      + `files-expect-gate=${report.namespaces[ns].expectedGatedCount} `
      + `live-only-gate=${extra.length} missing=${missing.length}`
    );
    for (const row of missing) {
      console.error(
        `  MISSING ${row.fname}: files require ${row.expectedKeys.join(', ')} `
        + `(declared by ${row.declaredBy}) but live has `
        + `${row.liveKeys.length > 0 ? row.liveKeys.join(', ') : 'no permission key'}`
      );
    }
  }

  if (jsonOut) writeFileSync(jsonOut, `${JSON.stringify(report, null, 2)}\n`);

  if (report.missingTotal > 0) {
    fail(
      `Permission-gate parity failed: ${report.missingTotal} function(s) lost a gate the applied `
      + 'files require. This is live drift, not a code change — most often a back-dated migration '
      + 'applied after a newer one replayed its bodies over the newer definitions. Restore the '
      + 'affected definitions from the correct-order state, then re-run.'
    );
  }
  console.log('Permission-gate parity passed.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main();
}
