#!/usr/bin/env node
// Admin-domain migration runner. Writes are manifest-only and require explicit
// target/expected project refs; production also requires a production confirm.

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runMigrate } from './migrate-core.mjs';

try {
  await runMigrate({
    trackTable: 'admin_schema_migrations',
    migrationsDir: join(
      dirname(fileURLToPath(import.meta.url)),
      '..',
      '..',
      'supabase',
      'migrations-admin'
    ),
    args: process.argv.slice(2),
  });
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
