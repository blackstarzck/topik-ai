import { describe, expect, it } from 'vitest';
import {
  ACCOUNTS,
  EXPECTED_AUTHOR,
  assertMutationContext,
  assertPostMutation,
  expectedActorFor,
  getTokenForAccount,
  maskTokens,
  runGitPushAs,
  sanitizedBaseEnv,
  verifyAuthor,
  withAccount
} from '../../scripts/git/account-context.mjs';

function fakeRun(handlers) {
  const calls = [];
  const run = (command, args, options = {}) => {
    calls.push({ command, args, options });
    for (const handler of handlers) {
      const result = handler(command, args, options);
      if (result) return { status: 0, stdout: '', stderr: '', ...result };
    }
    return { status: 0, stdout: '', stderr: '' };
  };
  run.calls = calls;
  return run;
}

const tokenCall = (login, token) => (command, args) => (
  command === 'gh' && args[0] === 'auth' && args[1] === 'token' && args[3] === login
    ? { stdout: `${token}\n` }
    : null
);

const identityCall = (login) => (command, args) => (
  command === 'gh' && args[0] === 'api' && args[1] === 'user'
    ? { stdout: `${login}\n` }
    : null
);

describe('account-context', () => {
  it('maps each repository to its mutation actor and rejects unknown slugs', () => {
    expect(expectedActorFor('blackstarzck/topik-ai')).toBe('blackstarzck');
    expect(expectedActorFor('keduall/topik-admin')).toBe('guestkeduall-design');
    expect(Object.isFrozen(ACCOUNTS)).toBe(true);
    expect(() => expectedActorFor('someone/else')).toThrow('No account mapping');
  });

  it('strips ambient credential envs so injected identity is deterministic', () => {
    const env = sanitizedBaseEnv({
      PATH: 'C:/bin',
      GH_TOKEN: 'gho_ambient',
      GITHUB_TOKEN: 'ghp_ambient',
      GH_HOST: 'github.example',
      GH_CONFIG_DIR: 'C:/profiles/x'
    });
    expect(env.PATH).toBe('C:/bin');
    expect(env.GH_TOKEN).toBeUndefined();
    expect(env.GITHUB_TOKEN).toBeUndefined();
    expect(env.GH_HOST).toBeUndefined();
    expect(env.GH_CONFIG_DIR).toBeUndefined();
  });

  it('masks token shapes in any error text', () => {
    expect(maskTokens('fatal: gho_abc123 rejected')).toBe('fatal: *** rejected');
    expect(maskTokens('github_pat_11AAAA_bbb failed with ghp_zzz')).toBe('*** failed with ***');
  });

  it('reads the keyring token without mutating global state', () => {
    const run = fakeRun([tokenCall('blackstarzck', 'gho_secret1')]);
    expect(getTokenForAccount('blackstarzck', { run })).toBe('gho_secret1');
    expect(run.calls[0].options.env.GH_TOKEN).toBeUndefined();
    expect(run.calls.some(({ args }) => args.includes('switch'))).toBe(false);
  });

  it('injects GH_TOKEN for exactly the wrapped calls after an identity preflight', () => {
    const run = fakeRun([
      tokenCall('guestkeduall-design', 'gho_guest'),
      identityCall('guestkeduall-design')
    ]);
    const result = withAccount('guestkeduall-design', ({ actor, runAs }) => {
      runAs('gh', ['pr', 'view', '1']);
      return actor;
    }, { run, baseEnv: { PATH: 'C:/bin', GH_TOKEN: 'gho_ambient' } });

    expect(result).toBe('guestkeduall-design');
    const wrapped = run.calls.find(({ args }) => args[0] === 'pr');
    expect(wrapped.options.env.GH_TOKEN).toBe('gho_guest');
    expect(wrapped.options.env.PATH).toBe('C:/bin');
    const preflight = run.calls.find(({ args }) => args[0] === 'api' && args[1] === 'user');
    expect(preflight.options.env.GH_TOKEN).toBe('gho_guest');
  });

  it('blocks the wrong account before any wrapped mutation runs', () => {
    const run = fakeRun([
      tokenCall('guestkeduall-design', 'gho_guest'),
      identityCall('blackstarzck')
    ]);
    let executed = false;
    expect(() => withAccount('guestkeduall-design', () => {
      executed = true;
    }, { run })).toThrow('Account preflight mismatch');
    expect(executed).toBe(false);
  });

  it('pushes under the injected account and masks tokens in failures', () => {
    const failingPush = (command, args) => (
      command === 'git' && args.includes('push')
        ? { status: 1, stderr: 'remote rejected using gho_guest123' }
        : null
    );
    const run = fakeRun([
      tokenCall('guestkeduall-design', 'gho_guest123'),
      identityCall('guestkeduall-design'),
      failingPush
    ]);
    expect(() => runGitPushAs(
      'guestkeduall-design',
      'C:/repo',
      ['company', 'HEAD:refs/heads/promote/abc'],
      { run }
    )).toThrow(/git push as guestkeduall-design failed \(1\).*\*\*\*/s);
    const push = run.calls.find(({ args }) => args.includes('push'));
    expect(push.options.env.GH_TOKEN).toBe('gho_guest123');
    expect(push.args).toEqual(['-C', 'C:/repo', 'push', 'company', 'HEAD:refs/heads/promote/abc']);
  });

  it('verifies the git author identity contract', () => {
    const run = fakeRun([
      (command, args) => (args?.[2] === 'config' && args[3] === 'user.name'
        ? { stdout: `${EXPECTED_AUTHOR.name}\n` }
        : null),
      (command, args) => (args?.[2] === 'config' && args[3] === 'user.email'
        ? { stdout: 'wrong@example.com\n' }
        : null)
    ]);
    expect(() => verifyAuthor(run, 'C:/repo')).toThrow('Git author mismatch');
  });

  it('asserts the mutation context and detects remote head drift', () => {
    const run = fakeRun([
      (command, args) => (args?.[2] === 'remote'
        ? { stdout: 'https://github.com/keduall/topik-admin.git\n' }
        : null),
      (command, args) => (args?.[2] === 'ls-remote'
        ? { stdout: 'abc123\trefs/heads/stg\n' }
        : null)
    ]);
    const context = assertMutationContext({
      run,
      cwd: 'C:/repo',
      remote: 'company',
      expectedUrlPattern: /keduall\/topik-admin/,
      branch: 'stg',
      expectedHeadSha: 'abc123'
    });
    expect(context.remoteHeadSha).toBe('abc123');

    expect(() => assertMutationContext({
      run,
      cwd: 'C:/repo',
      remote: 'company',
      expectedUrlPattern: /keduall\/topik-admin/,
      branch: 'stg',
      expectedHeadSha: 'def456'
    })).toThrow('Remote head drift');

    expect(() => assertPostMutation({
      run,
      cwd: 'C:/repo',
      remote: 'company',
      branch: 'stg',
      expectedNewHeadSha: 'def456'
    })).toThrow('Post-mutation head mismatch');
  });
});
