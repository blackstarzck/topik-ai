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

function collectFunctionNames(sql, pattern) {
  const names = [];
  for (const match of stripSqlComments(sql).matchAll(pattern)) {
    names.push(match[1].toLowerCase());
  }
  return names;
}

function findPlainZeroArgumentFunctionCreates(sql) {
  return collectFunctionNames(
    sql,
    /\bcreate\s+function\s+([a-z_][a-z0-9_$]*(?:\.[a-z_][a-z0-9_$]*)?)\s*\(\s*\)/gi
  );
}

function isSafeIntraReleaseFunctionReplacement(sql, introducedFunctions) {
  const normalized = stripSqlComments(sql);
  const dropOperationCount = normalized.match(/\bdrop\s+(?:function|procedure)\b/gi)?.length ?? 0;
  if (dropOperationCount === 0) return false;

  const droppedFunctions = collectFunctionNames(
    sql,
    /\bdrop\s+function\s+(?:if\s+exists\s+)?([a-z_][a-z0-9_$]*(?:\.[a-z_][a-z0-9_$]*)?)\s*\(\s*\)\s*(?:cascade|restrict)?\s*;/gi
  );
  if (droppedFunctions.length !== dropOperationCount) return false;

  const recreatedFunctions = new Set(collectFunctionNames(
    sql,
    /\bcreate\s+(?:or\s+replace\s+)?function\s+([a-z_][a-z0-9_$]*(?:\.[a-z_][a-z0-9_$]*)?)\s*\(\s*\)/gi
  ));
  return droppedFunctions.every((functionName) => (
    introducedFunctions.has(functionName) && recreatedFunctions.has(functionName)
  ));
}

export function findContractOperations(sql) {
  const normalized = stripSqlComments(sql);
  return CONTRACT_PATTERNS
    .filter(([, pattern]) => pattern.test(normalized))
    .map(([name]) => name);
}

export function classifyMigrationDiff(entries, readMigration) {
  const issues = [];
  const introducedFunctions = new Set();
  const orderedEntries = [...entries].sort((left, right) => left.path.localeCompare(right.path));
  for (const entry of orderedEntries) {
    const forward = FORWARD_MIGRATION.test(entry.path);
    const down = DOWN_MIGRATION.test(entry.path);
    if (!forward && !down) continue;
    if (entry.status !== 'A') {
      issues.push(`${entry.path}: applied migrations are immutable (${entry.status})`);
      continue;
    }
    if (!forward) continue;
    const sql = readMigration(entry.path);
    const safeFunctionReplacement = isSafeIntraReleaseFunctionReplacement(
      sql,
      introducedFunctions
    );
    for (const operation of findContractOperations(sql)) {
      if (operation === 'drop-function' && safeFunctionReplacement) continue;
      issues.push(`${entry.path}: contract operation detected (${operation})`);
    }
    for (const functionName of findPlainZeroArgumentFunctionCreates(sql)) {
      introducedFunctions.add(functionName);
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
