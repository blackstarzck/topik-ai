#!/usr/bin/env node
// Manual/bootstrap counterpart of release-promotion.yml: pushes an already
// validated source SHA to the company promote branch (never rewritten) and opens
// the promote → stg PR. Account selection is process-scoped per AGENTS §11.1 —
// the company repository actor comes from the account-context mapping.

import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { expectedActorFor, withAccount } from './account-context.mjs';

const COMPANY_REPOSITORY = 'keduall/topik-admin';
const SHA_PATTERN = /^[0-9a-f]{40}$/;

function value(args, flag) {
  const index = args.indexOf(flag);
  if (index < 0 || !args[index + 1]) throw new Error(`${flag} is required.`);
  return args[index + 1];
}

function localGit(args) {
  const result = spawnSync('git', args, { encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${(result.stderr || result.stdout).trim()}`);
  }
  return result.stdout.trim();
}

export function promoteSource({ sourceSha, actor = expectedActorFor(COMPANY_REPOSITORY), deps = {} }) {
  if (!SHA_PATTERN.test(sourceSha ?? '')) {
    throw new Error('--source-sha must be a 40-hex commit SHA.');
  }
  localGit(['cat-file', '-e', `${sourceSha}^{commit}`]);
  return withAccount(actor, ({ runAs }) => {
    const push = runAs('git', [
      'push',
      `https://github.com/${COMPANY_REPOSITORY}.git`,
      `${sourceSha}:refs/heads/promote/${sourceSha}`
    ]);
    if (push.status !== 0) {
      throw new Error(`promote push failed: ${(push.stderr || push.stdout).trim().slice(-400)}`);
    }
    const existing = runAs('gh', [
      'pr', 'list', '--repo', COMPANY_REPOSITORY,
      '--base', 'stg', '--head', `promote/${sourceSha}`,
      '--state', 'open', '--json', 'number', '--jq', 'length'
    ]);
    if (existing.status === 0 && existing.stdout.trim() !== '0') {
      return { pushed: true, prCreated: false };
    }
    const created = runAs('gh', [
      'pr', 'create', '--repo', COMPANY_REPOSITORY,
      '--base', 'stg', '--head', `promote/${sourceSha}`,
      '--title', `release: promote ${sourceSha.slice(0, 7)} to stg`,
      '--body', `Manual promotion of validated source ${sourceSha}. The promotion gate re-verifies evidence, tree, and migration digest.`
    ]);
    if (created.status !== 0) {
      throw new Error(`stg PR creation failed: ${(created.stderr || created.stdout).trim().slice(-400)}`);
    }
    return { pushed: true, prCreated: true, prUrl: created.stdout.trim() };
  }, deps);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const result = promoteSource({ sourceSha: value(process.argv.slice(2), '--source-sha') });
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
