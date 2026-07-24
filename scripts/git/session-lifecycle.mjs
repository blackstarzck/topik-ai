import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync
} from 'node:fs';
import { homedir, hostname } from 'node:os';
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep
} from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { expectedActorFor, sanitizedBaseEnv } from './account-context.mjs';

export const CLASSIFICATIONS = Object.freeze([
  'DETACHED_PROBE',
  'ACTIVE',
  'MERGED_CLEANUP',
  'ORPHAN_REVIEW',
  'DIRTY_BLOCKED',
  'SAFE_QUARANTINE',
  'FOREIGN_REPO',
  'RECOVERY_REQUIRED',
  'MAIN_HISTORY_DRIFT'
]);

export const RETENTION_DAYS = 7;

const STRICT_CLASSIFICATIONS = new Set([
  'MERGED_CLEANUP',
  'ORPHAN_REVIEW',
  'DIRTY_BLOCKED',
  'SAFE_QUARANTINE',
  'RECOVERY_REQUIRED',
  'MAIN_HISTORY_DRIFT'
]);

const GENERATED_DIRECTORY_NAMES = new Set(['.omx', '.vite', 'log', 'logs']);
const SOURCE_DIRECTORY_NAMES = new Set(['api', 'app', 'docs', 'public', 'scripts', 'src', 'supabase', 'tests']);
const SOURCE_FILE_NAMES = new Set([
  'package.json',
  'pnpm-lock.yaml',
  'package-lock.json',
  'yarn.lock',
  'vite.config.ts',
  'next.config.js',
  'next.config.mjs',
  'tsconfig.json'
]);
const SOURCE_EXTENSIONS = new Set([
  '.cjs', '.css', '.go', '.html', '.java', '.js', '.jsx', '.mjs', '.php', '.py', '.rb',
  '.rs', '.scss', '.sql', '.svelte', '.swift', '.ts', '.tsx', '.vue'
]);

function defaultStateRoot() {
  return process.env.AGENT_SESSION_ROOT || join(homedir(), '.agent-sessions', 'topik-ai');
}

function defaultCodexWorktreeRoot() {
  return process.env.CODEX_WORKTREE_ROOT || join(homedir(), '.codex', 'worktrees');
}

function defaultRun(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: 'utf8',
    env: {
      ...sanitizedBaseEnv(),
      GIT_TERMINAL_PROMPT: '0',
      GH_PROMPT_DISABLED: '1'
    },
    windowsHide: true
  });
  const stdout = result.stdout || '';
  const stderr = result.stderr || '';
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0 && !options.allowFailure) {
    const detail = (stderr || stdout).trim();
    throw new Error(`${command} ${args.join(' ')} failed (${result.status})${detail ? `: ${detail}` : ''}`);
  }
  return { status: result.status ?? 1, stdout, stderr };
}

function git(run, cwd, args, options = {}) {
  return run('git', ['-C', cwd, ...args], options);
}

function gh(run, args, options = {}) {
  return run('gh', args, options);
}

function normalizedPath(value) {
  const absolute = resolve(value);
  return process.platform === 'win32' ? absolute.toLowerCase() : absolute;
}

function pathsEqual(left, right) {
  return normalizedPath(left) === normalizedPath(right);
}

function isPathWithin(parent, child) {
  const rel = relative(resolve(parent), resolve(child));
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

function assertDirectChild(parent, child) {
  const rel = relative(resolve(parent), resolve(child));
  if (!rel || rel.startsWith('..') || isAbsolute(rel) || rel.includes(sep)) {
    throw new Error(`Refusing to mutate path outside the expected direct-child boundary: ${child}`);
  }
}

function nowIso(clock = () => new Date()) {
  return clock().toISOString();
}

function timestampForFile(clock = () => new Date()) {
  return nowIso(clock).replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function sanitizeName(value) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'session';
}

function parseOptions(argv) {
  const positional = [];
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      positional.push(token);
      continue;
    }
    const [rawName, inlineValue] = token.slice(2).split('=', 2);
    if (inlineValue !== undefined) {
      options[rawName] = inlineValue;
      continue;
    }
    const next = argv[index + 1];
    if (next && !next.startsWith('--')) {
      options[rawName] = next;
      index += 1;
    } else {
      options[rawName] = true;
    }
  }
  return { positional, options };
}

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
  mkdirSync(dirname(file), { recursive: true });
  const tempFile = `${file}.tmp-${process.pid}-${randomUUID().slice(0, 8)}`;
  writeFileSync(tempFile, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  // Windows AV/indexers can hold the destination briefly; bounded retries keep the
  // replace atomic without ever leaving a torn ledger file behind.
  let lastError = null;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      renameSync(tempFile, file);
      return;
    } catch (error) {
      lastError = error;
    }
  }
  rmSync(tempFile, { force: true });
  throw lastError;
}

function manifestFiles(stateRoot) {
  if (!existsSync(stateRoot)) return [];
  return readdirSync(stateRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => join(stateRoot, entry.name));
}

export function readManifests(stateRoot = defaultStateRoot()) {
  const manifests = [];
  for (const file of manifestFiles(stateRoot)) {
    try {
      manifests.push({ ...upgradeManifest(readJson(file)), manifestFile: file });
    } catch (error) {
      manifests.push({
        manifestFile: file,
        status: 'RECOVERY_REQUIRED',
        manifestError: error instanceof Error ? error.message : String(error)
      });
    }
  }
  return manifests;
}

export function parseWorktreePorcelain(output) {
  const records = [];
  let current = null;
  for (const line of output.split(/\r?\n/)) {
    if (!line) {
      if (current) records.push(current);
      current = null;
      continue;
    }
    const separator = line.indexOf(' ');
    const key = separator === -1 ? line : line.slice(0, separator);
    const value = separator === -1 ? true : line.slice(separator + 1);
    if (key === 'worktree') {
      if (current) records.push(current);
      current = { path: value, detached: false, locked: false, prunable: false };
      continue;
    }
    if (!current) continue;
    if (key === 'HEAD') current.head = value;
    if (key === 'branch') current.branch = String(value).replace(/^refs\/heads\//, '');
    if (key === 'detached') current.detached = true;
    if (key === 'locked') current.locked = value === true ? true : value;
    if (key === 'prunable') current.prunable = value === true ? true : value;
  }
  if (current) records.push(current);
  return records;
}

function repositoryRoot(run, cwd) {
  return git(run, cwd, ['rev-parse', '--show-toplevel']).stdout.trim();
}

function repositoryIdentity(run, root) {
  const remote = git(run, root, ['remote', 'get-url', 'origin'], { allowFailure: true }).stdout.trim();
  const match = remote.match(/(?:github\.com[/:])([^/]+\/[^/]+?)(?:\.git)?$/i);
  return match ? match[1] : basename(root);
}

function commonGitDirectory(run, root) {
  const value = git(run, root, ['rev-parse', '--git-common-dir']).stdout.trim();
  return resolve(root, value);
}

function worktreeRecords(run, root) {
  const records = parseWorktreePorcelain(git(run, root, ['worktree', 'list', '--porcelain']).stdout);
  return records.map((record) => {
    const status = existsSync(record.path)
      ? git(run, record.path, ['status', '--porcelain'], { allowFailure: true })
      : { status: 1, stdout: '', stderr: 'missing worktree path' };
    return {
      ...record,
      dirty: status.status !== 0 || status.stdout.trim().length > 0,
      statusError: status.status === 0 ? null : status.stderr.trim() || 'unable to read status'
    };
  });
}

function branchRecords(run, root) {
  const output = git(run, root, [
    'for-each-ref',
    '--format=%(refname:short)%00%(objectname)%00%(worktreepath)',
    'refs/heads'
  ]).stdout;
  return output.split(/\r?\n/).filter(Boolean).map((line) => {
    const [branch, oid, worktreePath] = line.split('\0');
    return { branch, oid, worktreePath: worktreePath || null };
  });
}

function remoteBranchRecords(run, root) {
  const output = git(run, root, [
    'for-each-ref',
    '--format=%(refname:short)%00%(objectname)',
    'refs/remotes/origin'
  ]).stdout;
  return output.split(/\r?\n/).filter(Boolean).map((line) => {
    const [shortName, oid] = line.split('\0');
    return { branch: shortName.replace(/^origin\//, ''), oid, ref: `refs/remotes/${shortName}` };
  }).filter((record) => record.branch !== 'HEAD');
}

function branchMergedIntoMain(run, root, branch) {
  return git(run, root, ['merge-base', '--is-ancestor', branch, 'origin/main'], { allowFailure: true }).status === 0;
}

function getPullRequest(run, repository, branch) {
  if (!repository.includes('/')) return null;
  const result = gh(run, [
    'pr', 'list', '--repo', repository, '--state', 'all', '--head', branch, '--limit', '20',
    '--json', 'number,state,isDraft,mergedAt,baseRefName,headRefName,headRefOid,title,url'
  ], { allowFailure: true });
  if (result.status !== 0) return null;
  try {
    const prs = JSON.parse(result.stdout);
    return prs.find((pr) => pr.state === 'OPEN') || prs.find((pr) => pr.state === 'MERGED') || prs[0] || null;
  } catch {
    return null;
  }
}

function findManifestForWorktree(manifests, path) {
  return manifests.find((manifest) => manifest.worktreePath && pathsEqual(manifest.worktreePath, path)) || null;
}

function findManifestForBranch(manifests, branch) {
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

function scanCandidate(candidate, maxDepth = 4) {
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

function physicalCandidates(codexWorktreeRoot) {
  if (!existsSync(codexWorktreeRoot)) return [];
  return readdirSync(codexWorktreeRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(codexWorktreeRoot, entry.name));
}

function staleOriginRefs(run, root) {
  const result = git(run, root, ['remote', 'prune', '--dry-run', 'origin'], { allowFailure: true });
  if (result.status !== 0) return [];
  return result.stdout.split(/\r?\n/)
    .map((line) => line.match(/\[would prune\]\s+origin\/(.+)$/)?.[1])
    .filter(Boolean);
}

export function collectAudit({
  run = defaultRun,
  rootDir = process.cwd(),
  stateRoot = defaultStateRoot(),
  codexWorktreeRoot = defaultCodexWorktreeRoot(),
  includePullRequests = true,
  pullRequestProvider = null
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
    items.push({
      classification: classifySession({ branch: branch.branch, dirty: false, detached: false, pr, mergedIntoMain, manifest }),
      kind: 'branch',
      id: branch.branch,
      path: null,
      branch: branch.branch,
      prNumber: pr?.number || null,
      detail: pr ? `PR #${pr.number} ${pr.state.toLowerCase()}` : 'local branch without a worktree'
    });
  }

  const localBranchNames = new Set(branches.map((record) => record.branch));
  for (const remoteBranch of remoteBranchRecords(run, root)) {
    if (remoteBranch.branch === 'main' || localBranchNames.has(remoteBranch.branch)) continue;
    const pr = pullRequest(remoteBranch.branch);
    const mergedIntoMain = branchMergedIntoMain(run, root, `origin/${remoteBranch.branch}`);
    const classification = pr?.state === 'MERGED' || (!pr && mergedIntoMain)
      ? 'MERGED_CLEANUP'
      : pr?.state === 'OPEN'
        ? 'ACTIVE'
        : 'ORPHAN_REVIEW';
    items.push({
      classification,
      kind: 'remote-branch',
      id: `origin/${remoteBranch.branch}`,
      path: null,
      branch: remoteBranch.branch,
      prNumber: pr?.number || null,
      detail: pr
        ? `remote head for PR #${pr.number} ${pr.state.toLowerCase()}`
        : mergedIntoMain
          ? 'remote head is already an ancestor of origin/main'
          : 'remote head without a matching PR'
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

function manifestPathForId(stateRoot, worktreeId) {
  return join(stateRoot, `${sanitizeName(worktreeId)}.json`);
}

function worktreeIdFromPath(path, codexWorktreeRoot) {
  if (isPathWithin(codexWorktreeRoot, path)) {
    const rel = relative(codexWorktreeRoot, path).split(/[\\/]/)[0];
    if (rel) return rel;
  }
  return sanitizeName(`${basename(path)}-${randomUUID().slice(0, 8)}`);
}

function normalizedTask(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function createDetachedWorktree({ run, root, codexWorktreeRoot }) {
  const worktreeId = randomUUID().slice(0, 8);
  const worktreePath = join(codexWorktreeRoot, worktreeId, basename(root));
  if (existsSync(worktreePath)) throw new Error(`worktree path already exists: ${worktreePath}`);
  mkdirSync(dirname(worktreePath), { recursive: true });
  try {
    git(run, root, ['worktree', 'add', '--detach', worktreePath, 'origin/main']);
  } catch (error) {
    if (existsSync(dirname(worktreePath)) && readdirSync(dirname(worktreePath)).length === 0) {
      rmSync(dirname(worktreePath), { recursive: true, force: true });
    }
    throw error;
  }
  return { worktreeId, worktreePath };
}

export const MANIFEST_SCHEMA_VERSION = 2;
export const LIFECYCLE_PHASES = Object.freeze(['ACTIVE', 'RETENTION', 'RECOVERY', 'CLOSED']);

// Test fixture repositories are not in the AGENTS §11.1 account mapping, so the
// expected actor degrades to null instead of failing session bookkeeping.
function safeExpectedActor(repositorySlug) {
  try {
    return expectedActorFor(repositorySlug);
  } catch {
    return null;
  }
}

export function upgradeManifest(manifest) {
  if (!manifest || (manifest.schemaVersion ?? 0) >= MANIFEST_SCHEMA_VERSION) return manifest;
  return {
    ...manifest,
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    expectedActor: manifest.expectedActor ?? safeExpectedActor(manifest.repository),
    lifecyclePhase: manifest.lifecyclePhase ?? 'ACTIVE',
    cleanupStep: manifest.cleanupStep ?? 'NONE',
    prHeadSha: manifest.prHeadSha ?? null,
    prBaseRef: manifest.prBaseRef ?? null,
    mergedAt: manifest.mergedAt ?? null,
    retentionStartedAt: manifest.retentionStartedAt ?? null,
    branchExpiresAt: manifest.branchExpiresAt ?? null,
    pinned: manifest.pinned ?? false,
    pinnedAt: manifest.pinnedAt ?? null,
    localHeadSha: manifest.localHeadSha ?? null,
    remoteHeadSha: manifest.remoteHeadSha ?? null,
    remoteDeletedByGitHub: manifest.remoteDeletedByGitHub ?? false,
    worktreeRemovedAt: manifest.worktreeRemovedAt ?? null
  };
}

function makeManifest({ repository, repositoryRoot: root, worktreeId, worktreePath, agent, taskSummary, branch, pr, status, dirty, createdAt, clock, previous = null }) {
  const timestamp = nowIso(clock);
  return {
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    repository,
    repositoryRoot: root,
    worktreeId,
    worktreePath,
    agent,
    taskSummary,
    branch: branch || null,
    pullRequestNumber: pr?.number || previous?.pullRequestNumber || null,
    pullRequestUrl: pr?.url || previous?.pullRequestUrl || null,
    status,
    dirty: Boolean(dirty),
    expectedActor: previous?.expectedActor ?? safeExpectedActor(repository),
    lifecyclePhase: previous?.lifecyclePhase ?? 'ACTIVE',
    cleanupStep: previous?.cleanupStep ?? 'NONE',
    prHeadSha: pr?.headRefOid ?? previous?.prHeadSha ?? null,
    prBaseRef: pr?.baseRefName ?? previous?.prBaseRef ?? null,
    mergedAt: pr?.mergedAt ?? previous?.mergedAt ?? null,
    retentionStartedAt: previous?.retentionStartedAt ?? null,
    branchExpiresAt: previous?.branchExpiresAt ?? null,
    pinned: previous?.pinned ?? false,
    pinnedAt: previous?.pinnedAt ?? null,
    localHeadSha: previous?.localHeadSha ?? null,
    remoteHeadSha: previous?.remoteHeadSha ?? null,
    remoteDeletedByGitHub: previous?.remoteDeletedByGitHub ?? false,
    worktreeRemovedAt: previous?.worktreeRemovedAt ?? null,
    createdAt: createdAt || timestamp,
    updatedAt: timestamp
  };
}

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

function createVerifiedBundle({ run, root, branch, sourceRef = `refs/heads/${branch}`, recoveryRoot, clock = () => new Date() }) {
  mkdirSync(recoveryRoot, { recursive: true });
  const bundlePath = join(recoveryRoot, `${sanitizeName(branch)}-${timestampForFile(clock)}.bundle`);
  git(run, root, ['bundle', 'create', bundlePath, sourceRef]);
  const verification = git(run, root, ['bundle', 'verify', bundlePath], { allowFailure: true });
  if (verification.status !== 0) {
    throw new Error(`Bundle verification failed for ${branch}: ${(verification.stderr || verification.stdout).trim()}`);
  }
  return bundlePath;
}

function removeManifestsForBranchOrWorktree(stateRoot, branch, worktreePath) {
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
function ensureExpectedRemoteActor(run, repository) {
  const expected = expectedActorFor(repository);
  const login = gh(run, ['api', 'user', '--jq', '.login']).stdout.trim();
  if (login !== expected) {
    throw new Error(`Remote branch cleanup for ${repository} requires ${expected}; active account is ${login || 'unknown'}`);
  }
}

function remoteBranchExists(run, root, branch) {
  const result = git(run, root, ['ls-remote', '--heads', 'origin', `refs/heads/${branch}`], { allowFailure: true });
  return result.status === 0 && result.stdout.trim().length > 0;
}

function alignMainHistory({ run, root, stateRoot, mainHistory, clock }) {
  if (!mainHistory.alignable) throw new Error('main history does not satisfy guarded alignment conditions');
  const bundlePath = createVerifiedBundle({ run, root, branch: 'main', recoveryRoot: join(stateRoot, 'recovery'), clock });
  git(run, mainHistory.mainWorktree, ['reset', '--keep', 'origin/main']);
  return bundlePath;
}

function quarantineCandidate({ candidate, codexWorktreeRoot, stateRoot, clock }) {
  assertDirectChild(codexWorktreeRoot, candidate);
  const quarantineRoot = join(stateRoot, 'quarantine', timestampForFile(clock));
  mkdirSync(quarantineRoot, { recursive: true });
  const destination = join(quarantineRoot, basename(candidate));
  if (existsSync(destination)) throw new Error(`quarantine destination already exists: ${destination}`);
  renameSync(candidate, destination);
  return destination;
}

function removeExpiredEntries(root, cutoffMs, filter = () => true) {
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

const LOCK_STALE_MS = 15 * 60 * 1000;

function processAlive(pid) {
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

function buildSessionScope(manifests, sessionId) {
  const matches = manifests.filter((manifest) => manifest.worktreeId === sessionId);
  if (matches.length === 0) return null;
  return {
    branches: new Set(matches.map((manifest) => manifest.branch).filter(Boolean)),
    paths: matches.map((manifest) => manifest.worktreePath).filter(Boolean)
  };
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
  const initialAudit = collectAudit({ run, rootDir, stateRoot, codexWorktreeRoot, includePullRequests, pullRequestProvider });
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
  if (!apply) return { applied: false, plannedActions, initialAudit, finalAudit: initialAudit, bundles: [], quarantined: [], removedExpired: [] };

  const lock = acquireRepoLock({ stateRoot, repository: initialAudit.repository, command: 'cleanup', clock });
  try {
  const root = initialAudit.repositoryRoot;
  git(run, root, ['fetch', 'origin', '--prune']);
  const freshAudit = collectAudit({ run, rootDir: root, stateRoot, codexWorktreeRoot, includePullRequests, pullRequestProvider });
  const bundles = [];
  const quarantined = [];
  const processedBranches = new Set();

  const mainHistory = evaluateMainHistory({ run, rootDir: root });
  if (!sessionId && mainHistory.drift && mainHistory.alignable) {
    bundles.push(alignMainHistory({ run, root, stateRoot, mainHistory, clock }));
  }

  for (const item of freshAudit.items) {
    if (item.classification !== 'MERGED_CLEANUP' || item.kind === 'stale-ref') continue;
    if (!inScope(item)) continue;
    const branch = item.branch;
    if (!branch || branch === 'main' || processedBranches.has(branch)) continue;
    processedBranches.add(branch);
    if (item.kind === 'remote-branch') {
      const remoteRef = `origin/${branch}`;
      if (!branchMergedIntoMain(run, root, remoteRef)) {
        bundles.push(createVerifiedBundle({
          run,
          root,
          branch,
          sourceRef: `refs/remotes/origin/${branch}`,
          recoveryRoot: join(stateRoot, 'recovery'),
          clock
        }));
      }
      verifyRemoteAccount(run, freshAudit.repository);
      git(run, root, ['push', 'origin', '--delete', branch]);
      removeManifestsForBranchOrWorktree(stateRoot, branch, null);
      continue;
    }
    const record = branchRecords(run, root).find((candidate) => candidate.branch === branch);
    if (!record) continue;
    if (record.worktreePath) {
      const status = git(run, record.worktreePath, ['status', '--porcelain'], { allowFailure: true });
      if (status.status !== 0 || status.stdout.trim()) continue;
    }
    if (!branchMergedIntoMain(run, root, branch)) {
      bundles.push(createVerifiedBundle({ run, root, branch, recoveryRoot: join(stateRoot, 'recovery'), clock }));
    }
    if (record.worktreePath && !pathsEqual(record.worktreePath, root)) {
      git(run, root, ['worktree', 'remove', record.worktreePath]);
    }
    git(run, root, ['branch', branchMergedIntoMain(run, root, branch) ? '-d' : '-D', branch]);
    const pr = includePullRequests
      ? (pullRequestProvider
          ? pullRequestProvider({ branch, repository: freshAudit.repository, root })
          : getPullRequest(run, freshAudit.repository, branch))
      : null;
    if (pr?.state === 'MERGED' && remoteBranchExists(run, root, branch)) {
      verifyRemoteAccount(run, freshAudit.repository);
      git(run, root, ['push', 'origin', '--delete', branch]);
    }
    removeManifestsForBranchOrWorktree(stateRoot, branch, record.worktreePath);
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
    ...removeExpiredEntries(join(stateRoot, 'recovery'), cutoffMs, (entry) => entry.isFile() && entry.name.endsWith('.bundle')),
    ...removeExpiredEntries(join(stateRoot, 'locks'), cutoffMs, (entry) => entry.isDirectory() && entry.name.startsWith('stale-'))
  ];
  const finalAudit = collectAudit({ run, rootDir: root, stateRoot, codexWorktreeRoot, includePullRequests, pullRequestProvider });
  return { applied: true, plannedActions, initialAudit: freshAudit, finalAudit, bundles, quarantined, removedExpired };
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
    '  npm run git:sessions:cleanup -- [--apply] [--session <worktreeId>]',
    '  npm run git:session -- archive --branch <name> [--apply]',
    '',
    'cleanup and archive are dry-run unless --apply is supplied.'
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
