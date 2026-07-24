import { describe, expect, it } from 'vitest';
import {
  fetchCompanyMainTip,
  parseReleaseSource,
  resolvePreviousRelease
} from '../../scripts/ci/resolve-previous-release.mjs';
import {
  computeUpgradeDelta,
  extractV13Pin
} from '../../scripts/ci/run-shadow-contract.mjs';

const SHA_A = 'a'.repeat(40);
const SHA_B = 'b'.repeat(40);

describe('previous release resolution', () => {
  it('parses the Release-Source trailer case-insensitively from a merge message', () => {
    expect(parseReleaseSource(`release: db-only abc1234\n\nRelease-Source: ${SHA_A}\n`)).toBe(SHA_A);
    expect(parseReleaseSource(`release\n\nrelease-source: ${SHA_A.toUpperCase()}`)).toBe(SHA_A);
    expect(parseReleaseSource('fix: 알림 dispatch 오버로드 (#29)')).toBeNull();
    expect(parseReleaseSource(`inline Release-Source: ${SHA_A} not a trailer line`)).toBeNull();
  });

  it('prefers the trailer, falls back to the mirror tip, and honors the override', () => {
    expect(resolvePreviousRelease({
      tipSha: SHA_B,
      tipMessage: `release: app-db\n\nRelease-Source: ${SHA_A}\n`
    })).toEqual({ sha: SHA_A, source: 'release-source-trailer' });

    expect(resolvePreviousRelease({ tipSha: SHA_B, tipMessage: 'fast-forward mirror commit' }))
      .toEqual({ sha: SHA_B, source: 'mirror-tip-bootstrap' });

    expect(resolvePreviousRelease({ tipSha: null, tipMessage: null, override: SHA_A }))
      .toEqual({ sha: SHA_A, source: 'override' });

    expect(() => resolvePreviousRelease({ tipSha: null, tipMessage: null, override: 'nope' }))
      .toThrow('UPGRADE_REPLAY_BASE_OVERRIDE');
    expect(() => resolvePreviousRelease({ tipSha: 'short', tipMessage: '' }))
      .toThrow('company main tip SHA is unavailable');
  });

  it('reads the company main tip with a token and fails closed without one', async () => {
    const tip = await fetchCompanyMainTip({
      token: 'gho_test',
      fetchImpl: async (url, init) => {
        expect(url).toBe('https://api.github.com/repos/keduall/topik-admin/commits/main');
        expect(init.headers.Authorization).toBe('Bearer gho_test');
        return {
          ok: true,
          json: async () => ({ sha: SHA_B, commit: { message: `x\n\nRelease-Source: ${SHA_A}` } })
        };
      }
    });
    expect(tip).toEqual({ tipSha: SHA_B, tipMessage: `x\n\nRelease-Source: ${SHA_A}` });

    await expect(fetchCompanyMainTip({ token: null })).rejects.toThrow('COMPANY_RELEASE_READ_TOKEN');
    await expect(fetchCompanyMainTip({
      token: 'gho_test',
      fetchImpl: async () => ({ ok: false, status: 404 })
    })).rejects.toThrow('HTTP 404');
  });
});

describe('upgrade replay delta', () => {
  const entry = (source, name) => ({ source, name, path: `${source}/${name}` });

  it('returns only migrations the N-1 plan did not contain, keyed by source and name', () => {
    const previous = [
      entry('v13', '20260612180000_dispatcher.sql'),
      entry('admin', '20260720150000_backup.sql')
    ];
    const current = [
      ...previous,
      entry('admin', '20260723011242_notification_pipeline_ownership_transfer.sql'),
      entry('topik_writing', '20260724090000_new_writing.sql')
    ];
    expect(computeUpgradeDelta(current, previous).map((item) => item.name)).toEqual([
      '20260723011242_notification_pipeline_ownership_transfer.sql',
      '20260724090000_new_writing.sql'
    ]);
    expect(computeUpgradeDelta(previous, previous)).toEqual([]);
  });

  it('treats same-name files in different namespaces as distinct entries', () => {
    const previous = [entry('admin', '20260101000000_shared.sql')];
    const current = [entry('admin', '20260101000000_shared.sql'), entry('topik_writing', '20260101000000_shared.sql')];
    expect(computeUpgradeDelta(current, previous)).toHaveLength(1);
  });

  it('extracts the pinned v13 contract SHA from an N-1 workflow file', () => {
    expect(extractV13Pin(`env:\n  V13_CONTRACT_SHA: ${SHA_A}\n`)).toBe(SHA_A);
    expect(() => extractV13Pin('env:\n  NODE_VERSION: 24\n')).toThrow('does not pin V13_CONTRACT_SHA');
  });
});
