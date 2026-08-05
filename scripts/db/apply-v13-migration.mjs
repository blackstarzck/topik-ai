#!/usr/bin/env node
// Applies v13-owned pending migrations to the shared development project.
//
// v13 does not apply remotely (v13 AGENTS.md, v13 supabase/README.md); each
// migration's INDEX.md entry delegates remote apply to topik-ai operations.
// Precedent: v13 20260707120000 was applied with run-sql.mjs plus a v13 CLI
// tracker repair row under owner approval 2026-07-07.
//
// This runner is deliberately separate from db:migrate / db:admin:migrate:
//   - those hardcode their tracker and reach it as `public.<table>`, and
//     requireIdentifier rejects the dot in supabase_migrations.schema_migrations
//   - ensureTracker() runs DDL against the tracker (create table, add column,
//     enable RLS). Pointing that at the v13 CLI ledger would mutate v13's own
//     bookkeeping schema, which is never acceptable.
// So it reuses only the pure helpers and writes the v13 ledger with plain SQL.
//
// Migration bodies are read from the v13 git object store at an explicit commit,
// never from a working tree, so a dirty checkout cannot leak into an apply.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  assertManifestProjectRef,
  loadLocalEnv,
  runSql,
  sha256,
  stripOuterTransaction,
} from './migrate-core.mjs';

const PRODUCTION_PROJECT_REF = 'eymlabowhfgtxbiqwxqh';
const MIGRATION_NAME_PATTERN = /^(\d{14})_([a-z0-9_]+)\.sql$/;
const PLAIN_IDENTIFIER = /^[a-z_][a-z0-9_]*$/;
const FULL_SHA_PATTERN = /^[0-9a-f]{40}$/;

// Statements that cannot run inside a transaction block. The runner wraps every
// batch in one, so a match means the batch could never be atomic.
const TRANSACTION_HOSTILE = [
  ['create index concurrently', /\bcreate\s+(unique\s+)?index\s+concurrently\b/i],
  ['drop index concurrently', /\bdrop\s+index\s+concurrently\b/i],
  ['reindex concurrently', /\breindex\b[\s\S]{0,40}?\bconcurrently\b/i],
  ['vacuum', /\bvacuum\b/i],
  ['alter system', /\balter\s+system\b/i],
  ['create database', /\bcreate\s+database\b/i],
  ['drop database', /\bdrop\s+database\b/i],
  ['create tablespace', /\bcreate\s+tablespace\b/i],
];

const PROBE_KINDS = new Set(['function', 'table', 'column', 'trigger', 'policy']);

function fail(message) {
  throw new Error(message);
}

export function sqlLiteral(value) {
  if (value === null || value === undefined) return 'null';
  return `'${String(value).replaceAll("'", "''")}'`;
}

export function parseMigrationFileName(fileName) {
  const match = MIGRATION_NAME_PATTERN.exec(fileName);
  if (!match) fail(`Unsupported migration file name: ${fileName}`);
  return { version: match[1], name: match[2], fileName };
}

// Production is reachable only through a manifest that declares itself production
// AND the confirm variable naming that same project (ownership transfer D9). A
// development manifest can never be pointed at production by changing env vars,
// and a production manifest can never be applied without the confirm token.
export function assertEnvironmentMatchesTarget({ projectRef, manifest, env }) {
  const declared = manifest?.environment ?? 'development';
  const isProductionTarget = projectRef === PRODUCTION_PROJECT_REF;
  if (declared !== 'production') {
    if (isProductionTarget) {
      fail(
        `Refusing to target the production project ${projectRef} with a ${declared} manifest. `
        + 'Production apply requires the production manifest and its own approval.'
      );
    }
    if (env.SUPABASE_PRODUCTION_CONFIRM) {
      fail('SUPABASE_PRODUCTION_CONFIRM must not be set for a development manifest.');
    }
    return { target: 'development' };
  }
  if (!isProductionTarget) {
    fail(
      `The production manifest may only target ${PRODUCTION_PROJECT_REF}, got ${projectRef}.`
    );
  }
  // The confirm token is checked in assertWriteEnvironment, not here: --status and
  // --dry-run must stay usable without it. Requiring it for read-only work would
  // train operators to keep it exported, which is exactly how a write gate rots.
  return { target: 'production' };
}

// A migration whose version is below an already-recorded one must not be applied
// after it: the learner history is replayed in timestamp order, so filling a gap
// late produces a tracker whose order no clean replay can reproduce. Pending
// lower-version work has to be applied first — or explicitly reclassified.
export function assertNoOrderInversion({ batchName, files, recordedVersions, pendingVersions }) {
  const recorded = [...recordedVersions].sort();
  const highestRecorded = recorded.at(-1);
  if (!highestRecorded) return { checked: true, highestRecorded: null };
  for (const file of files) {
    const earlierPending = [...pendingVersions]
      .filter((version) => version < file.version && version !== file.version)
      .sort();
    if (earlierPending.length > 0 && file.version > highestRecorded) {
      fail(
        `Batch ${batchName} would apply ${file.fileName} while lower unapplied version(s) remain `
        + `pending in this manifest: ${earlierPending.join(', ')}. Apply those first so the tracker `
        + 'stays replayable in timestamp order.'
      );
    }
  }
  return { checked: true, highestRecorded };
}

export function assertQualifiedTracker(trackerTable) {
  const parts = String(trackerTable ?? '').split('.');
  if (parts.length !== 2 || !parts.every((part) => PLAIN_IDENTIFIER.test(part))) {
    fail(`trackerTable must be schema.table with plain identifiers: ${trackerTable}`);
  }
  return parts.join('.');
}

function stripSqlComments(sql) {
  return sql.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--[^\n]*/g, ' ');
}

export function assertTransactionSafe(fileName, sql) {
  const scannable = stripSqlComments(sql);
  for (const [label, pattern] of TRANSACTION_HOSTILE) {
    if (pattern.test(scannable)) {
      fail(`${fileName} contains a statement that cannot run in a transaction: ${label}`);
    }
  }
  const leftover = scannable
    .split(/\r?\n/)
    .map((line) => line.trim().toLowerCase())
    .filter((line) => line === 'begin;' || line === 'commit;' || line === 'rollback;');
  if (leftover.length > 0) {
    fail(
      `${fileName} still contains transaction control after stripping: ${leftover.join(', ')}`
    );
  }
}

export function readManifest(manifestPath) {
  const absolute = resolve(manifestPath);
  if (!existsSync(absolute)) fail(`Manifest not found: ${absolute}`);
  const manifest = JSON.parse(readFileSync(absolute, 'utf8'));
  for (const field of ['projectRef', 'trackerTable', 'sourceMigrationsDir', 'sequence', 'batches']) {
    if (manifest[field] === undefined || manifest[field] === null) {
      fail(`Manifest is missing ${field}: ${absolute}`);
    }
  }
  if (!Array.isArray(manifest.sequence) || manifest.sequence.length === 0) {
    fail('Manifest sequence must be a non-empty array.');
  }
  for (const batchName of manifest.sequence) {
    if (!manifest.batches[batchName]) fail(`Manifest sequence names an unknown batch: ${batchName}`);
  }
  assertQualifiedTracker(manifest.trackerTable);
  return { manifest, manifestPath: absolute };
}

export function normalizeBlocked(manifest) {
  const blocked = new Map();
  for (const entry of manifest.blockedMigrations ?? []) {
    const name = typeof entry === 'string' ? entry : entry.name;
    const reason = typeof entry === 'string' ? 'blocked by manifest' : entry.reason;
    if (!name) fail('blockedMigrations entry is missing a name.');
    parseMigrationFileName(name);
    blocked.set(name, reason ?? 'blocked by manifest');
  }
  return blocked;
}

export function resolveBatch(manifest, batchName) {
  const batch = manifest.batches[batchName];
  if (!batch) fail(`Unknown batch: ${batchName}`);
  if (!Array.isArray(batch.migrations) || batch.migrations.length === 0) {
    fail(`Batch ${batchName} has no migrations.`);
  }
  const blocked = normalizeBlocked(manifest);
  const files = batch.migrations.map((fileName) => {
    if (blocked.has(fileName)) {
      fail(`Blocked migration cannot be selected: ${fileName} — ${blocked.get(fileName)}`);
    }
    return parseMigrationFileName(fileName);
  });
  const seen = new Set();
  for (const file of files) {
    if (seen.has(file.version)) fail(`Duplicate version in batch ${batchName}: ${file.version}`);
    seen.add(file.version);
  }
  const sorted = [...files].sort((left, right) => left.version.localeCompare(right.version));
  if (sorted.some((file, index) => file.version !== files[index].version)) {
    fail(`Batch ${batchName} migrations must be listed in ascending version order.`);
  }
  return { batchName, batch, files };
}

export function buildProbeSql(entries) {
  if (!Array.isArray(entries) || entries.length === 0) return null;
  const columns = entries.map((entry, index) => {
    if (!PROBE_KINDS.has(entry.kind)) fail(`Unsupported probe kind: ${entry.kind}`);
    const identity = String(entry.identity ?? '');
    const alias = `p${index}`;
    if (entry.kind === 'function') {
      if (!/^[a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*\(.*\)$/.test(identity)) {
        fail(`Function probe identity must be schema.name(args): ${identity}`);
      }
      return `to_regprocedure(${sqlLiteral(identity)}) is not null as ${alias}`;
    }
    if (entry.kind === 'table') {
      if (!/^[a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*$/.test(identity)) {
        fail(`Table probe identity must be schema.table: ${identity}`);
      }
      return `to_regclass(${sqlLiteral(identity)}) is not null as ${alias}`;
    }
    const parts = identity.split('.');
    if (parts.length !== 3 || !parts.every((part) => PLAIN_IDENTIFIER.test(part))) {
      fail(`${entry.kind} probe identity must be schema.table.${entry.kind}: ${identity}`);
    }
    const [schema, table, leaf] = parts;
    if (entry.kind === 'policy') {
      // RLS 정책은 이 러너가 다루는 learner 마이그레이션의 실제 변경 대상이다(정책 신설·교체·제거).
      // 정책 프로브 없이는 그 배치의 expectPresentAfter/expectAbsent 를 쓸 수 없다.
      return `exists (select 1 from pg_policies p`
        + ` where p.schemaname = ${sqlLiteral(schema)}`
        + ` and p.tablename = ${sqlLiteral(table)}`
        + ` and p.policyname = ${sqlLiteral(leaf)}) as ${alias}`;
    }
    if (entry.kind === 'column') {
      return `exists (select 1 from information_schema.columns c`
        + ` where c.table_schema = ${sqlLiteral(schema)}`
        + ` and c.table_name = ${sqlLiteral(table)}`
        + ` and c.column_name = ${sqlLiteral(leaf)}) as ${alias}`;
    }
    return `exists (select 1 from pg_trigger t`
      + ` join pg_class rel on rel.oid = t.tgrelid`
      + ` join pg_namespace ns on ns.oid = rel.relnamespace`
      + ` where ns.nspname = ${sqlLiteral(schema)}`
      + ` and rel.relname = ${sqlLiteral(table)}`
      + ` and t.tgname = ${sqlLiteral(leaf)}`
      + ` and not t.tgisinternal) as ${alias}`;
  });
  return {
    sql: `select ${columns.join(',\n       ')};`,
    keys: entries.map((entry, index) => ({ alias: `p${index}`, ...entry })),
  };
}

export function buildTrackerInsert({ trackerTable, file, statement }) {
  return [
    `insert into ${trackerTable} (version, name, statements)`,
    `values (${sqlLiteral(file.version)}, ${sqlLiteral(file.name)}, array[${sqlLiteral(statement)}])`,
    'on conflict (version) do update',
    '  set name = excluded.name,',
    // 20260527113000 already has a row with empty statements. `do nothing` would
    // leave that false record in place, so the provenance marker must overwrite.
    '      statements = excluded.statements;',
  ].join('\n');
}

export function buildBatchSql({
  trackerTable,
  batchName,
  files,
  sourceGitSha,
  operator,
  appliedAt,
  bodySource = 'archive',
  lockTimeout = '5s',
  statementTimeout = '180s',
}) {
  const tracker = assertQualifiedTracker(trackerTable);
  if (!FULL_SHA_PATTERN.test(String(sourceGitSha ?? ''))) {
    fail(`sourceGitSha must be a full 40-character commit sha: ${sourceGitSha}`);
  }
  const lines = [
    'begin;',
    `set local lock_timeout = ${sqlLiteral(lockTimeout)};`,
    `set local statement_timeout = ${sqlLiteral(statementTimeout)};`,
    `select pg_advisory_xact_lock(hashtextextended(${sqlLiteral(`topik-ai:${tracker}`)}, 0));`,
    '',
  ];
  for (const file of files) {
    const statement = [
      `applied via topik-ai scripts/db/apply-v13-migration.mjs ${appliedAt};`,
      `batch=${batchName};`,
      `file_sha256=${file.checksum};`,
      `v13_git_sha=${sourceGitSha};`,
      `body_source=${bodySource};`,
      `operator=${operator}`,
    ].join(' ');
    lines.push(`-- ${file.fileName} (sha256 ${file.checksum})`);
    lines.push(file.body);
    lines.push('');
    lines.push(buildTrackerInsert({ trackerTable: tracker, file, statement }));
    lines.push('');
  }
  lines.push('commit;');
  return lines.join('\n');
}

export function readMigrationFromGit({ v13Root, sourceGitSha, migrationsDir, fileName }) {
  const target = `${sourceGitSha}:${migrationsDir}/${fileName}`;
  let raw;
  try {
    raw = execFileSync('git', ['-C', v13Root, 'show', target], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (error) {
    fail(`Cannot read ${target} from ${v13Root}: ${error.message.split('\n')[0]}`);
  }
  return raw.replace(/^﻿/, '').replace(/\r\n/g, '\n');
}

// The learner history is vendored in this repo (ownership transfer M2), so the
// default body source is the archive rather than another repository's git store.
// The archive manifest's per-file sha256 is re-checked here: the archive verifier
// is a separate gate, and an apply must never trust bytes it did not hash itself.
export function readMigrationFromArchive({ archiveDir, manifest, fileName }) {
  const entry = (manifest.files ?? []).find((file) => file.name === fileName);
  if (!entry) fail(`${fileName} is not listed in the learner archive manifest.`);
  if (entry.disposition === 'blocked' || entry.disposition === 'deferred') {
    fail(`${fileName} is ${entry.disposition} in the archive and must not be applied: ${entry.reason}`);
  }
  if (entry.replayOnly) {
    fail(
      `${fileName} is replay-only in the archive because ${entry.adoptedAs} owns its apply and `
      + 'tracker record. Applying it here would record one migration in two trackers.'
    );
  }
  const path = resolve(archiveDir, fileName);
  if (!existsSync(path)) fail(`${fileName} is missing from the archive at ${archiveDir}.`);
  const bytes = readFileSync(path);
  const actual = sha256(bytes);
  if (actual !== entry.sha256) {
    fail(`${fileName} sha256 drift: manifest ${entry.sha256}, archive ${actual}.`);
  }
  return bytes.toString('utf8').replace(/^﻿/, '').replace(/\r\n/g, '\n');
}

function getArgValue(args, flag) {
  const index = args.indexOf(flag);
  if (index < 0) return null;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) fail(`${flag} requires a value.`);
  return value;
}

export function resolveAction(args) {
  const actions = ['--status', '--dry-run', '--write'].filter((flag) => args.includes(flag));
  if (actions.length > 1) fail(`Choose exactly one action, got: ${actions.join(' ')}`);
  return (actions[0] ?? '--status').replace('--', '');
}

export function assertWriteEnvironment(env, { target = 'development', batchName = null } = {}) {
  const projectRef = env.SUPABASE_PROJECT_REF;
  if (env.SUPABASE_EXPECTED_PROJECT_REF !== projectRef) {
    fail('Writes require SUPABASE_EXPECTED_PROJECT_REF to match SUPABASE_PROJECT_REF.');
  }
  if (env.SUPABASE_SQL_MAX_ATTEMPTS !== '1') {
    fail(
      'Writes require SUPABASE_SQL_MAX_ATTEMPTS=1. Retrying a committed batch would '
      + 're-run non-idempotent DDL and report a successful apply as a failure.'
    );
  }
  if (target === 'production') {
    if (env.SUPABASE_PRODUCTION_CONFIRM !== PRODUCTION_PROJECT_REF) {
      fail(
        `Production writes require SUPABASE_PRODUCTION_CONFIRM=${PRODUCTION_PROJECT_REF}. `
        + 'This is a deliberate second key, not a formality.'
      );
    }
    // Approval must name the batch actually being applied, so one approval cannot
    // walk the whole sequence (ownership transfer D9: per-batch approval).
    //
    // This is compared against the CLI's --batch value, never against a second env
    // var. An earlier revision compared two env vars, and with both unset the
    // comparison `undefined !== undefined` was false — the guard passed and a
    // production batch was applied unapproved. Absent approval must never read as
    // matching approval.
    const approved = env.SUPABASE_PRODUCTION_APPROVED_BATCH;
    if (typeof approved !== 'string' || approved.trim().length === 0) {
      fail(
        'Production writes require SUPABASE_PRODUCTION_APPROVED_BATCH to name the batch being '
        + 'applied. Approval is per batch and must be set explicitly.'
      );
    }
    if (typeof batchName !== 'string' || batchName.trim().length === 0) {
      fail('Production writes require a resolved --batch name to check approval against.');
    }
    if (approved.trim() !== batchName.trim()) {
      fail(
        `SUPABASE_PRODUCTION_APPROVED_BATCH=${approved} does not match the batch being applied `
        + `(${batchName}). Approval is per batch.`
      );
    }
    return;
  }
  if (env.SUPABASE_PRODUCTION_CONFIRM) {
    fail('SUPABASE_PRODUCTION_CONFIRM must not be set for this runner.');
  }
}

function formatProbeRow(probe, row) {
  return probe.keys.map((key) => ({
    kind: key.kind,
    identity: key.identity,
    present: row?.[key.alias] === true,
  }));
}

async function probe({ entries, projectRef, token, label }) {
  const built = buildProbeSql(entries);
  if (!built) return [];
  const rows = await runSql({ projectRef, token, sql: built.sql });
  const results = formatProbeRow(built, Array.isArray(rows) ? rows[0] : rows);
  for (const result of results) {
    console.log(`  ${label} ${result.present ? 'present' : 'absent '}  ${result.kind} ${result.identity}`);
  }
  return results;
}

function usage() {
  console.log(`Usage:
  node scripts/db/apply-v13-migration.mjs --manifest <path> \\
    [--batch <name>] [--status | --dry-run | --write] [--operator <name>] [--env-file <path>] \\
    [--source archive|git] [--v13-root <path> --v13-sha <sha40>]

  --status    (default) read-only: tracker state for the whole sequence
  --dry-run   print the generated SQL for one batch, no network
  --write     apply one batch. Requires SUPABASE_EXPECTED_PROJECT_REF and
              SUPABASE_SQL_MAX_ATTEMPTS=1.
  --source    archive (default) reads bodies from supabase/migrations-v13 and
              re-hashes them against scripts/db/manifests/v13-archive.json;
              blocked, deferred and replay-only files are refused. git reads from
              a v13 checkout's object store and needs --v13-root/--v13-sha.

Environment: SUPABASE_PROJECT_REF, SUPABASE_ACCESS_TOKEN.
  --env-file defaults to ./.env.local; point it at another worktree's file
  rather than copying the token into this one.`);
}

export async function main(argv = process.argv.slice(2)) {
  if (argv.includes('--help') || argv.includes('-h')) {
    usage();
    return 0;
  }
  // Worktrees carry their own .env.local, so an operator running from a fresh
  // worktree would otherwise have to copy the token in. --env-file points at an
  // existing file instead of duplicating secrets across the filesystem.
  loadLocalEnv(resolve(getArgValue(argv, '--env-file') ?? '.env.local'));

  const action = resolveAction(argv);
  const { manifest, manifestPath } = readManifest(
    getArgValue(argv, '--manifest') ?? 'scripts/db/manifests/v13-shared-dev.json'
  );
  const projectRef = process.env.SUPABASE_PROJECT_REF;
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!projectRef || !token) fail('SUPABASE_PROJECT_REF and SUPABASE_ACCESS_TOKEN are required.');
  const { target } = assertEnvironmentMatchesTarget({
    projectRef,
    manifest,
    env: process.env,
  });
  assertManifestProjectRef(manifest.projectRef, projectRef);

  const trackerTable = assertQualifiedTracker(manifest.trackerTable);
  // Default source is the in-repo learner archive; `--source git` keeps the
  // original path for as long as a v13 checkout is still the reference.
  const bodySource = getArgValue(argv, '--source') ?? 'archive';
  if (bodySource !== 'archive' && bodySource !== 'git') {
    fail(`--source must be archive or git, got: ${bodySource}`);
  }
  const archiveDir = resolve(getArgValue(argv, '--archive-dir') ?? 'supabase/migrations-v13');
  const archiveManifestPath = resolve(
    getArgValue(argv, '--archive-manifest') ?? 'scripts/db/manifests/v13-archive.json'
  );
  const archiveManifest = bodySource === 'archive'
    ? JSON.parse(readFileSync(archiveManifestPath, 'utf8'))
    : null;
  const v13Root = resolve(getArgValue(argv, '--v13-root') ?? '../topik-project/v13');
  const sourceGitSha = getArgValue(argv, '--v13-sha') ?? archiveManifest?.sourceGitSha ?? null;
  if (!sourceGitSha || !FULL_SHA_PATTERN.test(sourceGitSha)) {
    fail('--v13-sha requires a full 40-character commit sha.');
  }
  if (archiveManifest && archiveManifest.sourceGitSha !== sourceGitSha) {
    fail(
      `Archive was adopted from ${archiveManifest.sourceGitSha} but ${sourceGitSha} was requested. `
      + 'Re-import the archive or pass --source git.'
    );
  }
  if (manifest.sourceGitSha && manifest.sourceGitSha !== sourceGitSha) {
    fail(`Manifest pins sourceGitSha ${manifest.sourceGitSha}, got ${sourceGitSha}.`);
  }

  console.log(`manifest=${manifestPath}`);
  console.log(`target=${projectRef} (${target}) tracker=${trackerTable}`);
  console.log(
    bodySource === 'archive'
      ? `bodies=archive ${archiveDir} (adopted from v13 ${sourceGitSha})`
      : `bodies=git ${v13Root}@${sourceGitSha}`
  );

  if (action === 'status') {
    const versions = manifest.sequence
      .flatMap((batchName) => resolveBatch(manifest, batchName).files.map((file) => file.version));
    const blocked = normalizeBlocked(manifest);
    const blockedVersions = [...blocked.keys()].map((name) => parseMigrationFileName(name).version);
    const rows = await runSql({
      projectRef,
      token,
      sql: `select version, name,
       case when statements is null then 'null'
            when array_length(statements, 1) is null then 'empty'
            else 'len' || array_length(statements, 1) end as statements_state
  from ${trackerTable}
 where version in (${[...versions, ...blockedVersions].map(sqlLiteral).join(', ')})
 order by version;`,
    });
    const recorded = new Map((Array.isArray(rows) ? rows : []).map((row) => [row.version, row]));
    console.log('\nsequence:');
    for (const batchName of manifest.sequence) {
      const { files } = resolveBatch(manifest, batchName);
      for (const file of files) {
        const row = recorded.get(file.version);
        const state = row ? `recorded (${row.statements_state})` : 'pending';
        console.log(`  ${batchName}  ${state.padEnd(18)}  ${file.fileName}`);
      }
    }
    // Whether a blocked file is recorded is environment-specific. Development
    // never ran them, so a record there is a false stamp. Production applied them
    // in order before the writing cutover, so the record is true history and only
    // re-application is forbidden. `expectRecorded` says which case this is.
    const expectRecorded = new Map(
      (manifest.blockedMigrations ?? [])
        .filter((entry) => typeof entry === 'object')
        .map((entry) => [entry.name, entry.expectRecorded === true])
    );
    console.log('\nblocked (never re-apply):');
    for (const [name, reason] of blocked) {
      const version = parseMigrationFileName(name).version;
      const row = recorded.get(version);
      const shouldBeRecorded = expectRecorded.get(name) === true;
      let state;
      if (shouldBeRecorded) {
        state = row ? 'recorded history ok  ' : 'MISSING — investigate';
      } else {
        state = row ? 'RECORDED — investigate' : 'unrecorded ok        ';
      }
      console.log(`  ${state}  ${name}`);
      if ((shouldBeRecorded && !row) || (!shouldBeRecorded && row)) {
        console.log(`      reason it is blocked: ${reason}`);
      }
    }
    for (const entry of manifest.deferredMigrations ?? []) {
      console.log(`\ndeferred: ${entry.name}\n      ${entry.reason}`);
    }
    return 0;
  }

  const batchName = getArgValue(argv, '--batch');
  if (!batchName) fail('--batch is required for --dry-run and --write.');
  const { batch, files } = resolveBatch(manifest, batchName);

  for (const file of files) {
    const raw = bodySource === 'archive'
      ? readMigrationFromArchive({
        archiveDir,
        manifest: archiveManifest,
        fileName: file.fileName,
      })
      : readMigrationFromGit({
        v13Root,
        sourceGitSha,
        migrationsDir: manifest.sourceMigrationsDir,
        fileName: file.fileName,
      });
    file.checksum = sha256(raw);
    file.body = stripOuterTransaction(raw);
    assertTransactionSafe(file.fileName, file.body);
  }

  const operator = getArgValue(argv, '--operator')
    ?? process.env.SUPABASE_MIGRATION_OPERATOR
    ?? 'unknown';
  const appliedAt = new Date().toISOString();
  const sql = buildBatchSql({
    trackerTable,
    batchName,
    files,
    sourceGitSha,
    operator,
    appliedAt,
    bodySource,
  });

  console.log(`\nbatch=${batchName}`);
  if (batch.reason) console.log(`reason: ${batch.reason}`);
  if (batch.requires) console.log(`requires: ${batch.requires.join(', ')}`);
  if (batch.nonIdempotent) console.log(`NON-IDEMPOTENT: ${batch.nonIdempotent}`);
  for (const file of files) console.log(`  ${file.fileName}  sha256=${file.checksum}`);

  if (action === 'dry-run') {
    console.log(`\n-- generated SQL (${sql.split('\n').length} lines) --\n`);
    console.log(sql);
    return 0;
  }

  assertWriteEnvironment(process.env, { target, batchName });

  // Order-inversion guard: read the tracker for every version this manifest
  // manages, then refuse a batch that jumps ahead of still-pending lower versions.
  const managedVersions = manifest.sequence
    .flatMap((name) => resolveBatch(manifest, name).files.map((file) => file.version));
  const recordedRows = await runSql({
    projectRef,
    token,
    sql: `select version from ${trackerTable}`
      + ` where version in (${managedVersions.map(sqlLiteral).join(', ')}) order by version;`,
  });
  const recordedVersions = new Set(
    (Array.isArray(recordedRows) ? recordedRows : []).map((row) => row.version)
  );
  assertNoOrderInversion({
    batchName,
    files,
    recordedVersions,
    pendingVersions: managedVersions.filter((version) => !recordedVersions.has(version)),
  });

  if (batch.expectPresent?.length || batch.expectAbsent?.length) {
    console.log('\npreflight:');
    const present = await probe({ entries: batch.expectPresent, projectRef, token, label: 'expect-present' });
    const absent = await probe({ entries: batch.expectAbsent, projectRef, token, label: 'expect-absent ' });
    const missing = present.filter((result) => !result.present);
    if (missing.length > 0) {
      fail(`Preflight failed: expected present but missing — ${missing.map((r) => r.identity).join(', ')}`);
    }
    const unexpected = absent.filter((result) => result.present);
    if (unexpected.length > 0) {
      console.log(
        `  note: ${unexpected.map((r) => r.identity).join(', ')} already present; `
        + 'this batch is expected to remove them.'
      );
    }
  }

  console.log('\napplying...');
  await runSql({ projectRef, token, sql });
  console.log('applied.');

  const after = [...(batch.expectPresentAfter ?? []), ...(batch.expectPresent ?? [])]
    .filter((entry) => entry.kind !== 'function' || !batch.expectAbsent?.some((e) => e.identity === entry.identity));
  if (after.length > 0) {
    console.log('\npostcondition:');
    const results = await probe({ entries: after, projectRef, token, label: 'after' });
    const missing = results.filter((result) => !result.present);
    if (missing.length > 0) {
      fail(`Postcondition failed: ${missing.map((r) => r.identity).join(', ')} not present after apply.`);
    }
  }
  if (batch.expectAbsent?.length) {
    console.log('\npostcondition (must be gone):');
    const results = await probe({ entries: batch.expectAbsent, projectRef, token, label: 'after' });
    const lingering = results.filter((result) => result.present);
    if (lingering.length > 0) {
      fail(`Postcondition failed: ${lingering.map((r) => r.identity).join(', ')} still present.`);
    }
  }
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  // Set exitCode instead of calling process.exit(): forcing exit while undici is
  // still closing its handles trips a libuv assertion on Windows and can cut off
  // buffered output, which would make a successful apply look like a crash.
  main().then(
    (code) => {
      process.exitCode = code ?? 0;
    },
    (error) => {
      console.error(error.message);
      process.exitCode = 1;
    }
  );
}
