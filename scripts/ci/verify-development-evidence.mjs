#!/usr/bin/env node

import { appendFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  expectedDevelopmentChecks,
  releaseFlags,
} from './write-development-evidence.mjs';

function value(args, flag, { required = true } = {}) {
  const index = args.indexOf(flag);
  if (index < 0 || !args[index + 1]) {
    if (!required) return null;
    throw new Error(`${flag} is required.`);
  }
  return args[index + 1];
}

export function verifyDevelopmentEvidence(report, expected) {
  const issues = [];
  if (report.schemaVersion !== 3) issues.push('unsupported-schema-version');
  if (report.stage !== 'development') issues.push('wrong-stage');
  if (report.passed !== true) issues.push('development-validation-failed');
  for (const [name, expectedValue] of Object.entries(expected)) {
    if (report[name] !== expectedValue) issues.push(`mismatch:${name}`);
  }
  let flags = null;
  try {
    flags = releaseFlags(report.releasePlan);
  } catch {
    issues.push('invalid-release-plan');
  }
  if (flags) {
    if (report.deployApp !== flags.deployApp) issues.push('invalid-deploy-app');
    if (report.applyMigrations !== flags.applyMigrations) issues.push('invalid-apply-migrations');
  }
  if (!['light', 'app', 'full'].includes(report.validationProfile)) {
    issues.push('invalid-validation-profile');
  }
  if (!Number.isInteger(report.classifierVersion) || report.classifierVersion < 1) {
    issues.push('invalid-classifier-version');
  }
  if (!/^[a-f0-9]{64}$/.test(report.changedFilesDigest ?? '')) {
    issues.push('invalid-changed-files-digest');
  }
  if (JSON.stringify(report.migrationOrder) !== JSON.stringify(['topik_writing', 'admin'])) {
    issues.push('invalid-migration-order');
  }
  if (flags && ['light', 'app', 'full'].includes(report.validationProfile)) {
    const expectedChecks = expectedDevelopmentChecks(
      report.releasePlan,
      report.validationProfile
    );
    for (const [name, expectedStatus] of Object.entries(expectedChecks)) {
      if (report.checks?.[name] !== expectedStatus) issues.push(`invalid-check:${name}`);
    }
    for (const name of Object.keys(report.checks ?? {})) {
      if (!(name in expectedChecks)) issues.push(`unknown-check:${name}`);
    }
  }
  return issues;
}

async function main() {
  const args = process.argv.slice(2);
  const report = JSON.parse(readFileSync(resolve(value(args, '--input')), 'utf8'));
  const expected = {
    commitSha: value(args, '--commit-sha'),
    v13CommitSha: value(args, '--v13-sha'),
    projectRef: value(args, '--project-ref'),
  };
  const issues = verifyDevelopmentEvidence(report, expected);
  if (issues.length > 0) {
    for (const issue of issues) console.error(`[development-evidence] ${issue}`);
    process.exit(1);
  }
  const githubOutput = value(args, '--github-output', { required: false });
  if (githubOutput) {
    appendFileSync(
      resolve(githubOutput),
      `release_plan=${report.releasePlan}\n`
      + `deploy_app=${report.deployApp}\n`
      + `apply_migrations=${report.applyMigrations}\n`
      + `validation_profile=${report.validationProfile}\n`
      + `base_sha=${report.baseSha}\n`
      + `classifier_version=${report.classifierVersion}\n`
      + `changed_files_digest=${report.changedFilesDigest}\n`,
      'utf8'
    );
  }
  console.log(`Development evidence accepted for ${report.commitSha} (${report.releasePlan}).`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    await main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
