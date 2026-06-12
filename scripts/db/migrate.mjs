#!/usr/bin/env node
// Apply supabase/migrations/*.sql to the shared v13 Supabase project in filename
// order, tracked in topik_writing_schema_migrations (our namespace). Management
// API is the execution path (no CLI auth / DB password on this machine — see
// docs/architecture/admin-data-source-transition.md §10.4 절차).
//
// Usage:
//   node scripts/db/migrate.mjs            # apply pending
//   node scripts/db/migrate.mjs --status   # list applied/pending
//   node scripts/db/migrate.mjs --down <name>  # run down/<name>.sql and untrack
//
// Auth: SUPABASE_ACCESS_TOKEN env var (sbp_...).

import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runMigrate } from './migrate-core.mjs';

await runMigrate({
  trackTable: 'topik_writing_schema_migrations',
  migrationsDir: join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'supabase', 'migrations'),
  args: process.argv.slice(2),
});
