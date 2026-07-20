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

const args = process.argv.slice(2);
const target = value(args, '--target');
if (!['development', 'candidate', 'production'].includes(target)) {
  throw new Error('--target must be development, candidate, or production.');
}
const jsonOut = resolve(value(args, '--json-out'));
const startedAt = Date.now();
const require = createRequire(import.meta.url);
const playwrightCli = require.resolve('@playwright/test/cli');
const config = target === 'development'
  ? 'playwright.development-admin.config.ts'
  : 'playwright.release-admin.config.ts';
const result = spawnSync(
  process.execPath,
  [playwrightCli, 'test', `--config=${config}`],
  {
    stdio: 'inherit',
  }
);
const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  target,
  passed: result.status === 0,
  durationMs: Date.now() - startedAt,
};
mkdirSync(dirname(jsonOut), { recursive: true });
writeFileSync(jsonOut, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
