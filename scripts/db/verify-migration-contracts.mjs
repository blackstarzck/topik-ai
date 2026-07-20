#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  inspectStaticMigrationContract,
  listLocalMigrations,
  sha256,
} from './migrate-core.mjs';

const PROJECT_REFS = {
  development: 'fglggyfvzjdsbyckinqa',
  production: 'eymlabowhfgtxbiqwxqh',
};
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

function getArgValue(args, flag) {
  const index = args.indexOf(flag);
  if (index < 0) return null;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${flag} requires a value.`);
  return value;
}

const contracts = [
  {
    namespace: 'topik_writing',
    environment: 'development',
    migrationsDir: join(ROOT, 'supabase', 'migrations'),
    manifestPath: join(ROOT, 'scripts', 'db', 'manifests', 'writing-development-release.json'),
  },
  {
    namespace: 'admin',
    environment: 'development',
    migrationsDir: join(ROOT, 'supabase', 'migrations-admin'),
    manifestPath: join(ROOT, 'scripts', 'db', 'manifests', 'admin-development-reconciliation.json'),
  },
  {
    namespace: 'topik_writing',
    environment: 'production',
    migrationsDir: join(ROOT, 'supabase', 'migrations'),
    manifestPath: join(ROOT, 'scripts', 'db', 'manifests', 'writing-production-cutover.json'),
  },
  {
    namespace: 'admin',
    environment: 'production',
    migrationsDir: join(ROOT, 'supabase', 'migrations-admin'),
    manifestPath: join(ROOT, 'scripts', 'db', 'manifests', 'admin-production-cutover.json'),
  },
];

function verifyContract(contract) {
  const manifestBytes = readFileSync(contract.manifestPath);
  const manifest = JSON.parse(manifestBytes.toString('utf8'));
  const expectedProjectRef = PROJECT_REFS[contract.environment];
  if (manifest.projectRef !== expectedProjectRef) {
    throw new Error(
      `${contract.environment}/${contract.namespace}: manifest targets ${manifest.projectRef}, `
      + `expected ${expectedProjectRef}.`
    );
  }
  if (manifest.environment !== contract.environment) {
    throw new Error(
      `${contract.environment}/${contract.namespace}: manifest environment mismatch.`
    );
  }
  const localMigrations = listLocalMigrations(contract.migrationsDir);
  const result = inspectStaticMigrationContract({
    manifest,
    batchName: 'release-all',
    localMigrations,
    migrationsDir: contract.migrationsDir,
  });
  if (!result.clean) {
    const details = [
      ...result.manifestMissing.map((name) => `manifest-missing:${name}`),
      ...result.missingDown.map((name) => `down-missing:${name}`),
    ];
    throw new Error(`${contract.namespace}: ${details.join(', ')}`);
  }
  return {
    namespace: contract.namespace,
    environment: contract.environment,
    projectRef: manifest.projectRef,
    manifestSha256: sha256(manifestBytes),
    localMigrationCount: localMigrations.length,
    releaseMigrationCount: result.entries.length,
    blockedMigrationCount: (manifest.blockedMigrations ?? []).length,
  };
}

try {
  const namespaces = contracts.map(verifyContract);
  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    clean: true,
    namespaces,
  };
  const jsonOut = getArgValue(process.argv.slice(2), '--json-out');
  if (jsonOut) {
    const absolutePath = resolve(jsonOut);
    mkdirSync(dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  }
  for (const namespace of namespaces) {
    console.log(
      `${namespace.environment}/${namespace.namespace}: ${namespace.releaseMigrationCount}/`
      + `${namespace.localMigrationCount} release migration(s), `
      + `${namespace.blockedMigrationCount} blocked, contract clean`
    );
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
