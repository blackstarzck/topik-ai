import { existsSync } from 'node:fs';
import { basename, resolve } from 'node:path';

import { gh, git } from './session-core.mjs';

// git/gh 질의 계층 — 분해로 session-lifecycle.mjs 에서 이동(동작 동일).
// worktree porcelain 파싱과 저장소·브랜치·PR 조회를 담는다.

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

export function repositoryRoot(run, cwd) {
  return git(run, cwd, ['rev-parse', '--show-toplevel']).stdout.trim();
}

export function repositoryIdentity(run, root) {
  const remote = git(run, root, ['remote', 'get-url', 'origin'], { allowFailure: true }).stdout.trim();
  const match = remote.match(/(?:github\.com[/:])([^/]+\/[^/]+?)(?:\.git)?$/i);
  return match ? match[1] : basename(root);
}

export function commonGitDirectory(run, root) {
  const value = git(run, root, ['rev-parse', '--git-common-dir']).stdout.trim();
  return resolve(root, value);
}

export function worktreeRecords(run, root) {
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

export function branchRecords(run, root) {
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

export function remoteBranchRecords(run, root) {
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

export function branchMergedIntoMain(run, root, branch) {
  return git(run, root, ['merge-base', '--is-ancestor', branch, 'origin/main'], { allowFailure: true }).status === 0;
}

export function getPullRequest(run, repository, branch) {
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
