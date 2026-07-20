#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function value(args, flag) {
  const index = args.indexOf(flag);
  if (index < 0 || !args[index + 1]) throw new Error(`${flag} is required.`);
  return args[index + 1];
}

const args = process.argv.slice(2);
const report = JSON.parse(readFileSync(resolve(value(args, '--input')), 'utf8'));
const expected = {
  commitSha: value(args, '--commit-sha'),
  v13CommitSha: value(args, '--v13-sha'),
  projectRef: value(args, '--project-ref'),
};
const issues = [];
if (report.schemaVersion !== 1) issues.push('unsupported-schema-version');
if (report.stage !== 'development') issues.push('wrong-stage');
if (report.passed !== true) issues.push('development-validation-failed');
for (const [name, expectedValue] of Object.entries(expected)) {
  if (report[name] !== expectedValue) issues.push(`mismatch:${name}`);
}
for (const name of [
  'trackerVerification',
  'permissionVerification',
  'crudVerification',
  'browserE2e',
]) {
  if (report[name] !== 'passed') issues.push(`not-passed:${name}`);
}
if (issues.length > 0) {
  for (const issue of issues) console.error(`[development-evidence] ${issue}`);
  process.exit(1);
}
console.log(`Development evidence accepted for ${report.commitSha}.`);
