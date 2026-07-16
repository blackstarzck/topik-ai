#!/usr/bin/env node
// Read-only SQL helper by default. Mutating SQL requires --write plus the same
// explicit target/expected/production confirmation contract as migrations.

import { readFileSync } from 'node:fs';
import { loadLocalEnv, runSql } from './migrate-core.mjs';

loadLocalEnv();

const args = process.argv.slice(2);
const isWrite = args.includes('--write');
const projectRef = process.env.SUPABASE_PROJECT_REF;
const expectedRef = process.env.SUPABASE_EXPECTED_PROJECT_REF;
const token = process.env.SUPABASE_ACCESS_TOKEN;

if (!projectRef || !token) {
  console.error('SUPABASE_PROJECT_REF and SUPABASE_ACCESS_TOKEN are required.');
  process.exit(1);
}
if (isWrite && (!expectedRef || expectedRef !== projectRef)) {
  console.error('Writes require SUPABASE_EXPECTED_PROJECT_REF matching the target.');
  process.exit(1);
}
if (
  isWrite
  && projectRef === 'eymlabowhfgtxbiqwxqh'
  && process.env.SUPABASE_PRODUCTION_CONFIRM !== projectRef
) {
  console.error('Production writes require SUPABASE_PRODUCTION_CONFIRM.');
  process.exit(1);
}

let sql = null;
for (let index = 0; index < args.length; index += 1) {
  if (args[index] === '--sql') sql = args[index + 1];
  if (args[index] === '--file') sql = readFileSync(args[index + 1], 'utf8');
}
if (!sql) {
  console.error('Provide --sql "<query>" or --file <path>.');
  process.exit(1);
}

const mutationPattern = /\b(insert|update|delete|alter|create|drop|truncate|grant|revoke|comment|vacuum|reindex)\b/i;
if (!isWrite && mutationPattern.test(sql.replace(/--.*$/gm, ''))) {
  console.error('Mutating SQL requires --write.');
  process.exit(1);
}

try {
  const result = await runSql({ projectRef, token, sql });
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
