import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';

import {
  MANIFEST_SCHEMA_VERSION,
  archiveBranch,
  classifyPhysicalCandidate,
  classifySession,
  collectAudit,
  cleanupSessions,
  evaluateMainHistory,
  formatStatus,
  parseWorktreePorcelain,
  readManifests,
  registerBranchSession,
  startSession,
  statusSessions,
  syncSession,
  upgradeManifest
} from '../../scripts/git/session-lifecycle.mjs';

const tempRoots = [];

function tempRoot(prefix = 'topik-ai-session-lifecycle-') {
  const root = mkdtempSync(join(tmpdir(), prefix));
  tempRoots.push(root);
  return root;
}

function command(program, args, cwd) {
  const result = spawnSync(program, args, { cwd, encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) {
    throw new Error(`${program} ${args.join(' ')} failed: ${(result.stderr || result.stdout).trim()}`);
  }
  return result.stdout.trim();
}

function git(cwd, ...args) {
  return command('git', args, cwd);
}

function write(file, content = 'fixture\n') {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content, 'utf8');
}

function createRepository() {
  const root = tempRoot();
  const remote = join(root, 'origin.git');
  const repository = join(root, 'repository');
  mkdirSync(repository, { recursive: true });
  git(root, 'init', '--bare', '--initial-branch=main', remote);
  git(repository, 'init', '--initial-branch=main');
  git(repository, 'config', 'user.name', 'Fixture User');
  git(repository, 'config', 'user.email', 'fixture@example.com');
  write(join(repository, 'README.md'));
  git(repository, 'add', 'README.md');
  git(repository, 'commit', '-m', 'initial');
  git(repository, 'remote', 'add', 'origin', remote);
  git(repository, 'push', '-u', 'origin', 'main');
  return { root, remote, repository };
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe('session lifecycle audit primitives', () => {
  it('parses porcelain worktree records including detached and locked states', () => {
    const records = parseWorktreePorcelain([
      'worktree C:/repo',
      'HEAD abc123',
      'branch refs/heads/main',
      '',
      'worktree C:/probe',
      'HEAD def456',
      'detached',
      'locked inspection',
      ''
    ].join('\n'));

    expect(records).toEqual([
      expect.objectContaining({ path: 'C:/repo', branch: 'main', detached: false }),
      expect.objectContaining({ path: 'C:/probe', detached: true, locked: 'inspection' })
    ]);
  });

  it('uses the fixed classifications for detached, active, dirty, merged, and orphan sessions', () => {
    expect(classifySession({ detached: true, dirty: false })).toBe('DETACHED_PROBE');
    expect(classifySession({ branch: 'codex/live', dirty: false, pr: { state: 'OPEN' } })).toBe('ACTIVE');
    expect(classifySession({ branch: 'codex/dirty', dirty: true, pr: { state: 'OPEN' } })).toBe('DIRTY_BLOCKED');
    expect(classifySession({ branch: 'codex/squash', dirty: false, pr: { state: 'MERGED' }, mergedIntoMain: false })).toBe('MERGED_CLEANUP');
    expect(classifySession({ branch: 'codex/orphan', dirty: false, pr: null, mergedIntoMain: false })).toBe('ORPHAN_REVIEW');
  });

  it('separates generated-only, source orphan, invalid metadata, and foreign repositories', () => {
    const root = tempRoot();
    const generated = join(root, 'generated');
    write(join(generated, 'topik-ai', '.omx', 'worker.log'));
    expect(classifyPhysicalCandidate({ candidate: generated }).classification).toBe('SAFE_QUARANTINE');

    const source = join(root, 'source');
    write(join(source, 'topik-ai', 'package.json'), '{}\n');
    expect(classifyPhysicalCandidate({ candidate: source }).classification).toBe('RECOVERY_REQUIRED');

    const invalid = join(root, 'invalid', 'topik-ai');
    write(join(invalid, '.git'), 'gitdir: C:/missing/gitdir\n');
    expect(classifyPhysicalCandidate({ candidate: join(root, 'invalid') }).classification).toBe('RECOVERY_REQUIRED');

    const foreign = join(root, 'foreign', 'v13');
    mkdirSync(foreign, { recursive: true });
    git(foreign, 'init', '--initial-branch=main');
    write(join(foreign, 'src', 'index.ts'), 'export {};\n');
    expect(classifyPhysicalCandidate({ candidate: join(root, 'foreign') }).classification).toBe('FOREIGN_REPO');
  });
});

describe('session lifecycle mutations', () => {
  it('starts a detached worktree with a manifest and reuses an exact active task', () => {
    const fixture = createRepository();
    const stateRoot = join(fixture.root, 'state');
    const codexWorktreeRoot = join(fixture.root, 'worktrees');
    const first = startSession({
      agent: 'codex',
      taskSummary: 'Inspect notification history',
      rootDir: fixture.repository,
      stateRoot,
      codexWorktreeRoot
    });

    expect(first.reused).toBe(false);
    expect(existsSync(first.manifest.worktreePath)).toBe(true);
    expect(spawnSync('git', ['symbolic-ref', '--quiet', '--short', 'HEAD'], {
      cwd: first.manifest.worktreePath,
      encoding: 'utf8',
      windowsHide: true
    }).status).not.toBe(0);
    expect(readManifests(stateRoot)).toHaveLength(1);

    const second = startSession({
      agent: 'codex',
      taskSummary: '  inspect   notification history ',
      rootDir: fixture.repository,
      stateRoot,
      codexWorktreeRoot
    });
    expect(second.reused).toBe(true);
    expect(second.manifest.worktreePath).toBe(first.manifest.worktreePath);
  });

  it('distinguishes alignable identical-tree main history from unsafe drift', () => {
    const fixture = createRepository();
    const stateRoot = join(fixture.root, 'state');
    const codexWorktreeRoot = join(fixture.root, 'worktrees');
    git(fixture.repository, 'commit', '--allow-empty', '-m', 'local metadata only');
    expect(evaluateMainHistory({ rootDir: fixture.repository })).toEqual(expect.objectContaining({
      drift: true,
      alignable: true,
      ahead: 1,
      behind: 0,
      treesEqual: true
    }));
    const aligned = cleanupSessions({
      apply: true,
      rootDir: fixture.repository,
      stateRoot,
      codexWorktreeRoot,
      includePullRequests: false
    });
    expect(aligned.bundles).toHaveLength(1);
    expect(existsSync(aligned.bundles[0])).toBe(true);
    expect(git(fixture.repository, 'rev-parse', 'main')).toBe(git(fixture.repository, 'rev-parse', 'origin/main'));

    write(join(fixture.repository, 'changed.txt'), 'changed\n');
    git(fixture.repository, 'add', 'changed.txt');
    git(fixture.repository, 'commit', '-m', 'different tree');
    expect(evaluateMainHistory({ rootDir: fixture.repository })).toEqual(expect.objectContaining({
      drift: true,
      alignable: false,
      treesEqual: false
    }));
    const unsafeHead = git(fixture.repository, 'rev-parse', 'main');
    const blocked = cleanupSessions({
      apply: true,
      rootDir: fixture.repository,
      stateRoot,
      codexWorktreeRoot,
      includePullRequests: false
    });
    expect(blocked.bundles).toHaveLength(0);
    expect(git(fixture.repository, 'rev-parse', 'main')).toBe(unsafeHead);
  });

  it('keeps archive dry-run immutable and verifies a bundle before forced deletion', () => {
    const fixture = createRepository();
    const stateRoot = join(fixture.root, 'state');
    git(fixture.repository, 'switch', '-c', 'codex/archive-fixture');
    write(join(fixture.repository, 'archive.txt'), 'preserve me\n');
    git(fixture.repository, 'add', 'archive.txt');
    git(fixture.repository, 'commit', '-m', 'unmerged fixture');
    git(fixture.repository, 'switch', 'main');

    const dryRun = archiveBranch({
      branch: 'codex/archive-fixture',
      rootDir: fixture.repository,
      stateRoot
    });
    expect(dryRun.applied).toBe(false);
    expect(git(fixture.repository, 'branch', '--list', 'codex/archive-fixture')).toContain('codex/archive-fixture');
    expect(existsSync(stateRoot)).toBe(false);

    const applied = archiveBranch({
      branch: 'codex/archive-fixture',
      apply: true,
      rootDir: fixture.repository,
      stateRoot
    });
    expect(applied.applied).toBe(true);
    expect(existsSync(applied.bundlePath)).toBe(true);
    expect(() => git(fixture.repository, 'bundle', 'verify', applied.bundlePath)).not.toThrow();
    expect(git(fixture.repository, 'branch', '--list', 'codex/archive-fixture')).toBe('');
  });

  it('registers an existing unsubmitted branch without creating another worktree', () => {
    const fixture = createRepository();
    const stateRoot = join(fixture.root, 'state');
    git(fixture.repository, 'switch', '-c', 'codex/pending-review');
    write(join(fixture.repository, 'pending.txt'), 'pending\n');
    git(fixture.repository, 'add', 'pending.txt');
    git(fixture.repository, 'commit', '-m', 'pending review');
    git(fixture.repository, 'switch', 'main');

    const manifest = registerBranchSession({
      branch: 'codex/pending-review',
      agent: 'codex',
      taskSummary: 'Review pending migration work',
      rootDir: fixture.repository,
      stateRoot
    });

    expect(manifest).toEqual(expect.objectContaining({
      branch: 'codex/pending-review',
      worktreePath: null,
      status: 'ORPHAN_REVIEW'
    }));
    expect(readManifests(stateRoot)).toHaveLength(1);
    expect(git(fixture.repository, 'worktree', 'list', '--porcelain').match(/^worktree /gm)).toHaveLength(1);

    const continued = startSession({
      agent: 'codex',
      taskSummary: 'Review pending migration work',
      rootDir: fixture.repository,
      stateRoot,
      codexWorktreeRoot: join(fixture.root, 'worktrees')
    });
    expect(continued.reused).toBe(true);
    expect(git(continued.manifest.worktreePath, 'symbolic-ref', '--quiet', '--short', 'HEAD')).toBe('codex/pending-review');
    expect(readManifests(stateRoot)).toHaveLength(1);
    expect(git(fixture.repository, 'worktree', 'list', '--porcelain').match(/^worktree /gm)).toHaveLength(2);
  });

  it('audits and cleans a squash-merged remote-only PR head with a verified bundle', () => {
    const fixture = createRepository();
    const stateRoot = join(fixture.root, 'state');
    const codexWorktreeRoot = join(fixture.root, 'worktrees');
    const branch = 'codex/squash-remote';
    const ancestorBranch = 'docs/already-merged';
    git(fixture.repository, 'push', 'origin', `main:refs/heads/${ancestorBranch}`);
    git(fixture.repository, 'fetch', 'origin');
    git(fixture.repository, 'switch', '-c', branch);
    write(join(fixture.repository, 'squash.txt'), 'squash content\n');
    git(fixture.repository, 'add', 'squash.txt');
    git(fixture.repository, 'commit', '-m', 'squash candidate');
    git(fixture.repository, 'push', '-u', 'origin', branch);
    git(fixture.repository, 'switch', 'main');
    git(fixture.repository, 'branch', '-D', branch);
    const pullRequestProvider = ({ branch: candidate }) => candidate === branch
      ? { number: 42, state: 'MERGED', title: 'Squash remote', url: 'https://example.test/pr/42' }
      : null;

    const audit = collectAudit({
      rootDir: fixture.repository,
      stateRoot,
      codexWorktreeRoot,
      pullRequestProvider
    });
    expect(audit.items).toContainEqual(expect.objectContaining({
      classification: 'MERGED_CLEANUP',
      kind: 'remote-branch',
      branch,
      prNumber: 42
    }));
    expect(audit.items).toContainEqual(expect.objectContaining({
      classification: 'MERGED_CLEANUP',
      kind: 'remote-branch',
      branch: ancestorBranch,
      prNumber: null
    }));

    const cleaned = cleanupSessions({
      apply: true,
      rootDir: fixture.repository,
      stateRoot,
      codexWorktreeRoot,
      pullRequestProvider,
      verifyRemoteAccount: () => {}
    });
    expect(cleaned.bundles).toHaveLength(1);
    expect(existsSync(cleaned.bundles[0])).toBe(true);
    expect(() => git(fixture.repository, 'bundle', 'verify', cleaned.bundles[0])).not.toThrow();
    expect(git(fixture.repository, 'ls-remote', '--heads', 'origin', `refs/heads/${branch}`)).toBe('');
    expect(git(fixture.repository, 'ls-remote', '--heads', 'origin', `refs/heads/${ancestorBranch}`)).toBe('');
  });

  it('does not move generated worktrees in dry-run and quarantines them only with apply', () => {
    const fixture = createRepository();
    const stateRoot = join(fixture.root, 'state');
    const codexWorktreeRoot = join(fixture.root, 'worktrees');
    const generated = join(codexWorktreeRoot, 'deadbeef');
    write(join(generated, 'topik-ai', '.vite', 'deps.log'));

    const dryRun = cleanupSessions({
      rootDir: fixture.repository,
      stateRoot,
      codexWorktreeRoot,
      includePullRequests: false
    });
    expect(dryRun.applied).toBe(false);
    expect(existsSync(generated)).toBe(true);
    expect(existsSync(stateRoot)).toBe(false);

    const applied = cleanupSessions({
      apply: true,
      rootDir: fixture.repository,
      stateRoot,
      codexWorktreeRoot,
      includePullRequests: false
    });
    expect(applied.applied).toBe(true);
    expect(existsSync(generated)).toBe(false);
    expect(applied.quarantined).toHaveLength(1);
    expect(existsSync(applied.quarantined[0])).toBe(true);
    expect(readdirSync(join(stateRoot, 'quarantine'))).toHaveLength(1);
  });
});

describe('manifest v2, repository lock, and status', () => {
  it('writes schema v2 manifests atomically without temp residue', () => {
    const { repository } = createRepository();
    const stateRoot = tempRoot();
    const result = startSession({
      agent: 'claude',
      taskSummary: 'v2 fields probe',
      rootDir: repository,
      stateRoot,
      codexWorktreeRoot: tempRoot(),
      clock: () => new Date('2026-07-24T00:00:00Z')
    });

    expect(result.manifest.schemaVersion).toBe(MANIFEST_SCHEMA_VERSION);
    expect(result.manifest.lifecyclePhase).toBe('ACTIVE');
    expect(result.manifest.cleanupStep).toBe('NONE');
    expect(result.manifest.pinned).toBe(false);
    expect(result.manifest.expectedActor).toBeNull();
    expect(result.manifest.branchExpiresAt).toBeNull();
    expect(readdirSync(stateRoot).some((name) => name.includes('.tmp-'))).toBe(false);
    expect(readdirSync(join(stateRoot, 'locks'))).toEqual([]);
  });

  it('upgrades schema v1 manifests in memory and persists v2 on the next write', () => {
    const { repository } = createRepository();
    const stateRoot = tempRoot();
    write(join(stateRoot, 'legacy-1.json'), `${JSON.stringify({
      schemaVersion: 1,
      repository: 'repository',
      repositoryRoot: repository,
      worktreeId: 'legacy-1',
      worktreePath: repository,
      agent: 'codex',
      taskSummary: 'legacy session',
      branch: 'main',
      pullRequestNumber: null,
      pullRequestUrl: null,
      status: 'ACTIVE',
      dirty: false,
      createdAt: '2026-07-01T00:00:00.000Z',
      updatedAt: '2026-07-01T00:00:00.000Z'
    }, null, 2)}\n`);

    const upgraded = readManifests(stateRoot)[0];
    expect(upgraded.schemaVersion).toBe(MANIFEST_SCHEMA_VERSION);
    expect(upgraded.pinned).toBe(false);
    expect(upgraded.lifecyclePhase).toBe('ACTIVE');
    expect(upgraded.remoteDeletedByGitHub).toBe(false);
    expect(upgradeManifest({ schemaVersion: 2, pinned: true }).pinned).toBe(true);

    const persisted = syncSession({ worktreeDir: repository, stateRoot, codexWorktreeRoot: tempRoot() });
    expect(persisted.schemaVersion).toBe(MANIFEST_SCHEMA_VERSION);
    expect(persisted.createdAt).toBe('2026-07-01T00:00:00.000Z');
  });

  it('refuses mutating cleanup while a live owner holds the repository lock', () => {
    const { repository } = createRepository();
    const stateRoot = tempRoot();
    const lockDir = join(stateRoot, 'locks', 'repository.lock');
    write(join(lockDir, 'owner.json'), `${JSON.stringify({
      pid: process.pid,
      command: 'cleanup',
      acquiredAt: new Date().toISOString()
    })}\n`);

    expect(() => cleanupSessions({
      apply: true,
      rootDir: repository,
      stateRoot,
      codexWorktreeRoot: tempRoot(),
      includePullRequests: false,
      verifyRemoteAccount: () => {}
    })).toThrow('repository lock held by pid');
  });

  it('evicts a dead lock owner atomically and proceeds', () => {
    const { repository } = createRepository();
    const stateRoot = tempRoot();
    const lockDir = join(stateRoot, 'locks', 'repository.lock');
    write(join(lockDir, 'owner.json'), `${JSON.stringify({
      pid: 999999,
      command: 'cleanup',
      acquiredAt: '2026-07-01T00:00:00.000Z'
    })}\n`);

    const result = cleanupSessions({
      apply: true,
      rootDir: repository,
      stateRoot,
      codexWorktreeRoot: tempRoot(),
      includePullRequests: false,
      verifyRemoteAccount: () => {}
    });
    expect(result.applied).toBe(true);
    const lockEntries = readdirSync(join(stateRoot, 'locks'));
    expect(lockEntries.some((name) => name.startsWith('stale-'))).toBe(true);
    expect(lockEntries).not.toContain('repository.lock');
  });

  it('scopes cleanup planning to a single session id', () => {
    const { repository } = createRepository();
    const stateRoot = tempRoot();
    for (const branch of ['b1', 'b2']) {
      git(repository, 'switch', '-c', branch);
      write(join(repository, `${branch}.txt`));
      git(repository, 'add', `${branch}.txt`);
      git(repository, 'commit', '-m', `work on ${branch}`);
      git(repository, 'switch', 'main');
      git(repository, 'merge', '--no-ff', branch, '-m', `merge ${branch}`);
      registerBranchSession({
        branch,
        agent: 'claude',
        taskSummary: `session for ${branch}`,
        rootDir: repository,
        stateRoot
      });
    }
    git(repository, 'push', 'origin', 'main');

    const scoped = cleanupSessions({
      sessionId: 'branch-b1',
      rootDir: repository,
      stateRoot,
      codexWorktreeRoot: tempRoot(),
      includePullRequests: false
    });
    const targets = scoped.plannedActions.map((action) => action.target);
    expect(targets).toContain('b1');
    expect(targets).not.toContain('b2');

    expect(() => cleanupSessions({
      sessionId: 'no-such-session',
      rootDir: repository,
      stateRoot,
      codexWorktreeRoot: tempRoot(),
      includePullRequests: false
    })).toThrow('unknown session id');
  });

  it('reports sessions, lock state, and recovery residues in status', () => {
    const { repository } = createRepository();
    const stateRoot = tempRoot();
    startSession({
      agent: 'claude',
      taskSummary: 'status probe',
      rootDir: repository,
      stateRoot,
      codexWorktreeRoot: tempRoot()
    });
    write(join(stateRoot, 'recovery', 'worktree-residue-legacy', 'note.txt'));

    const status = statusSessions({
      rootDir: repository,
      stateRoot,
      codexWorktreeRoot: tempRoot(),
      includePullRequests: false
    });
    expect(status.repository).toBe('repository');
    expect(status.sessions.length).toBeGreaterThan(0);
    expect(status.sessions[0]).toHaveProperty('lifecyclePhase');
    expect(status.lock.held).toBe(false);
    expect(status.residues).toContain('worktree-residue-legacy');

    const rendered = formatStatus(status);
    expect(rendered).toContain('PHASE');
    expect(rendered).toContain('worktree-residue-legacy');
  });
});
