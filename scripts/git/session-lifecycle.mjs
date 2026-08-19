import { existsSync, readdirSync, rmSync, unlinkSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  defaultCodexWorktreeRoot,
  defaultRun,
  defaultStateRoot,
  git,
  normalizedPath,
  nowIso,
  parseOptions,
  pathsEqual,
  readJson,
  sanitizeName,
  writeJson
} from './session-core.mjs';
import {
  branchMergedIntoMain,
  branchRecords,
  getPullRequest,
  parseWorktreePorcelain,
  repositoryIdentity,
  repositoryRoot
} from './session-git.mjs';
import {
  MANIFEST_SCHEMA_VERSION,
  createDetachedWorktree,
  makeManifest,
  manifestPathForId,
  normalizedTask,
  readManifests,
  worktreeIdFromPath
} from './session-manifest.mjs';
import {
  classifySession,
  collectAudit,
  findManifestForBranch,
  findManifestForWorktree,
  formatAudit
} from './session-audit.mjs';
import {
  acquireRepoLock,
  archiveBranch,
  beginRetention,
  cleanupSessions,
  writeManifestFields
} from './session-cleanup.mjs';

// 세션 명령 진입점 — 시작/동기화/등록과 재조정·핀·상태, 그리고 CLI 라우팅만 남기고
// 나머지 계층은 session-{core,git,manifest,audit,cleanup}.mjs 로 분해했다.
// 아래 재수출은 외부(테스트·다른 스크립트) import 경로를 그대로 유지하기 위한 것이다.
export {
  CLASSIFICATIONS,
  RETENTION_DAYS,
  defaultRun
} from './session-core.mjs';
export { parseWorktreePorcelain } from './session-git.mjs';
export {
  LIFECYCLE_PHASES,
  MANIFEST_SCHEMA_VERSION,
  readManifests,
  upgradeManifest
} from './session-manifest.mjs';
export {
  applyRetentionOverlay,
  classifyPhysicalCandidate,
  classifySession,
  collectAudit,
  evaluateMainHistory,
  formatAudit
} from './session-audit.mjs';
export { acquireRepoLock, archiveBranch, cleanupSessions } from './session-cleanup.mjs';

export function startSession({
  agent,
  taskSummary,
  run = defaultRun,
  rootDir = process.cwd(),
  stateRoot = defaultStateRoot(),
  codexWorktreeRoot = defaultCodexWorktreeRoot(),
  clock = () => new Date()
}) {
  if (!['codex', 'claude'].includes(agent)) throw new Error('--agent must be codex or claude');
  if (!taskSummary || !taskSummary.trim()) throw new Error('--task is required');
  const root = repositoryRoot(run, rootDir);
  const repository = repositoryIdentity(run, root);
  const taskKey = normalizedTask(taskSummary);
  const existing = readManifests(stateRoot).find((manifest) => {
    const existingTask = normalizedTask(manifest.taskSummary);
    return manifest.repository === repository
      && existingTask === taskKey;
  });
  const registeredWorktreePaths = parseWorktreePorcelain(
    git(run, root, ['worktree', 'list', '--porcelain']).stdout
  ).map((record) => record.path);
  if (
    existing?.worktreePath
    && existsSync(existing.worktreePath)
    && registeredWorktreePaths.some((path) => pathsEqual(path, existing.worktreePath))
  ) {
    return { reused: true, manifest: existing, message: `Reusing ${existing.worktreePath}` };
  }

  const lock = acquireRepoLock({ stateRoot, repository, command: 'start', clock });
  try {
  git(run, root, ['fetch', 'origin', '--prune']);
  try {
    // Best-effort reconciliation of PRs merged on the web or another machine —
    // never blocks session start.
    reconcileCore({
      run,
      root,
      repository,
      stateRoot,
      codexWorktreeRoot,
      includePullRequests: true,
      pullRequestProvider: null,
      clock,
      executionRoot: root
    });
  } catch {
    // fall through to a normal session start
  }
  const branches = branchRecords(run, root).filter((record) => record.branch !== 'main');
  let continuation = existing?.branch
    ? branches.find((record) => record.branch === existing.branch)
    : null;
  if (!continuation) {
    continuation = branches.find((record) => {
      const pr = getPullRequest(run, repository, record.branch);
      const branchTask = normalizedTask(record.branch.split('/').at(-1).replace(/[-_]+/g, ' '));
      return normalizedTask(pr?.title) === taskKey || branchTask === taskKey;
    });
  }
  if (continuation?.worktreePath && existsSync(continuation.worktreePath)) {
    const continuationPr = getPullRequest(run, repository, continuation.branch);
    const dirty = git(run, continuation.worktreePath, ['status', '--porcelain'], { allowFailure: true }).stdout.trim() !== '';
    const worktreeId = worktreeIdFromPath(continuation.worktreePath, codexWorktreeRoot);
    const manifest = makeManifest({
      repository,
      repositoryRoot: root,
      worktreeId,
      worktreePath: continuation.worktreePath,
      agent: existing?.agent || agent,
      taskSummary: existing?.taskSummary || taskSummary.trim(),
      branch: continuation.branch,
      pr: continuationPr,
      status: dirty ? 'DIRTY_BLOCKED' : 'ACTIVE',
      dirty,
      createdAt: existing?.createdAt,
      clock,
      previous: existing
    });
    const manifestFile = manifestPathForId(stateRoot, worktreeId);
    if (existing?.manifestFile && existing.manifestFile !== manifestFile && existsSync(existing.manifestFile)) {
      unlinkSync(existing.manifestFile);
    }
    writeJson(manifestFile, manifest);
    return {
      reused: true,
      manifest,
      message: `Reusing ${continuation.worktreePath}`
    };
  }

  const { worktreeId, worktreePath } = createDetachedWorktree({ run, root, codexWorktreeRoot });
  if (continuation) {
    try {
      git(run, worktreePath, ['switch', continuation.branch]);
    } catch (error) {
      git(run, root, ['worktree', 'remove', '--force', worktreePath], { allowFailure: true });
      const worktreeParent = dirname(worktreePath);
      if (existsSync(worktreeParent) && readdirSync(worktreeParent).length === 0) {
        rmSync(worktreeParent, { recursive: true, force: true });
      }
      throw error;
    }
  }
  const continuationPr = continuation ? getPullRequest(run, repository, continuation.branch) : null;
  const manifest = makeManifest({
    repository,
    repositoryRoot: root,
    worktreeId,
    worktreePath,
    agent,
    taskSummary: taskSummary.trim(),
    branch: continuation?.branch || null,
    pr: continuationPr,
    status: continuation ? 'ACTIVE' : 'DETACHED_PROBE',
    dirty: false,
    clock,
    previous: existing
  });
  if (existing?.manifestFile && existsSync(existing.manifestFile)) unlinkSync(existing.manifestFile);
  writeJson(manifestPathForId(stateRoot, worktreeId), manifest);
  return {
    reused: Boolean(continuation),
    manifest,
    message: continuation
      ? `Created detached worktree and attached existing branch ${continuation.branch}`
      : `Created detached worktree ${worktreePath}`
  };
  } finally {
    lock.release();
  }
}

export function syncSession({
  run = defaultRun,
  worktreeDir = process.cwd(),
  stateRoot = defaultStateRoot(),
  codexWorktreeRoot = defaultCodexWorktreeRoot(),
  agent = process.env.AGENT_NAME || 'codex',
  taskSummary = 'Unregistered existing session',
  clock = () => new Date()
} = {}) {
  const root = repositoryRoot(run, worktreeDir);
  const repository = repositoryIdentity(run, root);
  const actualWorktree = git(run, worktreeDir, ['rev-parse', '--show-toplevel']).stdout.trim();
  const manifests = readManifests(stateRoot);
  const existing = findManifestForWorktree(manifests, actualWorktree);
  const branchResult = git(run, actualWorktree, ['symbolic-ref', '--quiet', '--short', 'HEAD'], { allowFailure: true });
  const branch = branchResult.status === 0 ? branchResult.stdout.trim() : null;
  const dirty = git(run, actualWorktree, ['status', '--porcelain']).stdout.trim() !== '';
  const pr = branch ? getPullRequest(run, repository, branch) : null;
  const mergedIntoMain = branch && branch !== 'main' ? branchMergedIntoMain(run, root, branch) : false;
  const status = classifySession({ branch, detached: !branch, dirty, pr, mergedIntoMain, manifest: existing });
  const worktreeId = existing?.worktreeId || worktreeIdFromPath(actualWorktree, codexWorktreeRoot);
  const manifest = makeManifest({
    repository,
    repositoryRoot: root,
    worktreeId,
    worktreePath: actualWorktree,
    agent: existing?.agent || agent,
    taskSummary: existing?.taskSummary || taskSummary,
    branch,
    pr,
    status,
    dirty,
    createdAt: existing?.createdAt,
    clock,
    previous: existing
  });
  writeJson(existing?.manifestFile || manifestPathForId(stateRoot, worktreeId), manifest);
  return manifest;
}

export function registerBranchSession({
  branch,
  agent = 'codex',
  taskSummary,
  run = defaultRun,
  rootDir = process.cwd(),
  stateRoot = defaultStateRoot(),
  clock = () => new Date()
}) {
  if (!branch) throw new Error('--branch is required when registering a branch session');
  if (!['codex', 'claude'].includes(agent)) throw new Error('--agent must be codex or claude');
  if (!taskSummary || !taskSummary.trim()) throw new Error('--task is required when registering a branch session');
  const root = repositoryRoot(run, rootDir);
  const repository = repositoryIdentity(run, root);
  const record = branchRecords(run, root).find((item) => item.branch === branch);
  if (!record) throw new Error(`local branch does not exist: ${branch}`);
  const pr = getPullRequest(run, repository, branch);
  const mergedIntoMain = branchMergedIntoMain(run, root, branch);
  let dirty = false;
  if (record.worktreePath) {
    const status = git(run, record.worktreePath, ['status', '--porcelain'], { allowFailure: true });
    dirty = status.status !== 0 || status.stdout.trim().length > 0;
  }
  const status = classifySession({
    branch,
    detached: false,
    dirty,
    pr,
    mergedIntoMain,
    manifest: null
  });
  const worktreeId = `branch-${sanitizeName(branch)}`;
  const manifest = makeManifest({
    repository,
    repositoryRoot: root,
    worktreeId,
    worktreePath: record.worktreePath,
    agent,
    taskSummary: taskSummary.trim(),
    branch,
    pr,
    status,
    dirty,
    clock
  });
  writeJson(manifestPathForId(stateRoot, worktreeId), manifest);
  return manifest;
}

// Reconciliation converges sessions whose PRs merged outside this machine (web UI
// or another PC): it starts retention windows and removes eligible worktrees, but
// never deletes a branch — expiry finalization stays exclusive to cleanup --apply.
function reconcileCore({
  run,
  root,
  repository,
  stateRoot,
  codexWorktreeRoot,
  includePullRequests,
  pullRequestProvider,
  clock,
  executionRoot
}) {
  git(run, root, ['fetch', 'origin', '--prune']);
  const result = { retentionStarted: [], worktreesRemoved: [], upgraded: [], blocked: [] };
  for (const manifest of readManifests(stateRoot)) {
    if (manifest.manifestError || !manifest.manifestFile) continue;
    if (manifest.repository && manifest.repository !== repository) continue;
    let rawVersion = null;
    try {
      rawVersion = readJson(manifest.manifestFile).schemaVersion ?? 1;
    } catch {
      continue;
    }
    if (rawVersion < MANIFEST_SCHEMA_VERSION) {
      const upgraded = { ...manifest };
      delete upgraded.manifestFile;
      writeJson(manifest.manifestFile, upgraded);
      result.upgraded.push(manifest.worktreeId ?? basename(manifest.manifestFile, '.json'));
    }
  }
  const audit = collectAudit({ run, rootDir: root, stateRoot, codexWorktreeRoot, includePullRequests, pullRequestProvider, clock });
  const processed = new Set();
  for (const item of audit.items) {
    if (item.classification !== 'MERGED_CLEANUP' || item.kind === 'stale-ref' || item.kind === 'manifest') continue;
    const branch = item.branch;
    if (!branch || branch === 'main' || processed.has(branch)) continue;
    processed.add(branch);
    const manifest = findManifestForBranch(readManifests(stateRoot), branch);
    if (manifest?.lifecyclePhase === 'RETENTION') continue;
    const pr = includePullRequests
      ? (pullRequestProvider
          ? pullRequestProvider({ branch, repository, root })
          : getPullRequest(run, repository, branch))
      : null;
    const action = beginRetention({ run, root, repository, stateRoot, branch, pr, clock, executionRoot });
    if (action.outcome === 'RETENTION_STARTED') {
      result.retentionStarted.push(branch);
      if (action.worktreeRemoved) result.worktreesRemoved.push(branch);
    } else if (action.outcome !== 'CLOSED') {
      result.blocked.push({ branch, reason: action.outcome, detail: action.detail ?? null });
    }
  }
  return result;
}

export function reconcileSessions({
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
  const lock = acquireRepoLock({ stateRoot, repository, command: 'reconcile', clock });
  try {
    return reconcileCore({
      run,
      root,
      repository,
      stateRoot,
      codexWorktreeRoot,
      includePullRequests,
      pullRequestProvider,
      clock,
      executionRoot: repositoryRoot(run, rootDir)
    });
  } finally {
    lock.release();
  }
}

export function pinBranch({
  branch,
  unpin = false,
  run = defaultRun,
  rootDir = process.cwd(),
  stateRoot = defaultStateRoot(),
  clock = () => new Date()
}) {
  if (!branch) throw new Error('--branch is required');
  const root = repositoryRoot(run, rootDir);
  const repository = repositoryIdentity(run, root);
  const lock = acquireRepoLock({ stateRoot, repository, command: 'pin', clock });
  try {
    const existing = findManifestForBranch(readManifests(stateRoot), branch);
    if (!existing || !existing.manifestFile) {
      throw new Error(`no session manifest for branch ${branch}; register it with git:session -- sync --branch first`);
    }
    return writeManifestFields(existing, {
      pinned: !unpin,
      pinnedAt: unpin ? null : nowIso(clock)
    }, clock);
  } finally {
    lock.release();
  }
}

export function statusSessions({
  run = defaultRun,
  rootDir = process.cwd(),
  stateRoot = defaultStateRoot(),
  codexWorktreeRoot = defaultCodexWorktreeRoot(),
  includePullRequests = false,
  pullRequestProvider = null,
  clock = () => new Date()
} = {}) {
  const audit = collectAudit({ run, rootDir, stateRoot, codexWorktreeRoot, includePullRequests, pullRequestProvider });
  const manifests = readManifests(stateRoot).filter((manifest) => !manifest.repository || manifest.repository === audit.repository);
  const auditByBranch = new Map();
  const auditByPath = new Map();
  for (const item of audit.items) {
    if (item.branch && !auditByBranch.has(item.branch)) auditByBranch.set(item.branch, item);
    if (item.path && !auditByPath.has(normalizedPath(item.path))) auditByPath.set(normalizedPath(item.path), item);
  }
  const sessions = manifests.map((manifest) => {
    const item = (manifest.branch && auditByBranch.get(manifest.branch))
      || (manifest.worktreePath && auditByPath.get(normalizedPath(manifest.worktreePath)))
      || null;
    return {
      worktreeId: manifest.worktreeId ?? null,
      agent: manifest.agent ?? null,
      branch: manifest.branch ?? null,
      worktreePath: manifest.worktreePath ?? null,
      pullRequestNumber: manifest.pullRequestNumber ?? null,
      lifecyclePhase: manifest.lifecyclePhase ?? 'ACTIVE',
      classification: item?.classification ?? manifest.status ?? null,
      prHeadSha: manifest.prHeadSha ?? null,
      branchExpiresAt: manifest.branchExpiresAt ?? null,
      pinned: Boolean(manifest.pinned),
      dirty: manifest.dirty ?? null
    };
  });
  const recoveryRoot = join(stateRoot, 'recovery');
  const residues = existsSync(recoveryRoot)
    ? readdirSync(recoveryRoot, { withFileTypes: true })
      .filter((entry) => !(entry.isFile() && entry.name.endsWith('.bundle')))
      .map((entry) => entry.name)
    : [];
  const receiptsRoot = join(stateRoot, 'receipts');
  const receipts = existsSync(receiptsRoot) ? readdirSync(receiptsRoot).length : 0;
  const lockDir = join(stateRoot, 'locks', `${sanitizeName(audit.repository)}.lock`);
  let lockOwner = null;
  if (existsSync(lockDir)) {
    try {
      lockOwner = readJson(join(lockDir, 'owner.json'));
    } catch {
      lockOwner = { unreadable: true };
    }
  }
  return {
    repository: audit.repository,
    generatedAt: nowIso(clock),
    counts: audit.counts,
    strictFailureCount: audit.strictFailureCount,
    lock: { held: Boolean(lockOwner), owner: lockOwner },
    sessions,
    receipts,
    residues
  };
}

export function formatStatus(status) {
  const columns = [
    ['ID', (row) => row.worktreeId ?? '-'],
    ['AGENT', (row) => row.agent ?? '-'],
    ['PHASE', (row) => row.lifecyclePhase ?? '-'],
    ['CLASS', (row) => row.classification ?? '-'],
    ['BRANCH', (row) => row.branch ?? '-'],
    ['PR', (row) => (row.pullRequestNumber ? `#${row.pullRequestNumber}` : '-')],
    ['HEAD', (row) => (row.prHeadSha ? row.prHeadSha.slice(0, 7) : '-')],
    ['EXPIRES', (row) => row.branchExpiresAt ?? '-'],
    ['PIN', (row) => (row.pinned ? 'pin' : '-')],
    ['DIRTY', (row) => (row.dirty === null ? '-' : row.dirty ? 'yes' : 'no')]
  ];
  const rows = status.sessions.map((session) => columns.map(([, pick]) => String(pick(session))));
  const widths = columns.map(([header], index) => Math.max(header.length, ...rows.map((row) => row[index].length), 1));
  const lines = [
    columns.map(([header], index) => header.padEnd(widths[index])).join('  '),
    ...rows.map((row) => row.map((cell, index) => cell.padEnd(widths[index])).join('  '))
  ];
  lines.push('');
  lines.push(`repository=${status.repository} strictFailures=${status.strictFailureCount} receipts=${status.receipts}`);
  lines.push(`lock=${status.lock.held ? `held by pid ${status.lock.owner?.pid ?? '?'} (${status.lock.owner?.command ?? '?'})` : 'free'}`);
  if (status.residues.length > 0) {
    lines.push(`recovery residues (manual review, never auto-deleted): ${status.residues.join(', ')}`);
  }
  return lines.join('\n');
}

function usage() {
  return [
    'Usage:',
    '  npm run git:session -- start --agent <codex|claude> --task <summary>',
    '  npm run git:session -- sync [--branch <existing> --agent <codex|claude> --task <summary>]',
    '  npm run git:sessions:audit -- [--json] [--strict]',
    '  npm run git:sessions:status -- [--json]',
    '  npm run git:sessions:reconcile',
    '  npm run git:sessions:cleanup -- [--apply] [--session <worktreeId>]',
    '  npm run git:branch:pin -- --branch <name> [--unpin]',
    '  npm run git:session -- archive --branch <name> [--apply]',
    '',
    'cleanup and archive are dry-run unless --apply is supplied.',
    'merged branches are retained read-only for 7 days before deletion; pin exempts a branch from expiry.'
  ].join('\n');
}

async function main(argv) {
  const { positional, options } = parseOptions(argv);
  const command = positional[0];
  if (command === 'start') {
    const result = startSession({ agent: options.agent, taskSummary: options.task });
    console.log(JSON.stringify(result, null, 2));
    return 0;
  }
  if (command === 'sync') {
    const result = options.branch
      ? registerBranchSession({ branch: options.branch, agent: options.agent || 'codex', taskSummary: options.task })
      : syncSession();
    console.log(JSON.stringify(result, null, 2));
    return 0;
  }
  if (command === 'audit') {
    const audit = collectAudit();
    console.log(options.json ? JSON.stringify(audit, null, 2) : formatAudit(audit));
    return options.strict && audit.strictFailureCount > 0 ? 2 : 0;
  }
  if (command === 'status') {
    const status = statusSessions();
    console.log(options.json ? JSON.stringify(status, null, 2) : formatStatus(status));
    return 0;
  }
  if (command === 'reconcile') {
    const result = reconcileSessions();
    console.log(JSON.stringify(result, null, 2));
    return 0;
  }
  if (command === 'pin') {
    const result = pinBranch({ branch: options.branch, unpin: Boolean(options.unpin) });
    console.log(JSON.stringify(result, null, 2));
    return 0;
  }
  if (command === 'cleanup') {
    const result = cleanupSessions({
      apply: Boolean(options.apply),
      sessionId: typeof options.session === 'string' ? options.session : null
    });
    console.log(JSON.stringify(result, null, 2));
    return 0;
  }
  if (command === 'archive') {
    const result = archiveBranch({ branch: options.branch, apply: Boolean(options.apply) });
    console.log(JSON.stringify(result, null, 2));
    return 0;
  }
  console.log(usage());
  return command ? 1 : 0;
}

const isDirectExecution = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isDirectExecution) {
  main(process.argv.slice(2)).then(
    (exitCode) => { process.exitCode = exitCode; },
    (error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
  );
}
