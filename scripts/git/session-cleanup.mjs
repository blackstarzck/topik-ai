import {
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  unlinkSync
} from 'node:fs';
import { hostname } from 'node:os';
import { basename, join } from 'node:path';
import { randomUUID } from 'node:crypto';

import { expectedActorFor } from './account-context.mjs';
import {
  RETENTION_DAYS,
  assertDirectChild,
  defaultCodexWorktreeRoot,
  defaultRun,
  defaultStateRoot,
  gh,
  git,
  nowIso,
  pathsEqual,
  readJson,
  sanitizeName,
  timestampForFile,
  writeJson
} from './session-core.mjs';
import {
  branchMergedIntoMain,
  branchRecords,
  commonGitDirectory,
  getPullRequest,
  repositoryIdentity,
  repositoryRoot
} from './session-git.mjs';
import {
  MANIFEST_SCHEMA_VERSION,
  makeManifest,
  manifestPathForId,
  readManifests,
  upgradeManifest
} from './session-manifest.mjs';
import {
  classifyPhysicalCandidate,
  collectAudit,
  evaluateMainHistory,
  findManifestForBranch
} from './session-audit.mjs';

// 보존 창 시작·만료 확정·저장소 잠금·영수증·정리 실행 — 분해로
// session-lifecycle.mjs 에서 이동(동작 동일).

export function createVerifiedBundle({ run, root, branch, sourceRef = `refs/heads/${branch}`, recoveryRoot, clock = () => new Date() }) {
  mkdirSync(recoveryRoot, { recursive: true });
  const bundlePath = join(recoveryRoot, `${sanitizeName(branch)}-${timestampForFile(clock)}.bundle`);
  git(run, root, ['bundle', 'create', bundlePath, sourceRef]);
  const verification = git(run, root, ['bundle', 'verify', bundlePath], { allowFailure: true });
  if (verification.status !== 0) {
    throw new Error(`Bundle verification failed for ${branch}: ${(verification.stderr || verification.stdout).trim()}`);
  }
  return bundlePath;
}

export function removeManifestsForBranchOrWorktree(stateRoot, branch, worktreePath) {
  for (const manifest of readManifests(stateRoot)) {
    if (manifest.manifestError) continue;
    const matchesBranch = branch && manifest.branch === branch;
    const matchesWorktree = worktreePath && manifest.worktreePath && pathsEqual(manifest.worktreePath, worktreePath);
    if ((matchesBranch || matchesWorktree) && existsSync(manifest.manifestFile)) unlinkSync(manifest.manifestFile);
  }
}

export function archiveBranch({
  branch,
  apply = false,
  run = defaultRun,
  rootDir = process.cwd(),
  stateRoot = defaultStateRoot(),
  clock = () => new Date()
}) {
  if (!branch) throw new Error('--branch is required');
  if (branch === 'main') throw new Error('main cannot be archived');
  const root = repositoryRoot(run, rootDir);
  const record = branchRecords(run, root).find((item) => item.branch === branch);
  if (!record) throw new Error(`local branch does not exist: ${branch}`);
  if (branchMergedIntoMain(run, root, branch)) {
    throw new Error(`${branch} is already merged; use git:sessions:cleanup`);
  }
  if (record.worktreePath) {
    const dirty = git(run, record.worktreePath, ['status', '--porcelain'], { allowFailure: true });
    if (dirty.status !== 0 || dirty.stdout.trim()) throw new Error(`branch worktree is dirty: ${record.worktreePath}`);
    if (pathsEqual(record.worktreePath, rootDir)) throw new Error('cannot archive the branch checked out in the current worktree');
  }
  const recoveryRoot = join(stateRoot, 'recovery');
  const actions = [
    `create and verify recovery bundle for ${branch}`,
    ...(record.worktreePath ? [`remove clean worktree ${record.worktreePath}`] : []),
    `delete local branch ${branch}`
  ];
  if (!apply) return { applied: false, branch, actions, bundlePath: null };
  const lock = acquireRepoLock({ stateRoot, repository: repositoryIdentity(run, root), command: 'archive', clock });
  try {
    const bundlePath = createVerifiedBundle({ run, root, branch, recoveryRoot, clock });
    if (record.worktreePath) git(run, root, ['worktree', 'remove', record.worktreePath]);
    git(run, root, ['branch', '-D', branch]);
    removeManifestsForBranchOrWorktree(stateRoot, branch, record.worktreePath);
    return { applied: true, branch, actions, bundlePath };
  } finally {
    lock.release();
  }
}

// Remote branch deletion still rides the ambient credential (active gh account),
// so the gate verifies that identity against the AGENTS §11.1 account mapping for
// the audited repository instead of a hardcoded login.
export function ensureExpectedRemoteActor(run, repository) {
  const expected = expectedActorFor(repository);
  const login = gh(run, ['api', 'user', '--jq', '.login']).stdout.trim();
  if (login !== expected) {
    throw new Error(`Remote branch cleanup for ${repository} requires ${expected}; active account is ${login || 'unknown'}`);
  }
}

export function alignMainHistory({ run, root, stateRoot, mainHistory, clock }) {
  if (!mainHistory.alignable) throw new Error('main history does not satisfy guarded alignment conditions');
  const bundlePath = createVerifiedBundle({ run, root, branch: 'main', recoveryRoot: join(stateRoot, 'recovery'), clock });
  git(run, mainHistory.mainWorktree, ['reset', '--keep', 'origin/main']);
  return bundlePath;
}

export function quarantineCandidate({ candidate, codexWorktreeRoot, stateRoot, clock }) {
  assertDirectChild(codexWorktreeRoot, candidate);
  const quarantineRoot = join(stateRoot, 'quarantine', timestampForFile(clock));
  mkdirSync(quarantineRoot, { recursive: true });
  const destination = join(quarantineRoot, basename(candidate));
  if (existsSync(destination)) throw new Error(`quarantine destination already exists: ${destination}`);
  renameSync(candidate, destination);
  return destination;
}

export function removeExpiredEntries(root, cutoffMs, filter = () => true) {
  const removed = [];
  if (!existsSync(root)) return removed;
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (!filter(entry, path)) continue;
    const stats = statSync(path);
    if (stats.mtimeMs >= cutoffMs) continue;
    assertDirectChild(root, path);
    rmSync(path, { recursive: entry.isDirectory(), force: true });
    removed.push(path);
  }
  return removed;
}

export const LOCK_STALE_MS = 15 * 60 * 1000;

export function processAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
}

// Windows has no flock, so the per-repository mutation lock is an atomically
// created directory. A live owner fails the caller immediately (no waiting, no
// takeover); only a dead or stale owner is evicted, and eviction itself is an
// atomic rename so exactly one contender wins.
export function acquireRepoLock({
  stateRoot = defaultStateRoot(),
  repository,
  command,
  clock = () => new Date()
}) {
  const locksRoot = join(stateRoot, 'locks');
  mkdirSync(locksRoot, { recursive: true });
  const lockDir = join(locksRoot, `${sanitizeName(repository)}.lock`);
  const ownerFile = join(lockDir, 'owner.json');
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      mkdirSync(lockDir);
      writeJson(ownerFile, {
        pid: process.pid,
        host: hostname(),
        command,
        acquiredAt: nowIso(clock)
      });
      return {
        lockDir,
        release: () => rmSync(lockDir, { recursive: true, force: true })
      };
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      let owner = null;
      try {
        owner = readJson(ownerFile);
      } catch {
        owner = null;
      }
      const alive = owner?.pid ? processAlive(owner.pid) : false;
      if (alive) {
        throw new Error(
          `repository lock held by pid ${owner.pid} (${owner.command ?? 'unknown'}) since ${owner.acquiredAt ?? 'unknown'}`
        );
      }
      const stale = owner
        ? true // dead owner: safe to evict regardless of age
        : (() => {
          try {
            return clock().getTime() - statSync(lockDir).mtimeMs >= LOCK_STALE_MS;
          } catch {
            return true;
          }
        })();
      if (!stale) {
        throw new Error('repository lock is contended; retry shortly');
      }
      const evicted = join(locksRoot, `stale-${timestampForFile(clock)}-${randomUUID().slice(0, 8)}`);
      try {
        renameSync(lockDir, evicted);
      } catch {
        // Another contender evicted first; loop and retry the acquisition once.
      }
    }
  }
  throw new Error('unable to acquire the repository lock');
}

export function buildSessionScope(manifests, sessionId) {
  const matches = manifests.filter((manifest) => manifest.worktreeId === sessionId);
  if (matches.length === 0) return null;
  return {
    branches: new Set(matches.map((manifest) => manifest.branch).filter(Boolean)),
    paths: matches.map((manifest) => manifest.worktreePath).filter(Boolean)
  };
}

export function remoteHeadShaOf(run, root, branch) {
  const result = git(run, root, ['ls-remote', '--heads', 'origin', `refs/heads/${branch}`], { allowFailure: true });
  if (result.status !== 0) return null;
  return result.stdout.trim().split(/\s+/)[0] || null;
}

export function localHeadShaOf(run, root, branch) {
  const result = git(run, root, ['rev-parse', `refs/heads/${branch}`], { allowFailure: true });
  return result.status === 0 ? (result.stdout.trim() || null) : null;
}

export function writeManifestFields(manifest, fields, clock) {
  const file = manifest.manifestFile;
  const next = { ...manifest, ...fields, updatedAt: nowIso(clock) };
  delete next.manifestFile;
  writeJson(file, next);
  return { ...next, manifestFile: file };
}

export function writeReceipt(stateRoot, receipt, clock) {
  const receiptsRoot = join(stateRoot, 'receipts');
  const file = join(receiptsRoot, `${sanitizeName(receipt.branch)}-${timestampForFile(clock)}.json`);
  writeJson(file, receipt);
  return file;
}

export function removeExpiredReceipts(receiptsRoot, cutoffMs) {
  const removed = [];
  if (!existsSync(receiptsRoot)) return removed;
  for (const entry of readdirSync(receiptsRoot, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    const path = join(receiptsRoot, entry.name);
    let deletedAtMs = NaN;
    try {
      deletedAtMs = Date.parse(readJson(path).deletedAt);
    } catch {
      deletedAtMs = NaN;
    }
    if (!Number.isFinite(deletedAtMs)) deletedAtMs = statSync(path).mtimeMs;
    if (deletedAtMs >= cutoffMs) continue;
    assertDirectChild(receiptsRoot, path);
    rmSync(path, { force: true });
    removed.push(path);
  }
  return removed;
}

// Merge observed: remove the worktree immediately, keep the local and remote
// branches read-only for RETENTION_DAYS, and record every fact the expiry pass
// needs. Deleting nothing here is the §4 contract — deletions happen only in
// finalizeRetainedBranch after the window closes.
export function beginRetention({ run, root, repository, stateRoot, branch, pr, clock, executionRoot }) {
  const manifests = readManifests(stateRoot);
  const existing = findManifestForBranch(manifests, branch);
  const record = branchRecords(run, root).find((item) => item.branch === branch) ?? null;
  const localHeadSha = record ? localHeadShaOf(run, root, branch) : null;
  const remoteHeadSha = remoteHeadShaOf(run, root, branch);
  const prHeadSha = pr?.headRefOid ?? existing?.prHeadSha ?? localHeadSha ?? remoteHeadSha;
  let worktreeRemoved = false;
  if (record?.worktreePath) {
    if (pathsEqual(record.worktreePath, executionRoot)) {
      return { outcome: 'RETRY_PENDING', branch, detail: 'run cleanup from a control workspace outside this worktree' };
    }
    const status = git(run, record.worktreePath, ['status', '--porcelain'], { allowFailure: true });
    if (status.status !== 0 || status.stdout.trim()) {
      return { outcome: 'DIRTY_BLOCKED', branch };
    }
    if (prHeadSha && localHeadSha && localHeadSha !== prHeadSha) {
      if (existing) {
        writeManifestFields(existing, { lifecyclePhase: 'RECOVERY', status: 'RECOVERY_REQUIRED' }, clock);
      }
      return { outcome: 'RECOVERY', branch, detail: 'worktree tip differs from the merged PR head' };
    }
    git(run, root, ['worktree', 'remove', record.worktreePath]);
    worktreeRemoved = true;
  }
  if (!localHeadSha && !remoteHeadSha) {
    removeManifestsForBranchOrWorktree(stateRoot, branch, existing?.worktreePath ?? null);
    return { outcome: 'CLOSED', branch, detail: 'no local or remote ref left to retain' };
  }
  const startedAt = clock();
  const base = existing
    ? { ...upgradeManifest(existing) }
    : makeManifest({
      repository,
      repositoryRoot: root,
      worktreeId: `branch-${sanitizeName(branch)}`,
      worktreePath: null,
      agent: existing?.agent ?? 'codex',
      taskSummary: `retention for ${branch}`,
      branch,
      pr,
      status: 'RETENTION_HOLD',
      dirty: false,
      clock
    });
  const manifestFile = existing?.manifestFile ?? manifestPathForId(stateRoot, base.worktreeId);
  const next = {
    ...base,
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    branch,
    worktreePath: null,
    worktreeRemovedAt: worktreeRemoved ? nowIso(clock) : base.worktreeRemovedAt ?? null,
    status: 'RETENTION_HOLD',
    lifecyclePhase: 'RETENTION',
    cleanupStep: 'RETENTION_RECORDED',
    pullRequestNumber: pr?.number ?? base.pullRequestNumber ?? null,
    pullRequestUrl: pr?.url ?? base.pullRequestUrl ?? null,
    prHeadSha: prHeadSha ?? null,
    prBaseRef: pr?.baseRefName ?? base.prBaseRef ?? null,
    mergedAt: pr?.mergedAt ?? base.mergedAt ?? null,
    retentionStartedAt: nowIso(clock),
    branchExpiresAt: new Date(startedAt.getTime() + RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString(),
    localHeadSha,
    remoteHeadSha,
    remoteDeletedByGitHub: !remoteHeadSha,
    updatedAt: nowIso(clock)
  };
  delete next.manifestFile;
  writeJson(manifestFile, next);
  return { outcome: 'RETENTION_STARTED', branch, worktreeRemoved, manifest: { ...next, manifestFile } };
}

// Expired, unpinned hold: re-verify the §4 contract, bundle only commits that
// squash/rebase made unreachable from origin/main, delete local then remote, and
// close with a receipt that outlives the branch by another RETENTION_DAYS.
export function finalizeRetainedBranch({
  run,
  root,
  repository,
  stateRoot,
  manifest,
  pr,
  verifyRemoteAccount,
  clock,
  bundles
}) {
  const branch = manifest.branch;
  if (pr && pr.state !== 'MERGED') {
    writeManifestFields(manifest, { lifecyclePhase: 'RECOVERY', status: 'RECOVERY_REQUIRED' }, clock);
    return { outcome: 'RECOVERY', branch, detail: 'PR is no longer merged' };
  }
  const record = branchRecords(run, root).find((item) => item.branch === branch) ?? null;
  if (record?.worktreePath) {
    return { outcome: 'RETRY_PENDING', branch, detail: 'a worktree still holds the retained branch' };
  }
  const localHeadSha = record ? localHeadShaOf(run, root, branch) : null;
  const remoteHeadSha = remoteHeadShaOf(run, root, branch);
  const drifted = (localHeadSha && manifest.prHeadSha && localHeadSha !== manifest.prHeadSha)
    || (remoteHeadSha && manifest.prHeadSha && remoteHeadSha !== manifest.prHeadSha);
  if (drifted) {
    writeManifestFields(manifest, { lifecyclePhase: 'RECOVERY', status: 'RECOVERY_REQUIRED' }, clock);
    return { outcome: 'RECOVERY', branch, detail: 'retained ref drifted during the window' };
  }
  let current = manifest;
  let bundlePath = null;
  const reachAnchor = localHeadSha ?? remoteHeadSha;
  if (reachAnchor && !branchMergedIntoMain(run, root, reachAnchor)) {
    bundlePath = createVerifiedBundle({
      run,
      root,
      branch,
      sourceRef: localHeadSha ? `refs/heads/${branch}` : `refs/remotes/origin/${branch}`,
      recoveryRoot: join(stateRoot, 'recovery'),
      clock
    });
    bundles.push(bundlePath);
    current = writeManifestFields(current, { cleanupStep: 'BUNDLED' }, clock);
  }
  let localDeleted = false;
  if (record) {
    git(run, root, ['branch', branchMergedIntoMain(run, root, branch) ? '-d' : '-D', branch]);
    localDeleted = true;
    current = writeManifestFields(current, { cleanupStep: 'LOCAL_DELETED' }, clock);
  }
  let remoteDeleted = false;
  if (remoteHeadSha) {
    verifyRemoteAccount(run, repository);
    git(run, root, ['push', 'origin', '--delete', branch]);
    remoteDeleted = true;
    current = writeManifestFields(current, { cleanupStep: 'REMOTE_DELETED' }, clock);
  }
  const receiptPath = writeReceipt(stateRoot, {
    schemaVersion: 1,
    repository,
    worktreeId: current.worktreeId ?? null,
    branch,
    prNumber: current.pullRequestNumber ?? null,
    prHeadSha: current.prHeadSha ?? null,
    bundlePath,
    localDeleted,
    remoteDeleted,
    remoteDeletedByGitHub: Boolean(current.remoteDeletedByGitHub),
    deletedAt: nowIso(clock)
  }, clock);
  removeManifestsForBranchOrWorktree(stateRoot, branch, null);
  return { outcome: 'CLOSED', branch, bundlePath, receiptPath };
}

export function cleanupSessions({
  apply = false,
  sessionId = null,
  run = defaultRun,
  rootDir = process.cwd(),
  stateRoot = defaultStateRoot(),
  codexWorktreeRoot = defaultCodexWorktreeRoot(),
  includePullRequests = true,
  pullRequestProvider = null,
  verifyRemoteAccount = ensureExpectedRemoteActor,
  clock = () => new Date()
} = {}) {
  const initialAudit = collectAudit({ run, rootDir, stateRoot, codexWorktreeRoot, includePullRequests, pullRequestProvider, clock });
  const sessionScope = sessionId ? buildSessionScope(readManifests(stateRoot), sessionId) : null;
  if (sessionId && !sessionScope) throw new Error(`unknown session id: ${sessionId}`);
  const inScope = (item) => {
    if (!sessionScope) return true;
    if (item.branch && sessionScope.branches.has(item.branch)) return true;
    if (item.path && sessionScope.paths.some((path) => pathsEqual(path, item.path))) return true;
    return false;
  };
  const plannedActions = initialAudit.items
    .filter((item) => {
      if (item.classification === 'MERGED_CLEANUP') return inScope(item);
      if (sessionId) return false;
      return item.classification === 'SAFE_QUARANTINE' || (item.classification === 'MAIN_HISTORY_DRIFT' && item.alignable);
    })
    .map((item) => ({ classification: item.classification, kind: item.kind, target: item.branch || item.path || item.id }));
  if (!apply) return { applied: false, plannedActions, initialAudit, finalAudit: initialAudit, bundles: [], quarantined: [], lifecycleActions: [], removedExpired: [] };

  const lock = acquireRepoLock({ stateRoot, repository: initialAudit.repository, command: 'cleanup', clock });
  try {
  const root = initialAudit.repositoryRoot;
  git(run, root, ['fetch', 'origin', '--prune']);
  const freshAudit = collectAudit({ run, rootDir: root, stateRoot, codexWorktreeRoot, includePullRequests, pullRequestProvider, clock });
  const bundles = [];
  const quarantined = [];
  const lifecycleActions = [];
  const processedBranches = new Set();

  const mainHistory = evaluateMainHistory({ run, rootDir: root });
  if (!sessionId && mainHistory.drift && mainHistory.alignable) {
    bundles.push(alignMainHistory({ run, root, stateRoot, mainHistory, clock }));
  }

  const executionRoot = repositoryRoot(run, rootDir);
  // Persist drift transitions first: a retained branch whose head moved is parked
  // in RECOVERY (never auto-deleted) until a human resolves it.
  for (const item of freshAudit.items) {
    if (item.classification !== 'RECOVERY_REQUIRED' || !item.branch) continue;
    if (!inScope(item)) continue;
    const manifest = findManifestForBranch(readManifests(stateRoot), item.branch);
    if (manifest?.lifecyclePhase === 'RETENTION') {
      writeManifestFields(manifest, { lifecyclePhase: 'RECOVERY', status: 'RECOVERY_REQUIRED' }, clock);
      lifecycleActions.push({ outcome: 'RECOVERY', branch: item.branch, detail: item.detail ?? null });
    }
  }
  for (const item of freshAudit.items) {
    if (item.classification !== 'MERGED_CLEANUP' || item.kind === 'stale-ref' || item.kind === 'manifest') continue;
    if (!inScope(item)) continue;
    const branch = item.branch;
    if (!branch || branch === 'main' || processedBranches.has(branch)) continue;
    processedBranches.add(branch);
    const manifest = findManifestForBranch(readManifests(stateRoot), branch);
    const pr = includePullRequests
      ? (pullRequestProvider
          ? pullRequestProvider({ branch, repository: freshAudit.repository, root })
          : getPullRequest(run, freshAudit.repository, branch))
      : null;
    if (manifest?.lifecyclePhase === 'RETENTION') {
      // The audit overlay keeps unexpired holds out of MERGED_CLEANUP, so reaching
      // here means the retention window expired for an unpinned branch.
      lifecycleActions.push(finalizeRetainedBranch({
        run,
        root,
        repository: freshAudit.repository,
        stateRoot,
        manifest,
        pr,
        verifyRemoteAccount,
        clock,
        bundles
      }));
      continue;
    }
    lifecycleActions.push(beginRetention({
      run,
      root,
      repository: freshAudit.repository,
      stateRoot,
      branch,
      pr,
      clock,
      executionRoot
    }));
  }

  for (const item of freshAudit.items) {
    if (sessionId) break;
    if (item.classification !== 'SAFE_QUARANTINE' || item.kind !== 'physical-directory' || !item.path) continue;
    const rechecked = classifyPhysicalCandidate({ candidate: item.path, run, currentCommonGitDir: commonGitDirectory(run, root) });
    if (rechecked.classification !== 'SAFE_QUARANTINE') continue;
    quarantined.push(quarantineCandidate({ candidate: item.path, codexWorktreeRoot, stateRoot, clock }));
  }

  const cutoffMs = clock().getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const removedExpired = sessionId ? [] : [
    ...removeExpiredEntries(join(stateRoot, 'quarantine'), cutoffMs, (entry) => entry.isDirectory()),
    ...removeExpiredEntries(
      join(stateRoot, 'recovery'),
      cutoffMs,
      // Never sweep a bundle created by this very run, whatever the clock says.
      (entry, path) => entry.isFile() && entry.name.endsWith('.bundle')
        && !bundles.some((bundlePath) => pathsEqual(bundlePath, path))
    ),
    ...removeExpiredEntries(join(stateRoot, 'locks'), cutoffMs, (entry) => entry.isDirectory() && entry.name.startsWith('stale-')),
    ...removeExpiredReceipts(join(stateRoot, 'receipts'), cutoffMs)
  ];
  const finalAudit = collectAudit({ run, rootDir: root, stateRoot, codexWorktreeRoot, includePullRequests, pullRequestProvider, clock });
  return { applied: true, plannedActions, initialAudit: freshAudit, finalAudit, bundles, quarantined, lifecycleActions, removedExpired };
  } finally {
    lock.release();
  }
}
