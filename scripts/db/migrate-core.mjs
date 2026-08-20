import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  DEFAULT_SQL_MAX_ATTEMPTS,
  PRODUCTION_PROJECT_REF,
  fail,
  loadLocalEnv,
  requireIdentifier,
  requireMigrationName,
  sqlLiteral,
  stripOuterTransaction
} from './migration-primitives.mjs';
import {
  buildMigrationVerificationReport,
  listLocalMigrations,
  migrationRecord,
  printVerificationReport,
  readManifest,
  resolveManifestBatch,
  resolveManifestFile,
  validateBlocked,
  validateLocalSet,
  writeJsonReport
} from './migration-contract.mjs';

// 마이그 실행 계층 — 접속 대상 해석·SQL 실행·트래커·적용/롤백 오케스트레이션.
// 상수/유틸은 migration-primitives.mjs, 매니페스트·정적 계약은 migration-contract.mjs
// 로 분해했고, 아래 재수출로 기존 import 경로(스크립트 13개·테스트 4개)를 유지한다.
export {
  loadLocalEnv,
  sha256,
  stripOuterTransaction
} from './migration-primitives.mjs';
export {
  classifyMigrationVerification,
  inspectStaticMigrationContract,
  listLocalMigrations,
  resolveManifestBatch,
  validateLocalSet
} from './migration-contract.mjs';
function getArgValue(args, flag) {
  const index = args.indexOf(flag);
  if (index < 0) return null;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) fail(`${flag} requires a value.`);
  return value;
}

export function parseMigrationArgs(args) {
  const actionFlags = [
    ['status', '--status'],
    ['plan', '--plan'],
    ['apply', '--apply'],
    ['baseline', '--baseline-existing'],
    ['down', '--down'],
    ['verifyAll', '--verify-all'],
  ].filter(([, flag]) => args.includes(flag));

  if (actionFlags.length !== 1) {
    fail(
      'Choose exactly one action: --status, --plan, --apply, '
      + '--baseline-existing, --down <migration>, or --verify-all.'
    );
  }

  const [action] = actionFlags[0];
  const requireClean = args.includes('--require-clean');
  if (requireClean && action !== 'verifyAll') {
    fail('--require-clean is only valid with --verify-all.');
  }
  return {
    action,
    manifestPath: getArgValue(args, '--manifest'),
    batchName: getArgValue(args, '--batch'),
    downName: action === 'down' ? getArgValue(args, '--down') : null,
    allowDown: args.includes('--allow-down'),
    allowOutOfOrderDown: args.includes('--allow-out-of-order-down'),
    allowOutOfOrderApply: args.includes('--allow-out-of-order-apply'),
    requireClean,
    jsonOut: getArgValue(args, '--json-out'),
  };
}

function getTarget({ manifest = null, write = false }) {
  const projectRef = process.env.SUPABASE_PROJECT_REF;
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!projectRef) fail('SUPABASE_PROJECT_REF is required; there is no default project.');
  if (!token) fail('SUPABASE_ACCESS_TOKEN is required.');

  if (manifest) assertManifestProjectRef(manifest.projectRef, projectRef);

  if (write) {
    const expectedRef = process.env.SUPABASE_EXPECTED_PROJECT_REF;
    if (!expectedRef) fail('SUPABASE_EXPECTED_PROJECT_REF is required for writes.');
    if (expectedRef !== projectRef) {
      fail(`Expected project ${expectedRef} does not match target ${projectRef}.`);
    }
    if (
      projectRef === PRODUCTION_PROJECT_REF
      && process.env.SUPABASE_PRODUCTION_CONFIRM !== projectRef
    ) {
      fail('SUPABASE_PRODUCTION_CONFIRM must equal the production project ref.');
    }
  }

  return { projectRef, token };
}

export function assertManifestProjectRef(manifestProjectRef, targetProjectRef) {
  if (manifestProjectRef !== targetProjectRef) {
    fail(
      `Manifest projectRef ${manifestProjectRef} does not match target ${targetProjectRef}.`
    );
  }
}

// Retrying a committed statement re-runs non-idempotent DDL (`alter function ...
// set schema`, `alter column ... set not null`), so a batch that actually
// succeeded can report failure and then abort on the second pass. Callers that
// send such batches set SUPABASE_SQL_MAX_ATTEMPTS=1.
export function resolveSqlMaxAttempts(env = process.env) {
  const raw = env.SUPABASE_SQL_MAX_ATTEMPTS;
  if (raw === undefined || raw === '') return DEFAULT_SQL_MAX_ATTEMPTS;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed < 1 || String(parsed) !== raw.trim()) {
    fail(`SUPABASE_SQL_MAX_ATTEMPTS must be a positive integer: ${raw}`);
  }
  return parsed;
}

export async function runSql({ projectRef, token, sql }) {
  const url = `https://api.supabase.com/v1/projects/${projectRef}/database/query`;
  const maxAttempts = resolveSqlMaxAttempts();
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: sql }),
    });
    const text = await response.text();
    if (response.ok) {
      try {
        return JSON.parse(text);
      } catch {
        return text;
      }
    }

    const retryable = response.status === 429 || response.status >= 500;
    if (retryable && attempt < maxAttempts) {
      await new Promise((resolveWait) => setTimeout(resolveWait, attempt * 750));
      continue;
    }
    const summary = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500);
    fail(`Supabase Management API HTTP ${response.status}: ${summary}`);
  }
  fail('Supabase Management API request exhausted retries.');
}

function trackerLockKey(trackTable) {
  return `topik-ai:${trackTable}`;
}

async function ensureTracker({ target, trackTable }) {
  const table = requireIdentifier(trackTable, 'tracker table');
  await runSql({
    ...target,
    sql: `
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
select pg_advisory_xact_lock(hashtextextended(${sqlLiteral(trackerLockKey(table))}, 0));
create table if not exists public.${table} (
  name text primary key,
  applied_at timestamptz not null default now()
);
alter table public.${table}
  add column if not exists checksum_sha256 text,
  add column if not exists apply_mode text,
  add column if not exists batch_id text,
  add column if not exists applied_by text;
alter table public.${table} enable row level security;
alter table public.${table} force row level security;
revoke all on public.${table} from public, anon, authenticated;
commit;`,
  });
}

async function loadApplied({ target, trackTable }) {
  const table = requireIdentifier(trackTable, 'tracker table');
  const relation = await runSql({
    ...target,
    sql: `select to_regclass(${sqlLiteral(`public.${table}`)}) is not null as exists`,
  });
  if (!relation[0]?.exists) return [];

  const columns = await runSql({
    ...target,
    sql: `
select column_name
from information_schema.columns
where table_schema = 'public' and table_name = ${sqlLiteral(table)}`,
  });
  const available = new Set(columns.map((row) => row.column_name));
  const optional = ['checksum_sha256', 'apply_mode', 'batch_id', 'applied_by'];
  const projection = [
    'name',
    'applied_at',
    ...optional.map((name) => (
      available.has(name) ? name : `null::text as ${name}`
    )),
  ].join(', ');
  return runSql({
    ...target,
    sql: `select ${projection} from public.${table} order by name`,
  });
}

function printStatus({ localMigrations, appliedRows }) {
  const applied = new Map(appliedRows.map((row) => [row.name, row]));
  for (const name of localMigrations) {
    const row = applied.get(name);
    if (!row) {
      console.log(`[pending] ${name}`);
    } else if (!row.checksum_sha256) {
      console.log(`[applied-unbaselined] ${name}`);
    } else {
      console.log(`[applied] ${name}`);
    }
  }
  for (const row of appliedRows) {
    if (!localMigrations.includes(row.name)) console.log(`[remote-only] ${row.name}`);
  }
}

function printPlan({ records, appliedRows, batchName, batch }) {
  const applied = new Map(appliedRows.map((row) => [row.name, row]));
  console.log(`batch=${batchName}`);
  for (const record of records) {
    const row = applied.get(record.name);
    let state = record.mode === 'adopt' ? 'adopt' : 'apply';
    if (row?.checksum_sha256 === record.checksum) state = 'skip';
    else if (row && !row.checksum_sha256) state = 'baseline-needed';
    else if (row) state = 'checksum-mismatch';
    console.log(`[${state}] ${record.name} sha256=${record.checksum}`);
  }
  if (batch.precondition) console.log(`[precondition] ${batch.precondition}`);
  if (batch.afterSql) console.log(`[finalizer] ${batch.afterSql}`);
}

function atomicMigrationSql({
  trackTable,
  record,
  batchName,
  operator,
  migrationSql,
}) {
  const table = requireIdentifier(trackTable, 'tracker table');
  return `
begin;
set local lock_timeout = '5s';
set local statement_timeout = '180s';
select pg_advisory_xact_lock(hashtextextended(${sqlLiteral(trackerLockKey(table))}, 0));
${migrationSql}
insert into public.${table} (
  name, checksum_sha256, apply_mode, batch_id, applied_by
) values (
  ${sqlLiteral(record.name)},
  ${sqlLiteral(record.checksum)},
  ${sqlLiteral(record.mode)},
  ${sqlLiteral(batchName)},
  ${sqlLiteral(operator)}
)
on conflict (name) do update
set checksum_sha256 = excluded.checksum_sha256,
    apply_mode = excluded.apply_mode,
    batch_id = excluded.batch_id,
    applied_by = excluded.applied_by
where public.${table}.checksum_sha256 is null;
commit;`;
}

async function assertPrecondition({ target, manifestPath, record }) {
  if (!record.precondition) fail(`Adopt migration requires precondition: ${record.name}`);
  const path = resolveManifestFile(manifestPath, record.precondition);
  const rows = await runSql({
    ...target,
    sql: readFileSync(path, 'utf8'),
  });
  if (!Array.isArray(rows) || rows.length === 0 || rows[0].ok !== true) {
    fail(`Adopt precondition failed for ${record.name}.`);
  }
}

async function assertBatchPrecondition({ target, manifestPath, batchName, batch }) {
  if (!batch.precondition) return;
  const path = resolveManifestFile(manifestPath, batch.precondition);
  const rows = await runSql({
    ...target,
    sql: readFileSync(path, 'utf8'),
  });
  if (!Array.isArray(rows) || rows.length === 0 || rows[0].ok !== true) {
    fail(`Batch precondition failed for ${batchName}.`);
  }
}

async function applyRecords({
  target,
  trackTable,
  manifestPath,
  batchName,
  batch,
  records,
  appliedRows,
  allowOutOfOrderApply = false,
}) {
  const applied = new Map(appliedRows.map((row) => [row.name, row]));
  const operator = process.env.SUPABASE_MIGRATION_OPERATOR ?? 'codex';
  let changed = 0;

  await assertBatchPrecondition({ target, manifestPath, batchName, batch });

  for (const record of records) {
    const existing = applied.get(record.name);
    if (existing?.checksum_sha256 && existing.checksum_sha256 !== record.checksum) {
      fail(`Checksum mismatch for applied migration ${record.name}.`);
    }
    if (existing) {
      console.log(`skip ${record.name}`);
      continue;
    }

    const newerApplied = findOutOfOrderApplyBlockers({
      migrationName: record.name,
      appliedNames: applied.keys(),
    });
    if (newerApplied.length > 0 && !allowOutOfOrderApply) {
      fail(
        `Refusing to apply ${record.name} while newer migration(s) are already applied: `
        + `${newerApplied.slice(-5).join(', ')}${newerApplied.length > 5 ? ` (+${newerApplied.length - 5} more)` : ''}. `
        + 'A back-dated file replays its own CREATE OR REPLACE bodies on top of the newer ones, '
        + 'so anything the newer files added to those objects is silently dropped and the live '
        + 'schema stops matching a clean replay. Confirm this file shares no object with the '
        + 'newer ones (or re-apply them afterwards in name order), then re-run with '
        + '--allow-out-of-order-apply.'
      );
    }
    if (newerApplied.length > 0) {
      console.warn(
        `WARNING: applying ${record.name} out of order; newer already applied: `
        + `${newerApplied.slice(-3).join(', ')}`
      );
    }

    if (record.mode === 'adopt') {
      await assertPrecondition({ target, manifestPath, record });
    }

    const migrationSql = record.mode === 'adopt'
      ? `select true as adopted_${record.name.slice(0, 14)};`
      : stripOuterTransaction(record.contents.toString('utf8'));
    process.stdout.write(`${record.mode} ${record.name} ... `);
    await runSql({
      ...target,
      sql: atomicMigrationSql({
        trackTable,
        record,
        batchName,
        operator,
        migrationSql,
      }),
    });
    console.log('ok');
    changed += 1;
  }

  if (batch.afterSql) {
    const afterPath = resolveManifestFile(manifestPath, batch.afterSql);
    const afterSql = stripOuterTransaction(readFileSync(afterPath, 'utf8'));
    process.stdout.write(`finalize ${batchName} ... `);
    await runSql({
      ...target,
      sql: `
begin;
set local lock_timeout = '5s';
set local statement_timeout = '180s';
select pg_advisory_xact_lock(hashtextextended(
  ${sqlLiteral(`topik-ai:${trackTable}:${batchName}:finalizer`)}, 0
));
${afterSql}
commit;`,
    });
    console.log('ok');
  }

  console.log(changed === 0 ? 'nothing changed' : `changed ${changed} migration(s)`);
}

async function baselineRecords({
  target,
  trackTable,
  batchName,
  records,
  appliedRows,
}) {
  const applied = new Map(appliedRows.map((row) => [row.name, row]));
  const table = requireIdentifier(trackTable, 'tracker table');
  const operator = process.env.SUPABASE_MIGRATION_OPERATOR ?? 'codex';
  let changed = 0;

  for (const record of records) {
    const existing = applied.get(record.name);
    if (!existing) fail(`Cannot baseline pending migration ${record.name}.`);
    if (existing.checksum_sha256 && existing.checksum_sha256 !== record.checksum) {
      fail(`Checksum mismatch for applied migration ${record.name}.`);
    }
    if (existing.checksum_sha256 === record.checksum) continue;

    await runSql({
      ...target,
      sql: `
begin;
set local lock_timeout = '5s';
select pg_advisory_xact_lock(hashtextextended(${sqlLiteral(trackerLockKey(table))}, 0));
update public.${table}
set checksum_sha256 = ${sqlLiteral(record.checksum)},
    apply_mode = coalesce(apply_mode, 'legacy-local-baseline'),
    batch_id = coalesce(batch_id, ${sqlLiteral(batchName)}),
    applied_by = coalesce(applied_by, ${sqlLiteral(operator)})
where name = ${sqlLiteral(record.name)}
  and checksum_sha256 is null;
commit;`,
    });
    changed += 1;
  }
  console.log(changed === 0 ? 'baseline already current' : `baselined ${changed} migration(s)`);
}

// Rolling back out of order is how a tracker and the live schema drift apart.
// Several migrations here rewrite an existing function by reading its live body and
// replacing one block (pg_get_functiondef surgery). Those files assert what the
// previous definition looks like, so undoing an earlier one while a later one is
// still applied either fails closed or — worse — succeeds against a body the down
// file was never written for. LIFO is the only order whose result is defined.
export function findLaterAppliedMigrations({ migrationName, appliedNames }) {
  return [...appliedNames]
    .filter((name) => name > migrationName)
    .sort();
}

// Applying forward out of order drifts the live schema away from what a clean replay
// produces, and the drift is silent. 2026-08-06 audit of dev: 20260617211000 was still
// pending when the 20260623283000-block landed, so when it finally ran its
// CREATE OR REPLACE bodies overwrote the newer files and dropped the permission gates
// from 48 functions. Files and production were correct the whole time; only the
// environment that applied out of order was wrong, and nothing failed loudly.
// Ascending name order is the only order whose result equals a clean replay.
export function findOutOfOrderApplyBlockers({ migrationName, appliedNames }) {
  return findLaterAppliedMigrations({ migrationName, appliedNames });
}

async function rollbackMigration({
  target,
  trackTable,
  migrationsDir,
  migrationName,
  appliedNames = [],
  allowOutOfOrderDown = false,
}) {
  requireMigrationName(migrationName);
  const downPath = join(migrationsDir, 'down', migrationName);
  if (!existsSync(downPath)) fail(`Down migration not found: ${downPath}`);

  const laterApplied = findLaterAppliedMigrations({ migrationName, appliedNames });
  if (laterApplied.length > 0 && !allowOutOfOrderDown) {
    fail(
      `Refusing to roll back ${migrationName} while newer migration(s) are still applied: `
      + `${laterApplied.join(', ')}. Roll those back first (newest first) so each down runs `
      + 'against the state its forward file created. If you have verified that none of them '
      + 'touches the same objects, re-run with --allow-out-of-order-down.'
    );
  }
  if (laterApplied.length > 0) {
    console.warn(
      `WARNING: rolling back ${migrationName} out of order; still applied: ${laterApplied.join(', ')}`
    );
  }

  const table = requireIdentifier(trackTable, 'tracker table');
  const downSql = stripOuterTransaction(readFileSync(downPath, 'utf8'));
  await runSql({
    ...target,
    sql: `
begin;
set local lock_timeout = '5s';
set local statement_timeout = '180s';
select pg_advisory_xact_lock(hashtextextended(${sqlLiteral(trackerLockKey(table))}, 0));
${downSql}
delete from public.${table} where name = ${sqlLiteral(migrationName)};
commit;`,
  });
  console.log(`rolled back ${migrationName}`);
}

export async function runMigrate({ trackTable, migrationsDir, args }) {
  loadLocalEnv();
  requireIdentifier(trackTable, 'tracker table');
  const options = parseMigrationArgs(args);
  const localMigrations = listLocalMigrations(migrationsDir);

  if (options.action === 'status') {
    const target = getTarget({ write: false });
    const appliedRows = await loadApplied({ target, trackTable });
    printStatus({ localMigrations, appliedRows });
    return;
  }

  if (options.action === 'down') {
    if (!options.allowDown) fail('--down also requires --allow-down.');
    const target = getTarget({ write: true });
    await ensureTracker({ target, trackTable });
    const appliedRows = await loadApplied({ target, trackTable });
    await rollbackMigration({
      target,
      trackTable,
      migrationsDir,
      migrationName: options.downName,
      appliedNames: appliedRows.map((row) => row.name),
      allowOutOfOrderDown: options.allowOutOfOrderDown,
    });
    return;
  }

  const { manifest, absolutePath: manifestPath } = readManifest(options.manifestPath);
  validateLocalSet(manifest, localMigrations);
  const { batch, entries } = resolveManifestBatch({
    manifest,
    batchName: options.batchName,
    localMigrations,
  });
  const records = entries.map((entry) => migrationRecord({ migrationsDir, entry }));
  validateBlocked(manifest, records);
  const write = options.action === 'apply' || options.action === 'baseline';
  const target = getTarget({ manifest, write });
  if (write) await ensureTracker({ target, trackTable });
  const appliedRows = await loadApplied({ target, trackTable });

  if (options.action === 'verifyAll') {
    const report = buildMigrationVerificationReport({
      manifest,
      manifestPath,
      batchName: options.batchName,
      localMigrations,
      migrationsDir,
      appliedRows,
      trackTable,
      projectRef: target.projectRef,
    });
    writeJsonReport(options.jsonOut, report);
    printVerificationReport(report);
    if (options.requireClean && !report.clean) {
      fail(`Migration verification failed with ${report.issueCount} issue(s).`);
    }
    return report;
  }

  if (options.action === 'plan') {
    printPlan({
      records,
      appliedRows,
      batchName: options.batchName,
      batch,
    });
    return;
  }

  if (options.action === 'baseline') {
    await baselineRecords({
      target,
      trackTable,
      batchName: options.batchName,
      records,
      appliedRows,
    });
    return;
  }

  await applyRecords({
    target,
    trackTable,
    migrationsDir,
    manifestPath,
    batchName: options.batchName,
    batch,
    records,
    appliedRows,
    allowOutOfOrderApply: options.allowOutOfOrderApply,
  });
}
