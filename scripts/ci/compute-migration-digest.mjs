#!/usr/bin/env node
// Single digest binding the exact production release migration set. Promotion
// gates recompute this from their own checkout and compare it against the value
// captured in development evidence, so any drift in migration files or release
// manifests between validation and release fails closed.

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  inspectStaticMigrationContract,
  listLocalMigrations,
  sha256,
} from '../db/migrate-core.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

export const PRODUCTION_MIGRATION_CONTRACTS = Object.freeze([
  Object.freeze({
    namespace: 'topik_writing',
    migrationsDir: join(ROOT, 'supabase', 'migrations'),
    manifestPath: join(ROOT, 'scripts', 'db', 'manifests', 'writing-production-cutover.json'),
  }),
  Object.freeze({
    namespace: 'admin',
    migrationsDir: join(ROOT, 'supabase', 'migrations-admin'),
    manifestPath: join(ROOT, 'scripts', 'db', 'manifests', 'admin-production-cutover.json'),
  }),
]);

export function computeMigrationDigest({ contracts = PRODUCTION_MIGRATION_CONTRACTS } = {}) {
  const lines = [];
  for (const contract of contracts) {
    const manifest = JSON.parse(readFileSync(contract.manifestPath, 'utf8'));
    const localMigrations = listLocalMigrations(contract.migrationsDir);
    const staticContract = inspectStaticMigrationContract({
      manifest,
      batchName: 'release-all',
      localMigrations,
      migrationsDir: contract.migrationsDir,
    });
    for (const entry of staticContract.entries) {
      const fileSha = sha256(readFileSync(join(contract.migrationsDir, entry.name)));
      lines.push(`${contract.namespace}\t${entry.name}\t${fileSha}`);
    }
  }
  lines.sort();
  return createHash('sha256').update(lines.join('\n')).digest('hex');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    console.log(computeMigrationDigest());
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
