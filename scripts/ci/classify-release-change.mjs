#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadRewriteAllowlist } from '../db/check-expand-migrations.mjs';

// 4: a control-plane touch escalates the validation profile even when the same
// change also touches an app path.
// 5: supabase/README.md resolves to control-plane instead of being shadowed by the
// generic markdown rule.
// 6: the adopted v13 learner archive (supabase/migrations-v13/) resolves to
// control-plane instead of unknown, which blocked every PR that touched it.
// 7: Playwright run artifacts (test-results/, playwright-report/) resolve to light
// instead of unknown, which blocked the commit that untracked test-results/.
// 8: six retired root-level scratch files (tmp_*.ps1 x3, preview*.log x3) resolve to
// light instead of unknown, so the Phase 1 commit that removes them can release.
// Exact filenames only — the fail-closed default for new root files stays intact.
// 9: .eslintrc.cjs resolves to app instead of unknown. The list only knew
// eslint.config.js (flat config), but this repo pins ESLINT_USE_FLAT_CONFIG=false
// and its real lint config is .eslintrc.cjs — editing it blocked the release.
// Recorded in release evidence, so a bump keeps pre-fix classifications
// distinguishable from post-fix ones.
export const CLASSIFIER_VERSION = 9;

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

// Markdown that carries a validation contract rather than prose. pathKind() tests
// documentation before the control-plane rule and isDocumentationPath() matches any
// `.md`, so without an explicit check ahead of it these paths land on 'light' and
// isControlPlanePath() is never consulted for them.
//
// supabase/README.md is the single source of truth for the migration tracker
// separation, the runner contract, and the boundary rules, so a change to it must
// pull in db-contract. Every other markdown file stays on the light path on
// purpose — including .github/pull_request_template.md, which is inside the
// otherwise control-plane .github/ tree but carries no validation contract, and
// AGENTS.md / docs/**, which are prose.
const CONTROL_PLANE_DOCUMENT_PATHS = new Set(['supabase/README.md']);

function isControlPlaneDocumentPath(filePath) {
  return CONTROL_PLANE_DOCUMENT_PATHS.has(filePath);
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

// Playwright's local run artifacts. They carry no validation contract and no release
// meaning, but they resolved to 'unknown' — so the single commit that removed the
// tracked `test-results/.last-run.json` from git blocked its own release. A path only
// has to be reachable by a diff to need a rule here; gitignoring it afterwards does
// not help the commit that does the removing.
function isTestArtifactPath(filePath) {
  return /^(test-results|playwright-report)\//.test(filePath);
}

// 2026-08-18 리팩토링 Phase 1 이 제거한 루트 스크래치 파일들. 규칙이 없으면 삭제
// diff 가 unknown-path 로 스스로를 blocked 시킨다(v7 의 test-results 와 같은 함정).
// 새 루트 파일이 fail-closed 로 남도록 패턴이 아니라 정확한 파일명만 나열한다.
const RETIRED_ROOT_ARTIFACTS = new Set([
  'tmp_extract_strings.ps1',
  'tmp_fix_korean_map.ps1',
  'tmp_fix_korean_map2.ps1',
  'preview4174.log',
  'preview4176.log',
  'preview4176.log.local-backup',
]);

function isRetiredRootArtifactPath(filePath) {
  return RETIRED_ROOT_ARTIFACTS.has(filePath);
}

export function isForwardMigrationPath(filePath) {
  return /^supabase\/(migrations|migrations-admin)\/(?!down\/)[^/]+\.sql$/i.test(filePath);
}

function isDownMigrationPath(filePath) {
  return /^supabase\/(migrations|migrations-admin)\/down\/[^/]+\.sql$/i.test(filePath);
}

// The adopted v13 learner archive. Deliberately NOT a migration path: the release
// manifest does not carry the learner namespace yet (ownership transfer M5b, which
// ships with M4), so calling these 'migration' would set databaseTouched and have a
// release claim it applies files the pipeline never touches. Control-plane keeps the
// full validation profile — db-contract runs check:v13-archive and the expand gate —
// without that false claim. Flip this to isForwardMigrationPath when M5b lands.
function isLearnerArchivePath(filePath) {
  return /^supabase\/migrations-v13\//i.test(filePath);
}

function isControlPlanePath(filePath) {
  return (
    isControlPlaneDocumentPath(filePath)
    || /^\.github\//.test(filePath)
    || /^scripts\//.test(filePath)
    || /^tests\//.test(filePath)
    || isDownMigrationPath(filePath)
    || isLearnerArchivePath(filePath)
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
      '.eslintrc.cjs',
    ].includes(filePath)
  );
}

function pathKind(filePath) {
  if (isControlPlaneDocumentPath(filePath)) return 'control-plane';
  if (
    isDocumentationPath(filePath)
    || isOfflineTestPath(filePath)
    || isTestArtifactPath(filePath)
    || isRetiredRootArtifactPath(filePath)
  ) {
    return 'light';
  }
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

// The validation profile answers "how hard do we check this change", which is a
// separate question from the release plan's "what does this change ship". A
// control-plane touch always demands the strong profile, including when the same
// change also touches an app path — `app-only` used to return early here, so a PR
// that edited a workflow, a release script, a migration manifest, or a down
// migration alongside any src/ file silently lost the control-plane validation
// (`db-contract` is the only job gated on `full`). Escalating the profile leaves
// releasePlan, deployApp, and applyMigrations untouched, so release behavior is
// unchanged — only the amount of checking goes up.
function deriveValidationProfile({ releasePlan, controlPlaneTouched }) {
  if (releasePlan === 'blocked' || releasePlan === 'db-only' || releasePlan === 'app-db') {
    return 'full';
  }
  if (controlPlaneTouched) return 'full';
  if (releasePlan === 'app-only') return 'app';
  return 'light';
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
