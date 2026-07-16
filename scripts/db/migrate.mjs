#!/usr/bin/env node
// topik_writing-domain migration runner. See migrate-core.mjs for the explicit
// manifest and project-ref write guards shared with the admin runner.

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runMigrate } from './migrate-core.mjs';

try {
  await runMigrate({
    trackTable: 'topik_writing_schema_migrations',
    migrationsDir: join(
      dirname(fileURLToPath(import.meta.url)),
      '..',
      '..',
      'supabase',
      'migrations'
    ),
    args: process.argv.slice(2),
  });
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
