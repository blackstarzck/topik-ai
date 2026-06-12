#!/usr/bin/env node
// Apply supabase/migrations-admin/*.sql (admin 운영 네임스페이스 — 알림 등) to the
// shared Supabase project, tracked in admin_schema_migrations. Kept separate from
// the topik_writing_schema_migrations tracker — see
// docs/architecture/shared-supabase-schema-ownership.md.
//
// Usage:
//   node scripts/db/admin-migrate.mjs            # apply pending
//   node scripts/db/admin-migrate.mjs --status   # list applied/pending
//   node scripts/db/admin-migrate.mjs --down <name>  # run down/<name>.sql and untrack

import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runMigrate } from './migrate-core.mjs';

await runMigrate({
  trackTable: 'admin_schema_migrations',
  migrationsDir: join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'supabase', 'migrations-admin'),
  args: process.argv.slice(2),
});
