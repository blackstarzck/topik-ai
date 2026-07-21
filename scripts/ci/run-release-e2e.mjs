#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';

function value(args, flag) {
  const index = args.indexOf(flag);
  if (index < 0 || !args[index + 1]) throw new Error(`${flag} is required.`);
  return args[index + 1];
}

function optionalValue(args, flag) {
  const index = args.indexOf(flag);
  if (index < 0) return null;
  if (!args[index + 1]) throw new Error(`${flag} requires a value.`);
  return args[index + 1];
}

const args = process.argv.slice(2);
const target = value(args, '--target');
if (!['development', 'candidate', 'production'].includes(target)) {
  throw new Error('--target must be development, candidate, or production.');
}
const jsonOut = resolve(value(args, '--json-out'));
const suite = optionalValue(args, '--suite')
  ?? (target === 'development' ? 'full' : 'operational-smoke');
if (!['full', 'operational-smoke'].includes(suite)) {
  throw new Error('--suite must be full or operational-smoke.');
}
if (target !== 'development' && suite !== 'operational-smoke') {
  throw new Error('Candidate and production targets only support the operational-smoke suite.');
}
const startedAt = Date.now();
const require = createRequire(import.meta.url);
const playwrightCli = require.resolve('@playwright/test/cli');
const config = target === 'development'
  ? 'playwright.development-admin.config.ts'
  : 'playwright.release-admin.config.ts';
const playwrightArgs = ['test', `--config=${config}`];
if (target === 'development' && suite === 'operational-smoke') {
  playwrightArgs.push('prod-admin-readonly.pw.ts');
}
const result = spawnSync(
  process.execPath,
  [playwrightCli, ...playwrightArgs],
  {
    stdio: 'inherit',
  }
);
const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  target,
  suite,
  passed: result.status === 0,
  durationMs: Date.now() - startedAt,
};
mkdirSync(dirname(jsonOut), { recursive: true });
writeFileSync(jsonOut, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
