#!/usr/bin/env node

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const RELEASE_PLANS = new Set(['sync-only', 'app-only', 'db-only', 'app-db']);
const VALIDATION_PROFILES = new Set(['light', 'app', 'full']);

function value(args, flag) {
  const index = args.indexOf(flag);
  if (index < 0 || !args[index + 1]) throw new Error(`${flag} is required.`);
  return args[index + 1];
}

export function releaseFlags(releasePlan) {
  if (!RELEASE_PLANS.has(releasePlan)) {
    throw new Error(`Unsupported release plan: ${releasePlan}`);
  }
  return {
    deployApp: releasePlan === 'app-only' || releasePlan === 'app-db',
    applyMigrations: releasePlan === 'db-only' || releasePlan === 'app-db',
  };
}

export function expectedDevelopmentChecks(releasePlan, validationProfile) {
  if (!VALIDATION_PROFILES.has(validationProfile)) {
    throw new Error(`Unsupported validation profile: ${validationProfile}`);
  }
  const { applyMigrations } = releaseFlags(releasePlan);
  const releasesRuntime = releasePlan !== 'sync-only';
  const strongValidation = validationProfile !== 'light';
  return {
    offlineValidation: 'passed',
    build: strongValidation ? 'passed' : 'not-required',
    migrationContracts: strongValidation ? 'passed' : 'not-required',
    shadow: validationProfile === 'full' ? 'passed' : 'not-required',
    upgradeReplay: applyMigrations ? 'passed' : 'not-required',
    migrationApplication: applyMigrations ? 'passed' : 'not-required',
    tracker: releasesRuntime ? 'passed' : 'not-required',
    permissions: releasesRuntime ? 'passed' : 'not-required',
    crud: applyMigrations ? 'passed' : 'not-required',
    mockBrowser: strongValidation ? 'passed' : 'not-required',
    operationalSmoke: releasesRuntime ? 'passed' : 'not-required',
  };
}

export function buildDevelopmentEvidence({
  baseSha,
  commitSha,
  v13CommitSha,
  projectRef,
  releasePlan,
  validationProfile,
  classifierVersion,
  changedFilesDigest,
  sourceTreeSha,
  migrationDigest,
}) {
  const numericClassifierVersion = Number(classifierVersion);
  if (!Number.isInteger(numericClassifierVersion) || numericClassifierVersion < 1) {
    throw new Error('classifierVersion must be a positive integer.');
  }
  if (!/^[a-f0-9]{64}$/.test(changedFilesDigest)) {
    throw new Error('changedFilesDigest must be a lowercase SHA-256 digest.');
  }
  if (!/^[a-f0-9]{40}$/.test(sourceTreeSha ?? '')) {
    throw new Error('sourceTreeSha must be a lowercase git tree SHA-1.');
  }
  if (!/^[a-f0-9]{64}$/.test(migrationDigest ?? '')) {
    throw new Error('migrationDigest must be a lowercase SHA-256 digest.');
  }
  const flags = releaseFlags(releasePlan);
  return {
    schemaVersion: 4,
    validatedAt: new Date().toISOString(),
    stage: 'development',
    passed: true,
    baseSha,
    commitSha,
    sourceTreeSha,
    v13CommitSha,
    projectRef,
    releasePlan,
    ...flags,
    validationProfile,
    classifierVersion: numericClassifierVersion,
    changedFilesDigest,
    migrationDigest,
    migrationOrder: ['topik_writing', 'admin'],
    checks: expectedDevelopmentChecks(releasePlan, validationProfile),
  };
}

async function main() {
  const args = process.argv.slice(2);
  const jsonOut = resolve(value(args, '--json-out'));
  const report = buildDevelopmentEvidence({
    baseSha: value(args, '--base-sha'),
    commitSha: value(args, '--commit-sha'),
    v13CommitSha: value(args, '--v13-sha'),
    projectRef: value(args, '--project-ref'),
    releasePlan: value(args, '--release-plan'),
    validationProfile: value(args, '--validation-profile'),
    classifierVersion: value(args, '--classifier-version'),
    changedFilesDigest: value(args, '--changed-files-digest'),
    sourceTreeSha: value(args, '--source-tree-sha'),
    migrationDigest: value(args, '--migration-digest'),
  });
  mkdirSync(dirname(jsonOut), { recursive: true });
  writeFileSync(jsonOut, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`Development evidence written for ${report.commitSha} (${report.releasePlan}).`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    await main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
