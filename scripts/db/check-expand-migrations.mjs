#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const FORWARD_MIGRATION = /^supabase\/(migrations|migrations-admin)\/\d{14}_[a-z0-9_]+\.sql$/;
const DOWN_MIGRATION = /^supabase\/(migrations|migrations-admin)\/down\/\d{14}_[a-z0-9_]+\.sql$/;
const CONTRACT_PATTERNS = [
  ['drop-table', /\bdrop\s+table\b/i],
  ['drop-column', /\bdrop\s+column\b/i],
  ['drop-type', /\bdrop\s+type\b/i],
  ['drop-schema', /\bdrop\s+schema\b/i],
  ['drop-function', /\bdrop\s+(?:function|procedure)\b/i],
  ['rename-object', /\balter\s+(?:table|type|function|procedure)\b[\s\S]{0,240}\brename\s+(?:to|column)\b/i],
  ['alter-column-type', /\balter\s+column\b[\s\S]{0,160}\btype\b/i],
  ['set-not-null', /\balter\s+column\b[\s\S]{0,160}\bset\s+not\s+null\b/i],
  ['truncate', /\btruncate\b/i],
];

function stripSqlComments(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--[^\r\n]*/g, ' ');
}

export function findContractOperations(sql) {
  const normalized = stripSqlComments(sql);
  return CONTRACT_PATTERNS
    .filter(([, pattern]) => pattern.test(normalized))
    .map(([name]) => name);
}

export function classifyMigrationDiff(entries, readMigration) {
  const issues = [];
  for (const entry of entries) {
    const forward = FORWARD_MIGRATION.test(entry.path);
    const down = DOWN_MIGRATION.test(entry.path);
    if (!forward && !down) continue;
    if (entry.status !== 'A') {
      issues.push(`${entry.path}: applied migrations are immutable (${entry.status})`);
      continue;
    }
    if (!forward) continue;
    for (const operation of findContractOperations(readMigration(entry.path))) {
      issues.push(`${entry.path}: contract operation detected (${operation})`);
    }
  }
  return issues;
}

function getArgValue(args, flag) {
  const inline = args.find((arg) => arg.startsWith(`${flag}=`));
  if (inline) return inline.slice(flag.length + 1);
  const index = args.indexOf(flag);
  if (index < 0) return null;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${flag} requires a value.`);
  return value;
}

function parseNameStatus(output) {
  return output
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const [rawStatus, ...paths] = line.split('\t');
      return {
        status: rawStatus[0],
        path: paths.at(-1)?.replaceAll('\\', '/') ?? '',
      };
    });
}

function main() {
  const args = process.argv.slice(2);
  const base = getArgValue(args, '--base');
  const head = getArgValue(args, '--head') ?? 'HEAD';
  if (!base) throw new Error('--base is required.');
  const output = execFileSync(
    'git',
    ['diff', '--name-status', '--find-renames', `${base}...${head}`],
    { encoding: 'utf8' }
  );
  const entries = parseNameStatus(output);
  const issues = classifyMigrationDiff(
    entries,
    (path) => readFileSync(resolve(path), 'utf8')
  );
  if (issues.length > 0) {
    throw new Error(`Only additive expand migrations may auto-release:\n${issues.join('\n')}`);
  }
  const added = entries.filter((entry) => (
    entry.status === 'A' && FORWARD_MIGRATION.test(entry.path)
  )).length;
  console.log(`Expand migration gate passed (${added} new migration(s)).`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
