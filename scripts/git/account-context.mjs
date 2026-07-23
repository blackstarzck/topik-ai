// Process-scoped GitHub account selection. Global `gh auth switch` mutates shared
// state and races parallel agent sessions, so mutations instead read the target
// account's keyring token and inject it as GH_TOKEN for a single spawned process.
// GH_TOKEN dominates both `gh` API identity and `git push` through the gh
// credential helper, so an identity preflight per call is the complete guard.
// Tokens live only in memory and in the spawned env — never on disk or in logs.

import { spawnSync } from 'node:child_process';

const CREDENTIAL_ENV_NAMES = ['GH_TOKEN', 'GITHUB_TOKEN', 'GH_HOST', 'GH_CONFIG_DIR'];
const TOKEN_PATTERN = /\b(?:gho_|ghp_|ghs_|github_pat_)[A-Za-z0-9_]+/g;

export const ACCOUNTS = Object.freeze({
  'blackstarzck/topik-ai': Object.freeze({ actor: 'blackstarzck' }),
  'keduall/topik-admin': Object.freeze({ actor: 'guestkeduall-design' })
});

export const EXPECTED_AUTHOR = Object.freeze({
  name: 'guestkeduall-design',
  email: 'guestkeduall@gmail.com'
});

export function maskTokens(text) {
  return String(text ?? '').replace(TOKEN_PATTERN, '***');
}

export function expectedActorFor(repositorySlug) {
  const entry = ACCOUNTS[repositorySlug];
  if (!entry) throw new Error(`No account mapping for repository: ${repositorySlug}`);
  return entry.actor;
}

// Ambient credential envs silently flip the identity of every gh/git call, so
// account-aware code always starts from an env with them removed.
export function sanitizedBaseEnv(baseEnv = process.env) {
  const env = { ...baseEnv };
  for (const name of CREDENTIAL_ENV_NAMES) delete env[name];
  return env;
}

export function defaultRun(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: 'utf8',
    env: {
      ...(options.env ?? sanitizedBaseEnv()),
      GIT_TERMINAL_PROMPT: '0',
      GH_PROMPT_DISABLED: '1'
    },
    input: options.input,
    windowsHide: true
  });
  if (result.error) throw new Error(maskTokens(result.error.message));
  return { status: result.status ?? 1, stdout: result.stdout || '', stderr: result.stderr || '' };
}

function runOrThrow(run, command, args, options, label) {
  const result = run(command, args, options);
  if (result.status !== 0) {
    const detail = maskTokens(`${result.stderr || result.stdout}`).trim();
    throw new Error(`${label} failed (${result.status})${detail ? `: ${detail.slice(-500)}` : ''}`);
  }
  return (result.stdout || '').trim();
}

export function getTokenForAccount(login, { run = defaultRun, tokenProvider = null } = {}) {
  if (tokenProvider) return tokenProvider(login);
  const token = runOrThrow(
    run,
    'gh',
    ['auth', 'token', '--user', login],
    { env: sanitizedBaseEnv() },
    `read keyring token for ${login}`
  );
  if (!token) throw new Error(`Keyring returned an empty token for ${login}.`);
  return token;
}

// Runs fn with a process-scoped account context. fn receives runAs(command, args,
// options) whose spawned env carries GH_TOKEN for exactly this account; the global
// active gh account is never changed. The identity preflight runs before fn so a
// wrong or stale token can never reach a mutation.
export function withAccount(login, fn, deps = {}) {
  const run = deps.run ?? defaultRun;
  const token = getTokenForAccount(login, deps);
  const accountEnv = { ...sanitizedBaseEnv(deps.baseEnv), GH_TOKEN: token };
  const runAs = (command, args, options = {}) => run(command, args, {
    ...options,
    env: { ...accountEnv, ...(options.env ?? {}) }
  });
  const identity = runOrThrow(
    run,
    'gh',
    ['api', 'user', '--jq', '.login'],
    { env: accountEnv },
    'verify injected account identity'
  );
  if (identity !== login) {
    throw new Error(`Account preflight mismatch: expected ${login}, got ${identity || 'unknown'}.`);
  }
  return fn({ actor: login, env: accountEnv, runAs });
}

export function runGhAs(login, args, deps = {}) {
  return withAccount(login, ({ runAs }) => {
    const result = runAs('gh', args);
    if (result.status !== 0) {
      const detail = maskTokens(`${result.stderr || result.stdout}`).trim();
      throw new Error(`gh ${args.join(' ')} as ${login} failed (${result.status})${detail ? `: ${detail.slice(-500)}` : ''}`);
    }
    return (result.stdout || '').trim();
  }, deps);
}

export function runGitPushAs(login, cwd, pushArgs, deps = {}) {
  return withAccount(login, ({ runAs }) => {
    const result = runAs('git', ['-C', cwd, 'push', ...pushArgs]);
    if (result.status !== 0) {
      const detail = maskTokens(`${result.stderr || result.stdout}`).trim();
      throw new Error(`git push as ${login} failed (${result.status})${detail ? `: ${detail.slice(-500)}` : ''}`);
    }
    return (result.stdout || '').trim();
  }, deps);
}

export function verifyRemote(run, cwd, remoteName, expectedUrlPattern) {
  const url = runOrThrow(run, 'git', ['-C', cwd, 'remote', 'get-url', remoteName], {}, `read remote ${remoteName}`);
  if (!expectedUrlPattern.test(url)) {
    throw new Error(`Remote ${remoteName} URL mismatch: ${url}`);
  }
  return url;
}

export function verifyAuthor(run, cwd, expected = EXPECTED_AUTHOR) {
  const name = runOrThrow(run, 'git', ['-C', cwd, 'config', 'user.name'], {}, 'read git user.name');
  const email = runOrThrow(run, 'git', ['-C', cwd, 'config', 'user.email'], {}, 'read git user.email');
  if (name !== expected.name || email !== expected.email) {
    throw new Error(`Git author mismatch: ${name} <${email}> (expected ${expected.name} <${expected.email}>)`);
  }
  return { name, email };
}

export function readRemoteHeadSha(run, cwd, remote, branch) {
  const output = runOrThrow(
    run,
    'git',
    ['-C', cwd, 'ls-remote', '--heads', remote, `refs/heads/${branch}`],
    {},
    `read remote head ${remote}/${branch}`
  );
  const sha = output.split(/\s+/)[0] || '';
  return sha || null;
}

// AGENTS.md §11.1 contract as code: before a mutation, the target remote, the git
// author identity, and (when given) the expected remote head must all match.
export function assertMutationContext({
  run = defaultRun,
  cwd,
  remote,
  expectedUrlPattern,
  branch = null,
  expectedHeadSha = null,
  expectedAuthor = null
}) {
  const url = verifyRemote(run, cwd, remote, expectedUrlPattern);
  const author = expectedAuthor ? verifyAuthor(run, cwd, expectedAuthor) : null;
  let remoteHeadSha = null;
  if (branch) {
    remoteHeadSha = readRemoteHeadSha(run, cwd, remote, branch);
    if (expectedHeadSha !== null && remoteHeadSha !== expectedHeadSha) {
      throw new Error(
        `Remote head drift on ${remote}/${branch}: expected ${expectedHeadSha ?? '(none)'}, got ${remoteHeadSha ?? '(none)'}`
      );
    }
  }
  return { url, author, remoteHeadSha };
}

export function assertPostMutation({
  run = defaultRun,
  cwd,
  remote,
  branch,
  expectedNewHeadSha
}) {
  const remoteHeadSha = readRemoteHeadSha(run, cwd, remote, branch);
  if (remoteHeadSha !== expectedNewHeadSha) {
    throw new Error(
      `Post-mutation head mismatch on ${remote}/${branch}: expected ${expectedNewHeadSha ?? '(none)'}, got ${remoteHeadSha ?? '(none)'}`
    );
  }
  return { remoteHeadSha };
}
