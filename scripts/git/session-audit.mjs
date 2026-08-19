import { existsSync, readdirSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

import {
  CLASSIFICATIONS,
  GENERATED_DIRECTORY_NAMES,
  SOURCE_DIRECTORY_NAMES,
  SOURCE_EXTENSIONS,
  SOURCE_FILE_NAMES,
  STRICT_CLASSIFICATIONS,
  defaultCodexWorktreeRoot,
  defaultRun,
  defaultStateRoot,
  git,
  isPathWithin,
  nowIso,
  pathsEqual
} from './session-core.mjs';
import {
  branchMergedIntoMain,
  branchRecords,
  commonGitDirectory,
  getPullRequest,
  remoteBranchRecords,
  repositoryIdentity,
  repositoryRoot,
  worktreeRecords
} from './session-git.mjs';
import { readManifests } from './session-manifest.mjs';

// 세션 분류·물리 후보 판정·보존 오버레이·감사 수집/출력 — 분해로
// session-lifecycle.mjs 에서 이동(동작 동일).

export function findManifestForWorktree(manifests, path) {
  return manifests.find((manifest) => manifest.worktreePath && pathsEqual(manifest.worktreePath, path)) || null;
}

export function findManifestForBranch(manifests, branch) {
  return manifests.find((manifest) => manifest.branch === branch) || null;
}

export function classifySession({ branch, dirty, detached, pr, mergedIntoMain, manifest }) {
  if (dirty) return 'DIRTY_BLOCKED';
  if (detached || !branch) return 'DETACHED_PROBE';
  if (pr?.state === 'MERGED' || mergedIntoMain) return 'MERGED_CLEANUP';
  if (pr?.state === 'OPEN' || manifest?.status === 'ACTIVE') return 'ACTIVE';
  if (branch === 'main') return 'ACTIVE';
  return 'ORPHAN_REVIEW';
}

export function evaluateMainHistory({ run = defaultRun, rootDir = process.cwd() } = {}) {
  const root = repositoryRoot(run, rootDir);
  const countsResult = git(run, root, ['rev-list', '--left-right', '--count', 'origin/main...main'], { allowFailure: true });
  if (countsResult.status !== 0) {
    return { drift: true, alignable: false, reason: 'origin/main or main is unavailable' };
  }
  const [behind = 0, ahead = 0] = countsResult.stdout.trim().split(/\s+/).map(Number);
  const mainRecord = branchRecords(run, root).find((record) => record.branch === 'main');
  const mainWorktree = mainRecord?.worktreePath || root;
  const clean = existsSync(mainWorktree)
    && git(run, mainWorktree, ['status', '--porcelain'], { allowFailure: true }).stdout.trim() === '';
  const ancestor = git(run, root, ['merge-base', '--is-ancestor', 'origin/main', 'main'], { allowFailure: true }).status === 0;
  const localTree = git(run, root, ['rev-parse', 'main^{tree}'], { allowFailure: true }).stdout.trim();
  const remoteTree = git(run, root, ['rev-parse', 'origin/main^{tree}'], { allowFailure: true }).stdout.trim();
  const treesEqual = Boolean(localTree && remoteTree && localTree === remoteTree);
  const drift = behind !== 0 || ahead !== 0 || !treesEqual;
  const alignable = clean && behind === 0 && ahead > 0 && ancestor && treesEqual;
  return {
    drift,
    alignable,
    ahead,
    behind,
    clean,
    ancestor,
    treesEqual,
    mainWorktree,
    reason: alignable
      ? 'main is ahead-only with an identical tree'
      : drift
        ? 'main does not satisfy the guarded alignment contract'
        : 'main matches origin/main'
  };
}

export function scanCandidate(candidate, maxDepth = 4) {
  const findings = {
    fileCount: 0,
    generatedOnly: true,
    gitDirectories: [],
    invalidOrRenamedGit: [],
    sensitiveEnv: [],
    sourceMarkers: [],
    unknownFiles: []
  };

  function visit(directory, depth, inGeneratedDirectory) {
    if (depth > maxDepth) {
      findings.generatedOnly = false;
      findings.unknownFiles.push(directory);
      return;
    }
    let entries;
    try {
      entries = readdirSync(directory, { withFileTypes: true });
    } catch {
      findings.generatedOnly = false;
      findings.unknownFiles.push(directory);
      return;
    }
    for (const entry of entries) {
      const fullPath = join(directory, entry.name);
      const lowerName = entry.name.toLowerCase();
      const generated = inGeneratedDirectory || GENERATED_DIRECTORY_NAMES.has(lowerName);
      if (entry.isSymbolicLink()) {
        findings.generatedOnly = false;
        findings.unknownFiles.push(fullPath);
        continue;
      }
      if (entry.isDirectory()) {
        if (lowerName === '.git') {
          findings.gitDirectories.push(directory);
          findings.generatedOnly = false;
          continue;
        }
        if (lowerName.startsWith('.git.') || lowerName.startsWith('.git-')) {
          findings.invalidOrRenamedGit.push(fullPath);
          findings.generatedOnly = false;
          continue;
        }
        if (!generated && SOURCE_DIRECTORY_NAMES.has(lowerName)) {
          findings.sourceMarkers.push(fullPath);
          findings.generatedOnly = false;
        }
        if (lowerName === 'node_modules' || lowerName === 'dist' || lowerName === 'build') {
          if (!generated) {
            findings.sourceMarkers.push(fullPath);
            findings.generatedOnly = false;
          }
          continue;
        }
        visit(fullPath, depth + 1, generated);
        continue;
      }
      if (!entry.isFile()) continue;
      findings.fileCount += 1;
      if (lowerName === '.git') {
        findings.gitDirectories.push(directory);
        findings.generatedOnly = false;
        continue;
      }
      if (lowerName.startsWith('.git.') || lowerName.startsWith('.git-')) {
        findings.invalidOrRenamedGit.push(fullPath);
        findings.generatedOnly = false;
        continue;
      }
      if (lowerName === '.env.local' || /^\.env\..+\.local$/.test(lowerName)) {
        findings.sensitiveEnv.push(fullPath);
        findings.generatedOnly = false;
        continue;
      }
      if (generated) continue;
      const extension = lowerName.includes('.') ? lowerName.slice(lowerName.lastIndexOf('.')) : '';
      if (SOURCE_FILE_NAMES.has(lowerName) || SOURCE_EXTENSIONS.has(extension)) {
        findings.sourceMarkers.push(fullPath);
        findings.generatedOnly = false;
        continue;
      }
      if (!generated && !lowerName.endsWith('.log')) {
        findings.unknownFiles.push(fullPath);
        findings.generatedOnly = false;
      }
    }
  }

  visit(candidate, 0, false);
  return findings;
}

export function classifyPhysicalCandidate({
  candidate,
  run = defaultRun,
  currentCommonGitDir = null
}) {
  const scan = scanCandidate(candidate);
  if (scan.invalidOrRenamedGit.length > 0) {
    return {
      classification: 'RECOVERY_REQUIRED',
      detail: [
        scan.invalidOrRenamedGit.length ? 'renamed or invalid Git metadata' : null,
        scan.sensitiveEnv.length ? 'local environment file' : null,
        scan.sourceMarkers.length ? 'source content' : null
      ].filter(Boolean).join(', '),
      scan
    };
  }

  for (const gitDirectory of scan.gitDirectories) {
    const topLevel = git(run, gitDirectory, ['rev-parse', '--show-toplevel'], { allowFailure: true });
    if (topLevel.status !== 0) {
      return { classification: 'RECOVERY_REQUIRED', detail: 'invalid .git metadata', scan };
    }
    const common = commonGitDirectory(run, topLevel.stdout.trim());
    if (!currentCommonGitDir || !pathsEqual(common, currentCommonGitDir)) {
      const dirty = git(run, topLevel.stdout.trim(), ['status', '--porcelain'], { allowFailure: true }).stdout.trim() !== '';
      return {
        classification: 'FOREIGN_REPO',
        detail: dirty ? 'foreign repository (dirty; inspect in its owner repository)' : 'foreign repository',
        repositoryRoot: topLevel.stdout.trim(),
        scan
      };
    }
  }

  if (scan.gitDirectories.length > 0) {
    return { classification: 'ACTIVE', detail: 'registered repository metadata', scan };
  }
  if (scan.sensitiveEnv.length > 0 || scan.sourceMarkers.length > 0) {
    return {
      classification: 'RECOVERY_REQUIRED',
      detail: [
        scan.sensitiveEnv.length ? 'local environment file' : null,
        scan.sourceMarkers.length ? 'source content' : null
      ].filter(Boolean).join(', '),
      scan
    };
  }
  if (scan.generatedOnly) {
    return {
      classification: 'SAFE_QUARANTINE',
      detail: scan.fileCount === 0 ? 'empty physical worktree directory' : 'known generated files only',
      scan
    };
  }
  return { classification: 'RECOVERY_REQUIRED', detail: 'unrecognized physical worktree content', scan };
}

export function physicalCandidates(codexWorktreeRoot) {
  if (!existsSync(codexWorktreeRoot)) return [];
  return readdirSync(codexWorktreeRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(codexWorktreeRoot, entry.name));
}

export function staleOriginRefs(run, root) {
  const result = git(run, root, ['remote', 'prune', '--dry-run', 'origin'], { allowFailure: true });
  if (result.status !== 0) return [];
  return result.stdout.split(/\r?\n/)
    .map((line) => line.match(/\[would prune\]\s+origin\/(.+)$/)?.[1])
    .filter(Boolean);
}

// A merged branch inside its 7-day retention window stays visible but must not be
// deleted: pinned or unexpired holds read as RETENTION_HOLD, a head that drifted
// from the recorded PR head becomes RECOVERY_REQUIRED, and only an expired,
// unpinned hold falls back to MERGED_CLEANUP for the finalize pass.
export function applyRetentionOverlay({ classification, manifest, currentSha = null, clock = () => new Date() }) {
  if (!manifest) return { classification, detail: null };
  if (manifest.lifecyclePhase === 'RECOVERY') {
    return { classification: 'RECOVERY_REQUIRED', detail: 'retention recovery review required' };
  }
  if (manifest.lifecyclePhase !== 'RETENTION') return { classification, detail: null };
  if (manifest.pinned) {
    return { classification: 'RETENTION_HOLD', detail: 'pinned retained branch (expiry suspended)' };
  }
  if (currentSha && manifest.prHeadSha && currentSha !== manifest.prHeadSha) {
    return {
      classification: 'RECOVERY_REQUIRED',
      detail: `retained branch drifted from recorded head ${manifest.prHeadSha.slice(0, 7)}`
    };
  }
  const expiresMs = manifest.branchExpiresAt ? Date.parse(manifest.branchExpiresAt) : NaN;
  if (Number.isFinite(expiresMs) && clock().getTime() >= expiresMs) {
    return { classification: 'MERGED_CLEANUP', detail: 'retention window expired' };
  }
  return { classification: 'RETENTION_HOLD', detail: `retained until ${manifest.branchExpiresAt ?? 'unknown'}` };
}

export function collectAudit({
  run = defaultRun,
  rootDir = process.cwd(),
  stateRoot = defaultStateRoot(),
  codexWorktreeRoot = defaultCodexWorktreeRoot(),
  includePullRequests = true,
  pullRequestProvider = null,
  clock = () => new Date()
} = {}) {
  const root = repositoryRoot(run, rootDir);
  const repository = repositoryIdentity(run, root);
  const commonDir = commonGitDirectory(run, root);
  const manifests = readManifests(stateRoot).filter((manifest) => !manifest.repository || manifest.repository === repository);
  const worktrees = worktreeRecords(run, root);
  const branches = branchRecords(run, root);
  const items = [];
  const pullRequests = new Map();

  function pullRequest(branch) {
    if (!branch || !includePullRequests) return null;
    if (!pullRequests.has(branch)) {
      pullRequests.set(branch, pullRequestProvider
        ? pullRequestProvider({ branch, repository, root })
        : getPullRequest(run, repository, branch));
    }
    return pullRequests.get(branch);
  }

  for (const worktree of worktrees) {
    const manifest = findManifestForWorktree(manifests, worktree.path);
    const pr = pullRequest(worktree.branch);
    const mergedIntoMain = worktree.branch && worktree.branch !== 'main'
      ? branchMergedIntoMain(run, root, worktree.branch)
      : false;
    const classification = classifySession({
      branch: worktree.branch,
      detached: worktree.detached,
      dirty: worktree.dirty,
      pr,
      mergedIntoMain,
      manifest
    });
    items.push({
      classification,
      kind: 'worktree',
      id: manifest?.worktreeId || basename(dirname(worktree.path)),
      path: worktree.path,
      branch: worktree.branch || null,
      prNumber: pr?.number || null,
      detail: worktree.statusError || (worktree.detached ? 'detached worktree' : 'registered worktree')
    });
  }

  const attachedBranches = new Set(worktrees.map((worktree) => worktree.branch).filter(Boolean));
  for (const branch of branches) {
    if (branch.branch === 'main' || attachedBranches.has(branch.branch)) continue;
    const manifest = findManifestForBranch(manifests, branch.branch);
    const pr = pullRequest(branch.branch);
    const mergedIntoMain = branchMergedIntoMain(run, root, branch.branch);
    let classification = classifySession({ branch: branch.branch, dirty: false, detached: false, pr, mergedIntoMain, manifest });
    let detail = pr ? `PR #${pr.number} ${pr.state.toLowerCase()}` : 'local branch without a worktree';
    if (classification === 'MERGED_CLEANUP' && manifest) {
      const currentSha = git(run, root, ['rev-parse', `refs/heads/${branch.branch}`], { allowFailure: true }).stdout.trim() || null;
      const overlay = applyRetentionOverlay({ classification, manifest, currentSha, clock });
      classification = overlay.classification;
      if (overlay.detail) detail = overlay.detail;
    }
    items.push({
      classification,
      kind: 'branch',
      id: branch.branch,
      path: null,
      branch: branch.branch,
      prNumber: pr?.number || null,
      detail
    });
  }

  const localBranchNames = new Set(branches.map((record) => record.branch));
  for (const remoteBranch of remoteBranchRecords(run, root)) {
    if (remoteBranch.branch === 'main' || localBranchNames.has(remoteBranch.branch)) continue;
    const pr = pullRequest(remoteBranch.branch);
    const mergedIntoMain = branchMergedIntoMain(run, root, `origin/${remoteBranch.branch}`);
    let classification = pr?.state === 'MERGED' || (!pr && mergedIntoMain)
      ? 'MERGED_CLEANUP'
      : pr?.state === 'OPEN'
        ? 'ACTIVE'
        : 'ORPHAN_REVIEW';
    let detail = pr
      ? `remote head for PR #${pr.number} ${pr.state.toLowerCase()}`
      : mergedIntoMain
        ? 'remote head is already an ancestor of origin/main'
        : 'remote head without a matching PR';
    const manifest = findManifestForBranch(manifests, remoteBranch.branch);
    if (classification === 'MERGED_CLEANUP' && manifest) {
      const currentSha = git(run, root, ['rev-parse', `refs/remotes/origin/${remoteBranch.branch}`], { allowFailure: true }).stdout.trim() || null;
      const overlay = applyRetentionOverlay({ classification, manifest, currentSha, clock });
      classification = overlay.classification;
      if (overlay.detail) detail = overlay.detail;
    }
    items.push({
      classification,
      kind: 'remote-branch',
      id: `origin/${remoteBranch.branch}`,
      path: null,
      branch: remoteBranch.branch,
      prNumber: pr?.number || null,
      detail
    });
  }

  for (const manifest of manifests) {
    if (manifest.manifestError) {
      items.push({
        classification: 'RECOVERY_REQUIRED',
        kind: 'manifest',
        id: basename(manifest.manifestFile),
        path: manifest.manifestFile,
        branch: null,
        prNumber: null,
        detail: manifest.manifestError
      });
      continue;
    }
    const matched = worktrees.some((worktree) => manifest.worktreePath && pathsEqual(worktree.path, manifest.worktreePath));
    if (!matched && manifest.worktreePath) {
      items.push({
        classification: 'ORPHAN_REVIEW',
        kind: 'manifest',
        id: manifest.worktreeId || basename(manifest.manifestFile, '.json'),
        path: manifest.worktreePath,
        branch: manifest.branch || null,
        prNumber: manifest.pullRequestNumber || null,
        detail: existsSync(manifest.worktreePath) ? 'manifest path is not a registered worktree' : 'manifest path is missing'
      });
    }
  }

  const registeredPaths = worktrees.map((worktree) => worktree.path);
  for (const candidate of physicalCandidates(codexWorktreeRoot)) {
    if (registeredPaths.some((path) => isPathWithin(candidate, path))) continue;
    const classification = classifyPhysicalCandidate({ candidate, run, currentCommonGitDir: commonDir });
    items.push({
      classification: classification.classification,
      kind: 'physical-directory',
      id: basename(candidate),
      path: candidate,
      branch: null,
      prNumber: null,
      detail: classification.detail
    });
  }

  for (const branch of staleOriginRefs(run, root)) {
    items.push({
      classification: 'MERGED_CLEANUP',
      kind: 'stale-ref',
      id: `origin/${branch}`,
      path: null,
      branch,
      prNumber: null,
      detail: 'stale origin tracking ref'
    });
  }

  const mainHistory = evaluateMainHistory({ run, rootDir: root });
  if (mainHistory.drift) {
    items.push({
      classification: 'MAIN_HISTORY_DRIFT',
      kind: 'main-history',
      id: 'main',
      path: mainHistory.mainWorktree,
      branch: 'main',
      prNumber: null,
      detail: mainHistory.reason,
      alignable: mainHistory.alignable
    });
  }

  const counts = Object.fromEntries(CLASSIFICATIONS.map((classification) => [classification, 0]));
  for (const item of items) counts[item.classification] += 1;
  return {
    repository,
    repositoryRoot: root,
    stateRoot,
    codexWorktreeRoot,
    generatedAt: nowIso(),
    counts,
    items,
    strictFailureCount: items.filter((item) => STRICT_CLASSIFICATIONS.has(item.classification)).length
  };
}

export function formatAudit(audit) {
  const lines = [
    `Session audit: ${audit.repository}`,
    `Repository: ${audit.repositoryRoot}`,
    `Manifest root: ${audit.stateRoot}`,
    ''
  ];
  for (const classification of CLASSIFICATIONS) {
    const entries = audit.items.filter((item) => item.classification === classification);
    if (entries.length === 0) continue;
    lines.push(`${classification} (${entries.length})`);
    for (const item of entries) {
      const subject = item.branch || item.path || item.id;
      lines.push(`  - [${item.kind}] ${subject}: ${item.detail}`);
    }
  }
  lines.push('', `Strict findings: ${audit.strictFailureCount}`);
  return lines.join('\n');
}
