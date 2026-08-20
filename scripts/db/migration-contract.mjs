import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';

import {
  MIGRATION_NAME_PATTERN,
  fail,
  requireMigrationName,
  sha256
} from './migration-primitives.mjs';

// 매니페스트·정적 마이그 계약 계층 — 분해로 migrate-core.mjs 에서 이동(동작 동일).
// 로컬 파일 목록·매니페스트 배치 해석·정적 계약 점검·검증 리포트 작성/출력과,
// 그 계약이 쓰는 레코드 빌더·차단 검증까지 한 묶음으로 옮겼다(계층 순환 회피).

export function migrationRecord({ migrationsDir, entry }) {
  const path = join(migrationsDir, entry.name);
  const contents = readFileSync(path);
  return {
    ...entry,
    path,
    contents,
    checksum: sha256(contents),
  };
}

export function validateBlocked(manifest, records) {
  const blocked = new Set(manifest.blockedMigrations ?? []);
  for (const record of records) {
    if (blocked.has(record.name)) fail(`Blocked migration cannot be selected: ${record.name}`);
  }
}

export function listLocalMigrations(migrationsDir) {
  if (!existsSync(migrationsDir)) return [];
  return readdirSync(migrationsDir)
    .filter((name) => name.endsWith('.sql') && MIGRATION_NAME_PATTERN.test(name))
    .sort();
}

export function readManifest(manifestPath) {
  if (!manifestPath) fail('--manifest is required for this action.');
  const absolutePath = resolve(manifestPath);
  if (!existsSync(absolutePath)) fail(`Manifest not found: ${absolutePath}`);
  const manifest = JSON.parse(readFileSync(absolutePath, 'utf8'));
  if (!manifest.projectRef || !manifest.batches) fail('Manifest is missing projectRef or batches.');
  return { manifest, absolutePath };
}

export function resolveManifestFile(manifestPath, relativePath) {
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

export function validateLocalSet(manifest, localMigrations) {
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

export function inspectStaticMigrationContract({
  manifest,
  batchName,
  localMigrations,
  migrationsDir,
}) {
  validateLocalSet(manifest, localMigrations);
  const { batch, entries } = resolveManifestBatch({
    manifest,
    batchName,
    localMigrations,
  });
  validateBlocked(manifest, entries);

  const blocked = new Set(manifest.blockedMigrations ?? []);
  const selected = new Set(entries.map((entry) => entry.name));
  const manifestMissing = localMigrations.filter(
    (name) => !blocked.has(name) && !selected.has(name)
  );
  const missingDown = localMigrations.filter(
    (name) => !existsSync(join(migrationsDir, 'down', name))
  );

  return {
    batch,
    entries,
    manifestMissing,
    missingDown,
    clean: manifestMissing.length === 0 && missingDown.length === 0,
  };
}

export function classifyMigrationVerification({
  localRecords,
  selectedEntries,
  blockedMigrations = [],
  approvedRemoteOnly = [],
  appliedRows,
  manifestMissing = [],
  missingDown = [],
}) {
  const applied = new Map(appliedRows.map((row) => [row.name, row]));
  const blocked = new Set(blockedMigrations);
  const selected = new Set(selectedEntries.map((entry) => entry.name));
  const approvedRemote = new Set(approvedRemoteOnly);
  const migrations = [];
  const issues = {
    manifestMissing: [...manifestMissing],
    missingDown: [...missingDown],
    pending: [],
    checksumMissing: [],
    checksumMismatch: [],
    remoteOnly: [],
    blockedApplied: [],
  };

  for (const record of localRecords) {
    const row = applied.get(record.name);
    let state;
    if (blocked.has(record.name)) {
      state = row ? 'blocked-applied' : 'blocked-not-applied';
      if (row) issues.blockedApplied.push(record.name);
    } else if (!selected.has(record.name)) {
      state = 'manifest-missing';
    } else if (!row) {
      state = 'pending';
      issues.pending.push(record.name);
    } else if (!row.checksum_sha256) {
      state = 'checksum-missing';
      issues.checksumMissing.push(record.name);
    } else if (row.checksum_sha256 !== record.checksum) {
      state = 'checksum-mismatch';
      issues.checksumMismatch.push(record.name);
    } else {
      state = 'applied';
    }
    migrations.push({
      name: record.name,
      checksumSha256: record.checksum,
      state,
    });
  }

  const localNames = new Set(localRecords.map((record) => record.name));
  const remoteOnlyApproved = [];
  for (const row of appliedRows) {
    if (localNames.has(row.name)) continue;
    if (approvedRemote.has(row.name)) remoteOnlyApproved.push(row.name);
    else issues.remoteOnly.push(row.name);
  }

  const issueCount = Object.values(issues).reduce(
    (total, values) => total + values.length,
    0
  );
  return {
    clean: issueCount === 0,
    issueCount,
    issues,
    migrations,
    remoteOnlyApproved,
  };
}

export function buildMigrationVerificationReport({
  manifest,
  manifestPath,
  batchName,
  localMigrations,
  migrationsDir,
  appliedRows,
  trackTable,
  projectRef,
}) {
  const staticContract = inspectStaticMigrationContract({
    manifest,
    batchName,
    localMigrations,
    migrationsDir,
  });
  const localRecords = localMigrations.map((name) => migrationRecord({
    migrationsDir,
    entry: { name, mode: 'apply' },
  }));
  const verification = classifyMigrationVerification({
    localRecords,
    selectedEntries: staticContract.entries,
    blockedMigrations: manifest.blockedMigrations,
    approvedRemoteOnly: manifest.approvedRemoteOnly,
    appliedRows,
    manifestMissing: staticContract.manifestMissing,
    missingDown: staticContract.missingDown,
  });

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    commitSha: process.env.GITHUB_SHA ?? process.env.CI_COMMIT_SHA ?? null,
    namespace: manifest.namespace ?? trackTable,
    environment: manifest.environment ?? null,
    projectRef,
    tracker: trackTable,
    batch: batchName,
    manifestSha256: sha256(readFileSync(manifestPath)),
    localMigrationCount: localMigrations.length,
    appliedTrackerCount: appliedRows.length,
    ...verification,
  };
}

export function writeJsonReport(path, report) {
  if (!path) return;
  const absolutePath = resolve(path);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

export function printVerificationReport(report) {
  console.log(`verification namespace=${report.namespace} batch=${report.batch}`);
  console.log(
    `local=${report.localMigrationCount} tracker=${report.appliedTrackerCount} `
    + `issues=${report.issueCount} clean=${report.clean}`
  );
  for (const [name, values] of Object.entries(report.issues)) {
    for (const value of values) console.log(`[${name}] ${value}`);
  }
}
