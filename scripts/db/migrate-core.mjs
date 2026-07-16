import { createHash } from 'node:crypto';
import {
  existsSync,
  readFileSync,
  readdirSync,
} from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';

const PRODUCTION_PROJECT_REF = 'eymlabowhfgtxbiqwxqh';
const IDENTIFIER_PATTERN = /^[a-z_][a-z0-9_]*$/;
const MIGRATION_NAME_PATTERN = /^\d{14}_[a-z0-9_]+\.sql$/;

function fail(message) {
  throw new Error(message);
}

function parseEnvFile(contents) {
  const values = new Map();
  for (const line of contents.split(/\r?\n/)) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (!match || match[1].startsWith('#')) continue;
    values.set(match[1], match[2].replace(/^["']|["']$/g, ''));
  }
  return values;
}

export function loadLocalEnv(filePath = resolve('.env.local')) {
  if (!existsSync(filePath)) return;
  const values = parseEnvFile(readFileSync(filePath, 'utf8'));
  for (const [name, value] of values) {
    if (process.env[name] === undefined) process.env[name] = value;
  }
}

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
  ].filter(([, flag]) => args.includes(flag));

  if (actionFlags.length !== 1) {
    fail(
      'Choose exactly one action: --status, --plan, --apply, '
      + '--baseline-existing, or --down <migration>.'
    );
  }

  const [action] = actionFlags[0];
  return {
    action,
    manifestPath: getArgValue(args, '--manifest'),
    batchName: getArgValue(args, '--batch'),
    downName: action === 'down' ? getArgValue(args, '--down') : null,
    allowDown: args.includes('--allow-down'),
  };
}

function requireIdentifier(value, label) {
  if (!IDENTIFIER_PATTERN.test(value)) fail(`Invalid ${label}: ${value}`);
  return value;
}

function requireMigrationName(value) {
  if (!MIGRATION_NAME_PATTERN.test(value)) fail(`Invalid migration name: ${value}`);
  return value;
}

function sha256(contents) {
  return createHash('sha256').update(contents).digest('hex');
}

function sqlLiteral(value) {
  if (value === null || value === undefined) return 'null';
  return `'${String(value).replaceAll("'", "''")}'`;
}

export function stripOuterTransaction(sql) {
  const lines = sql.replace(/^\uFEFF/, '').split(/\r?\n/);
  const transactionLines = lines
    .map((line, index) => ({ index, value: line.trim().toLowerCase() }))
    .filter(({ value }) => value === 'begin;' || value === 'commit;');

  if (transactionLines.length === 0) return lines.join('\n').trim();
  if (
    transactionLines.length !== 2
    || transactionLines[0].value !== 'begin;'
    || transactionLines[1].value !== 'commit;'
  ) {
    fail('Migration contains unsupported transaction control.');
  }

  lines.splice(transactionLines[1].index, 1);
  lines.splice(transactionLines[0].index, 1);
  return lines.join('\n').trim();
}

function listLocalMigrations(migrationsDir) {
  if (!existsSync(migrationsDir)) return [];
  return readdirSync(migrationsDir)
    .filter((name) => name.endsWith('.sql') && MIGRATION_NAME_PATTERN.test(name))
    .sort();
}

function readManifest(manifestPath) {
  if (!manifestPath) fail('--manifest is required for this action.');
  const absolutePath = resolve(manifestPath);
  if (!existsSync(absolutePath)) fail(`Manifest not found: ${absolutePath}`);
  const manifest = JSON.parse(readFileSync(absolutePath, 'utf8'));
  if (!manifest.projectRef || !manifest.batches) fail('Manifest is missing projectRef or batches.');
  return { manifest, absolutePath };
}

function resolveManifestFile(manifestPath, relativePath) {
  if (!relativePath) return null;
  return isAbsolute(relativePath)
    ? relativePath
    : resolve(dirname(manifestPath), relativePath);
}

export function resolveManifestBatch({ manifest, batchName, localMigrations }) {
  if (!batchName) fail('--batch is required with a manifest.');
  const batch = manifest.batches[batchName];
  if (!batch) fail(`Unknown manifest batch: ${batchName}`);

  let entries;
  if (Array.isArray(batch.migrations)) {
    entries = batch.migrations.map((entry) => (
      typeof entry === 'string' ? { name: entry, mode: 'apply' } : {
        mode: 'apply',
        ...entry,
      }
    ));
  } else {
    const from = batch.from ?? localMigrations[0];
    const to = batch.to ?? localMigrations.at(-1);
    const excluded = new Set(batch.exclude ?? []);
    entries = localMigrations
      .filter((name) => name >= from && name <= to && !excluded.has(name))
      .map((name) => ({ name, mode: 'apply' }));
  }

  const seen = new Set();
  for (const entry of entries) {
    requireMigrationName(entry.name);
    if (seen.has(entry.name)) fail(`Duplicate migration in batch ${batchName}: ${entry.name}`);
    if (!localMigrations.includes(entry.name)) {
      fail(`Manifest migration is missing locally: ${entry.name}`);
    }
    if (!['apply', 'adopt'].includes(entry.mode)) {
      fail(`Unsupported migration mode for ${entry.name}: ${entry.mode}`);
    }
    seen.add(entry.name);
  }

  return { batch, entries };
}

function validateLocalSet(manifest, localMigrations) {
  if (
    Number.isInteger(manifest.expectedLocalCount)
    && localMigrations.length !== manifest.expectedLocalCount
  ) {
    fail(
      `Local migration count mismatch: expected ${manifest.expectedLocalCount}, `
      + `found ${localMigrations.length}.`
    );
  }

  const blocked = new Set(manifest.blockedMigrations ?? []);
  for (const name of blocked) {
    if (!localMigrations.includes(name)) fail(`Blocked migration is missing locally: ${name}`);
  }
}

function getTarget({ manifest = null, write = false }) {
  const projectRef = process.env.SUPABASE_PROJECT_REF;
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!projectRef) fail('SUPABASE_PROJECT_REF is required; there is no default project.');
  if (!token) fail('SUPABASE_ACCESS_TOKEN is required.');

  if (manifest && manifest.projectRef !== projectRef) {
    fail(`Manifest projectRef ${manifest.projectRef} does not match target ${projectRef}.`);
  }

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

export async function runSql({ projectRef, token, sql }) {
  const url = `https://api.supabase.com/v1/projects/${projectRef}/database/query`;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
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
    if (retryable && attempt < 4) {
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

function migrationRecord({ migrationsDir, entry }) {
  const path = join(migrationsDir, entry.name);
  const contents = readFileSync(path);
  return {
    ...entry,
    path,
    contents,
    checksum: sha256(contents),
  };
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

function validateBlocked(manifest, records) {
  const blocked = new Set(manifest.blockedMigrations ?? []);
  for (const record of records) {
    if (blocked.has(record.name)) fail(`Blocked migration cannot be selected: ${record.name}`);
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
  migrationsDir,
  manifestPath,
  batchName,
  batch,
  records,
  appliedRows,
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

async function rollbackMigration({
  target,
  trackTable,
  migrationsDir,
  migrationName,
}) {
  requireMigrationName(migrationName);
  const downPath = join(migrationsDir, 'down', migrationName);
  if (!existsSync(downPath)) fail(`Down migration not found: ${downPath}`);
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
    await rollbackMigration({
      target,
      trackTable,
      migrationsDir,
      migrationName: options.downName,
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
  });
}
