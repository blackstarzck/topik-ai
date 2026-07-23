#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadRewriteAllowlist } from '../db/check-expand-migrations.mjs';

export const CLASSIFIER_VERSION = 3;

const ZERO_SHA = /^0+$/;
const RELEASE_PLANS = new Set([
  'sync-only',
  'app-only',
  'db-only',
  'app-db',
  'blocked',
]);
const MANUAL_RELEASE_PLANS = new Set(['app-db']);

function value(args, flag, { required = true } = {}) {
  const index = args.indexOf(flag);
  if (index < 0 || !args[index + 1]) {
    if (!required) return null;
    throw new Error(`${flag} is required.`);
  }
  return args[index + 1];
}

function normalizePath(filePath) {
  return filePath.replaceAll('\\', '/').replace(/^\.\//, '');
}

function isDocumentationPath(filePath) {
  return (
    /^(docs|logs)\//.test(filePath)
    || /(^|\/)AGENTS\.md$/i.test(filePath)
    || /\.md$/i.test(filePath)
    || ['.editorconfig', '.gitignore', 'LICENSE', 'LICENSE.md'].includes(filePath)
  );
}

function isOfflineTestPath(filePath) {
  return /^tests\/(unit|e2e)\//.test(filePath);
}

export function isForwardMigrationPath(filePath) {
  return /^supabase\/(migrations|migrations-admin)\/(?!down\/)[^/]+\.sql$/i.test(filePath);
}

function isDownMigrationPath(filePath) {
  return /^supabase\/(migrations|migrations-admin)\/down\/[^/]+\.sql$/i.test(filePath);
}

function isControlPlanePath(filePath) {
  return (
    /^\.github\//.test(filePath)
    || /^scripts\//.test(filePath)
    || /^tests\//.test(filePath)
    || filePath === 'supabase/README.md'
    || isDownMigrationPath(filePath)
    || filePath === '.env.example'
    || filePath === '.nvmrc'
    || /^playwright\..+\.config\.ts$/.test(filePath)
    || filePath === 'playwright.config.ts'
  );
}

function isAppPath(filePath) {
  return (
    /^(src|public|api)\//.test(filePath)
    || [
      'index.html',
      'package.json',
      'package-lock.json',
      'pnpm-lock.yaml',
      'yarn.lock',
      'vercel.json',
      'vite.config.ts',
      'tsconfig.json',
      'tsconfig.app.json',
      'tsconfig.node.json',
      'eslint.config.js',
    ].includes(filePath)
  );
}

function pathKind(filePath) {
  if (isDocumentationPath(filePath) || isOfflineTestPath(filePath)) return 'light';
  if (isForwardMigrationPath(filePath)) return 'migration';
  if (isControlPlanePath(filePath)) return 'control-plane';
  if (isAppPath(filePath)) return 'app';
  return 'unknown';
}

function deriveReleasePlan({ appTouched, databaseTouched, blockedReasons }) {
  if (blockedReasons.length > 0) return 'blocked';
  if (appTouched && databaseTouched) return 'app-db';
  if (appTouched) return 'app-only';
  if (databaseTouched) return 'db-only';
  return 'sync-only';
}

function deriveValidationProfile({ releasePlan, controlPlaneTouched }) {
  if (releasePlan === 'blocked' || releasePlan === 'db-only' || releasePlan === 'app-db') {
    return 'full';
  }
  if (releasePlan === 'app-only') return 'app';
  return controlPlaneTouched ? 'full' : 'light';
}

export function applyManualReleasePlan(report, requestedReleasePlan) {
  if (!requestedReleasePlan) return report;
  if (!MANUAL_RELEASE_PLANS.has(requestedReleasePlan)) {
    throw new Error(`Unsupported manual release plan: ${requestedReleasePlan}`);
  }
  if (report.releasePlan === 'blocked') {
    throw new Error('A blocked change cannot be manually released.');
  }
  return {
    ...report,
    automaticReleasePlan: report.releasePlan,
    releasePlan: requestedReleasePlan,
    deployApp: true,
    applyMigrations: true,
    validationProfile: 'full',
    manualRelease: true,
  };
}

export function classifyChangedFiles(
  changes,
  { forcedReason = null, allowedRewrites = new Set() } = {}
) {
  const normalizedChanges = changes.map((change) => ({
    status: change.status,
    path: normalizePath(change.path),
    previousPath: change.previousPath ? normalizePath(change.previousPath) : null,
  }));
  const blockedReasons = forcedReason ? [forcedReason] : [];
  let appTouched = false;
  let databaseTouched = false;
  let controlPlaneTouched = false;

  for (const change of normalizedChanges) {
    const paths = [change.path, change.previousPath].filter(Boolean);
    const kinds = paths.map((filePath) => ({ filePath, kind: pathKind(filePath) }));

    for (const { filePath, kind } of kinds) {
      if (kind === 'app') appTouched = true;
      if (kind === 'control-plane') controlPlaneTouched = true;
      if (kind === 'unknown') blockedReasons.push(`unknown-path:${filePath}`);
    }

    const currentIsForwardMigration = isForwardMigrationPath(change.path);
    const previousIsForwardMigration = Boolean(
      change.previousPath && isForwardMigrationPath(change.previousPath)
    );
    // A declared unapplied rewrite may modify a still-pending forward migration in
    // place. Only an in-place modification (status 'M') qualifies — never a rename,
    // copy, or delete — and the migration runner still fails closed on tracker
    // checksums if the file was actually applied to any environment.
    const isAllowedRewrite = (
      currentIsForwardMigration
      && !previousIsForwardMigration
      && change.status === 'M'
      && allowedRewrites.has(change.path)
    );
    if (
      !isAllowedRewrite
      && (previousIsForwardMigration || (currentIsForwardMigration && change.status !== 'A'))
    ) {
      blockedReasons.push(`immutable-migration:${change.previousPath ?? change.path}`);
      continue;
    }
    if (currentIsForwardMigration && (change.status === 'A' || isAllowedRewrite)) {
      databaseTouched = true;
    }
  }

  const uniqueBlockedReasons = [...new Set(blockedReasons)].sort();
  const releasePlan = deriveReleasePlan({
    appTouched,
    databaseTouched,
    blockedReasons: uniqueBlockedReasons,
  });
  const validationProfile = deriveValidationProfile({ releasePlan, controlPlaneTouched });
  const canonical = normalizedChanges
    .map((change) => `${change.status}\t${change.previousPath ?? ''}\t${change.path}`)
    .sort()
    .join('\n');
  const changedFilesDigest = createHash('sha256').update(canonical).digest('hex');
  const paths = new Set(normalizedChanges.flatMap((change) => (
    [change.path, change.previousPath].filter(Boolean)
  )));
  const report = {
    schemaVersion: 2,
    classifierVersion: CLASSIFIER_VERSION,
    automaticReleasePlan: releasePlan,
    releasePlan,
    deployApp: releasePlan === 'app-only' || releasePlan === 'app-db',
    applyMigrations: releasePlan === 'db-only' || releasePlan === 'app-db',
    validationProfile,
    changedFilesDigest,
    changedFileCount: normalizedChanges.length,
    runUnit: [...paths].some((filePath) => /^tests\/unit\//.test(filePath)),
    runE2e: [...paths].some((filePath) => /^tests\/e2e\//.test(filePath)),
    manualRelease: false,
    reasons: normalizedChanges.map((change) => change.path).sort(),
    blockedReasons: uniqueBlockedReasons,
    changes: normalizedChanges,
  };
  if (!RELEASE_PLANS.has(report.releasePlan)) {
    throw new Error(`Unsupported release plan: ${report.releasePlan}`);
  }
  return report;
}

export function parseNameStatus(output) {
  const tokens = output.split('\0');
  if (tokens.at(-1) === '') tokens.pop();
  const changes = [];
  for (let index = 0; index < tokens.length;) {
    const status = tokens[index++];
    if (!status) throw new Error('git diff returned an empty status token.');
    if (/^[RC]/.test(status)) {
      const previousPath = tokens[index++];
      const filePath = tokens[index++];
      if (!previousPath || !filePath) throw new Error('git diff rename/copy record is incomplete.');
      changes.push({ status, previousPath, path: filePath });
    } else {
      const filePath = tokens[index++];
      if (!filePath) throw new Error('git diff record is missing a path.');
      changes.push({ status, path: filePath });
    }
  }
  return changes;
}

function resolveDiffRange(baseSha, headSha) {
  if (baseSha && ZERO_SHA.test(baseSha)) {
    return { baseSha, headSha, forcedReason: 'zero-base-sha' };
  }
  const candidate = baseSha || `${headSha}^`;
  const resolved = [];
  for (const sha of [candidate, headSha]) {
    const verified = spawnSync('git', ['rev-parse', '--verify', `${sha}^{commit}`], {
      encoding: 'utf8',
    });
    if (verified.status !== 0) {
      return { baseSha: candidate, headSha, forcedReason: `unresolved-git-sha:${sha}` };
    }
    resolved.push(verified.stdout.trim());
  }
  return { baseSha: resolved[0], headSha: resolved[1], forcedReason: null };
}

function changedFiles(baseSha, headSha) {
  const result = spawnSync(
    'git',
    ['diff', '--name-status', '-z', '--find-renames=50%', baseSha, headSha],
    { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }
  );
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || 'git diff failed.');
  }
  return parseNameStatus(result.stdout);
}

function writeGithubOutput(outputPath, report) {
  if (!outputPath) return;
  const values = {
    release_plan: report.releasePlan,
    deploy_app: report.deployApp,
    apply_migrations: report.applyMigrations,
    validation_profile: report.validationProfile,
    classifier_version: report.classifierVersion,
    changed_files_digest: report.changedFilesDigest,
    changed_file_count: report.changedFileCount,
    base_sha: report.baseSha,
    head_sha: report.headSha,
    run_unit: report.runUnit,
    run_e2e: report.runE2e,
  };
  appendFileSync(
    resolve(outputPath),
    `${Object.entries(values).map(([name, item]) => `${name}=${item}`).join('\n')}\n`,
    'utf8'
  );
}

async function main() {
  const args = process.argv.slice(2);
  const headSha = value(args, '--head');
  const requestedBaseSha = value(args, '--base', { required: false });
  const jsonOut = resolve(value(args, '--json-out'));
  const range = resolveDiffRange(requestedBaseSha, headSha);
  const changes = range.forcedReason ? [] : changedFiles(range.baseSha, range.headSha);
  const automaticReport = classifyChangedFiles(changes, {
    forcedReason: range.forcedReason,
    allowedRewrites: loadRewriteAllowlist(),
  });
  const report = {
    ...applyManualReleasePlan(
      automaticReport,
      value(args, '--manual-release-plan', { required: false })
    ),
    generatedAt: new Date().toISOString(),
    baseSha: range.baseSha,
    headSha: range.headSha,
  };
  mkdirSync(dirname(jsonOut), { recursive: true });
  writeFileSync(jsonOut, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  writeGithubOutput(value(args, '--github-output', { required: false }), report);
  console.log(
    `Release plan: ${report.releasePlan} `
    + `(${report.changedFileCount} change(s), ${report.changedFilesDigest})`
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    await main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
