#!/usr/bin/env node
// Repair an environment whose live function definitions lost permission gates the
// applied migration files require (see verify-permission-gate-parity.mjs for how that
// happens and why a clean replay cannot reveal it).
//
// The repair copies definitions from a reference environment that already passes the
// parity check, because that environment is by definition holding the correct-order
// result. Nothing is authored here: the fix is "make the drifted environment's bodies
// equal the ones the file order produces", so a hand-written body would just be a
// second chance to get it wrong.
//
// Refuses to run unless, for every function it would touch:
//   - the reference environment has the gate the files require, and
//   - both environments expose the identical signature (otherwise CREATE OR REPLACE
//     would add an overload instead of replacing, leaving the ungated body callable).
//
// Writes obey the same target contract as migrations: SUPABASE_EXPECTED_PROJECT_REF
// must equal the target, and a production target additionally needs
// SUPABASE_PRODUCTION_CONFIRM.
//
// Usage:
//   SUPABASE_ACCESS_TOKEN=... \
//   SUPABASE_EXPECTED_PROJECT_REF=<target> \
//   node scripts/db/repair-permission-gate-drift.mjs \
//     --target <ref> --reference <ref> [--namespace admin] [--dry-run]

import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadLocalEnv, runSql } from './migrate-core.mjs';
import { parseDeclaredGates, resolveExpectedGates } from './verify-permission-gate-parity.mjs';

const PRODUCTION_REF = 'eymlabowhfgtxbiqwxqh';
const NAMESPACES = {
  admin: { dir: 'supabase/migrations-admin', trackTable: 'admin_schema_migrations' },
  writing: { dir: 'supabase/migrations', trackTable: 'topik_writing_schema_migrations' },
};
const CHUNK_SIZE = 6;

function fail(message) {
  console.error(message);
  process.exit(1);
}

function argValue(args, flag) {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : null;
}

function sqlLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

async function loadEnvironment({ target, trackTable }) {
  const [appliedRows, functionRows] = await Promise.all([
    runSql({ ...target, sql: `select name from public.${trackTable} order by name` }),
    runSql({
      ...target,
      sql: `
select p.proname as fname,
       p.oid::regprocedure::text as identity,
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
    functions: new Map(functionRows.map((row) => [row.fname, { identity: row.identity, keys: row.keys ?? [] }])),
  };
}

function readMigrationFiles(dir) {
  return readdirSync(dir)
    .filter((name) => /^\d{14}_[a-z0-9_]+\.sql$/.test(name))
    .map((name) => ({ name, sql: readFileSync(join(dir, name), 'utf8') }));
}

export function planRepair({ expected, targetFns, referenceFns }) {
  const repairs = [];
  const blockers = [];
  for (const [fname, exp] of expected) {
    if (exp.keys.length === 0) continue;
    const live = targetFns.get(fname);
    const ref = referenceFns.get(fname);
    if (!live) continue;
    const haveLive = new Set(live.keys);
    if (exp.keys.every((key) => haveLive.has(key))) continue;

    if (!ref) {
      blockers.push({ fname, reason: 'reference environment does not have this function' });
      continue;
    }
    const haveRef = new Set(ref.keys);
    const refMissing = exp.keys.filter((key) => !haveRef.has(key));
    if (refMissing.length > 0) {
      blockers.push({ fname, reason: `reference is also missing ${refMissing.join(', ')}` });
      continue;
    }
    if (ref.identity !== live.identity) {
      blockers.push({
        fname,
        reason: `signature differs (target ${live.identity} vs reference ${ref.identity})`,
      });
      continue;
    }
    repairs.push({ fname, identity: live.identity, expectedKeys: exp.keys });
  }
  return { repairs, blockers };
}

async function fetchDefinitions({ target, identities }) {
  const rows = await runSql({
    ...target,
    sql: `
select p.oid::regprocedure::text as identity, pg_get_functiondef(p.oid) as def
from pg_proc p
where p.oid::regprocedure::text in (${identities.map(sqlLiteral).join(', ')})`,
  });
  return new Map(rows.map((row) => [row.identity, row.def]));
}

async function main() {
  loadLocalEnv();
  const args = process.argv.slice(2);
  const targetRef = argValue(args, '--target');
  const referenceRef = argValue(args, '--reference');
  const namespace = argValue(args, '--namespace') ?? 'admin';
  const dryRun = args.includes('--dry-run');
  const token = process.env.SUPABASE_ACCESS_TOKEN;

  if (!targetRef || !referenceRef) fail('--target and --reference are required.');
  if (targetRef === referenceRef) fail('--target and --reference must differ.');
  if (!token) fail('SUPABASE_ACCESS_TOKEN is required.');
  if (!NAMESPACES[namespace]) fail(`Unknown namespace: ${namespace}`);
  if (!dryRun && process.env.SUPABASE_EXPECTED_PROJECT_REF !== targetRef) {
    fail('Writes require SUPABASE_EXPECTED_PROJECT_REF matching --target.');
  }
  if (!dryRun && targetRef === PRODUCTION_REF && process.env.SUPABASE_PRODUCTION_CONFIRM !== targetRef) {
    fail('Production writes require SUPABASE_PRODUCTION_CONFIRM.');
  }

  const { dir, trackTable } = NAMESPACES[namespace];
  const target = { projectRef: targetRef, token };
  const reference = { projectRef: referenceRef, token };

  const [targetEnv, referenceEnv] = await Promise.all([
    loadEnvironment({ target, trackTable }),
    loadEnvironment({ target: reference, trackTable }),
  ]);

  const files = readMigrationFiles(dir);
  const expected = resolveExpectedGates({ files, appliedNames: targetEnv.appliedNames });
  const { repairs, blockers } = planRepair({
    expected,
    targetFns: targetEnv.functions,
    referenceFns: referenceEnv.functions,
  });

  console.log(`namespace=${namespace} target=${targetRef} reference=${referenceRef}`);
  console.log(`drifted=${repairs.length} blocked=${blockers.length}`);
  for (const row of blockers) console.error(`  BLOCKED ${row.fname}: ${row.reason}`);
  if (blockers.length > 0) {
    fail('Refusing to repair while blockers remain: the reference environment must itself be correct.');
  }
  if (repairs.length === 0) {
    console.log('Nothing to repair.');
    return;
  }
  for (const row of repairs) console.log(`  repair ${row.identity} → ${row.expectedKeys.join(', ')}`);
  if (dryRun) {
    console.log('Dry run: no changes applied.');
    return;
  }

  const definitions = await fetchDefinitions({ target: reference, identities: repairs.map((r) => r.identity) });
  for (const row of repairs) {
    if (!definitions.has(row.identity)) fail(`Reference definition missing for ${row.identity}.`);
  }

  // One transaction per chunk keeps each payload inside the Management API limits while
  // still making every individual replacement atomic with its own verification.
  for (let index = 0; index < repairs.length; index += CHUNK_SIZE) {
    const chunk = repairs.slice(index, index + CHUNK_SIZE);
    // pg_get_functiondef returns no trailing semicolon, so the statements have to be
    // terminated here or the next CREATE parses as part of the previous body.
    const bodies = chunk
      .map((row) => `${definitions.get(row.identity).replace(/;\s*$/, '')};`)
      .join('\n\n');
    const assertions = chunk.map((row) => `
  if (select count(*) from regexp_matches(
        (select p.prosrc from pg_proc p where p.oid::regprocedure::text = ${sqlLiteral(row.identity)}),
        ${sqlLiteral(`admin_has_permission\\s*\\(\\s*[^,]+,\\s*'${row.expectedKeys[0].replace(/\./g, '\\.')}'`)}, 'g')) < 1 then
    raise exception 'repair failed: % still lacks %', ${sqlLiteral(row.identity)}, ${sqlLiteral(row.expectedKeys[0])};
  end if;`).join('');

    process.stdout.write(`applying ${index + 1}-${index + chunk.length} of ${repairs.length} ... `);
    await runSql({
      ...target,
      sql: `
begin;
set local lock_timeout = '5s';
set local statement_timeout = '180s';
${bodies}
do $repair_verify$
begin${assertions}
end
$repair_verify$;
commit;`,
    });
    console.log('ok');
  }

  console.log(`Repaired ${repairs.length} function(s). Re-run db:permission-gate-parity to confirm.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main();
}

export { parseDeclaredGates };
