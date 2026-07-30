import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  DISPOSITIONS,
  evaluateArchive,
  evaluateDevManifestAgreement,
  gitBlobSha,
  listArchive,
  parseForwardName,
  sha256Hex,
} from '../../scripts/db/v13-archive.mjs';

const FORWARD = '20260520120000_extensions_and_schemas.sql';
const DOWN = 'down/20260520120000_extensions_and_schemas.sql';

function writeArchiveFile(archiveDir, name, contents) {
  const target = join(archiveDir, name);
  mkdirSync(join(target, '..'), { recursive: true });
  writeFileSync(target, contents);
  return Buffer.from(contents);
}

function baseManifest(archiveDir, { forwardBody = 'select 1;\n', downBody = 'select 2;\n' } = {}) {
  const forwardBytes = writeArchiveFile(archiveDir, FORWARD, forwardBody);
  const downBytes = writeArchiveFile(archiveDir, DOWN, downBody);
  return {
    authoringWatermark: '20260520120000',
    counts: { forward: 1, down: 1 },
    files: [
      {
        name: FORWARD,
        sha256: sha256Hex(forwardBytes),
        blob: gitBlobSha(forwardBytes),
        bytes: forwardBytes.length,
        ledger: { dev: 'applied', prod: 'applied' },
        disposition: 'applied',
      },
      {
        name: DOWN,
        sha256: sha256Hex(downBytes),
        blob: gitBlobSha(downBytes),
        bytes: downBytes.length,
      },
    ],
  };
}

describe('hashing helpers', () => {
  it('computes the same blob sha git does', () => {
    // Well-known git object ids: the empty blob and the blob for "hello\n".
    expect(gitBlobSha(Buffer.alloc(0))).toBe('e69de29bb2d1d6434b8b29ae775ad8c2e48c5391');
    expect(gitBlobSha(Buffer.from('hello\n'))).toBe('ce013625030ba8dba906f756967f9e9ca394464a');
  });

  it('hashes bytes, not decoded text', () => {
    // A CRLF copy must not hash like the LF original, otherwise a line-ending
    // conversion during adoption would pass verification.
    expect(sha256Hex(Buffer.from('a\n'))).not.toBe(sha256Hex(Buffer.from('a\r\n')));
    expect(sha256Hex(Buffer.alloc(0))).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
    );
  });

  it('accepts only the migration file name contract', () => {
    expect(parseForwardName(FORWARD)).toMatchObject({ version: '20260520120000' });
    expect(parseForwardName('2026052012000_short.sql')).toBeNull();
    expect(parseForwardName('20260520120000_Mixed_Case.sql')).toBeNull();
    expect(parseForwardName('20260520120000_extensions_and_schemas.txt')).toBeNull();
  });

  it('publishes a disposition vocabulary the manifest is validated against', () => {
    expect(Object.keys(DISPOSITIONS).sort()).toEqual([
      'adopted-elsewhere',
      'applied',
      'blocked',
      'deferred',
    ]);
  });
});

describe('evaluateArchive', () => {
  let archiveDir;

  beforeEach(() => {
    archiveDir = mkdtempSync(join(tmpdir(), 'v13-archive-test-'));
  });

  afterEach(() => {
    rmSync(archiveDir, { recursive: true, force: true });
  });

  it('passes a consistent archive and reports its shape', () => {
    const result = evaluateArchive({ archiveDir, manifest: baseManifest(archiveDir) });
    expect(result.failures).toEqual([]);
    expect(result).toMatchObject({ forwardCount: 1, downCount: 1, watermark: '20260520120000' });
    expect(listArchive(archiveDir)).toEqual({
      forward: [FORWARD],
      down: ['20260520120000_extensions_and_schemas.sql'],
    });
  });

  it('detects edited bytes through both hashes', () => {
    const manifest = baseManifest(archiveDir);
    writeArchiveFile(archiveDir, FORWARD, 'select 1; -- an added comment\n');
    const { failures } = evaluateArchive({ archiveDir, manifest });
    expect(failures.some((issue) => issue.includes('sha256 drift'))).toBe(true);
    expect(failures.some((issue) => issue.includes('git blob drift'))).toBe(true);
  });

  it('detects a file missing from the archive and a file missing from the manifest', () => {
    const manifest = baseManifest(archiveDir);
    rmSync(join(archiveDir, FORWARD));
    writeArchiveFile(archiveDir, '20260521120000_stray_file.sql', 'select 3;\n');
    const { failures } = evaluateArchive({ archiveDir, manifest });
    expect(failures).toContain(`${FORWARD} is declared in the manifest but missing from the archive.`);
    expect(failures).toContain(
      '20260521120000_stray_file.sql is present in the archive but absent from the manifest.'
    );
  });

  it('rejects a watermark that is not the highest archived forward version', () => {
    const manifest = baseManifest(archiveDir);
    manifest.authoringWatermark = '20260101000000';
    const { failures } = evaluateArchive({ archiveDir, manifest });
    expect(failures.some((issue) => issue.includes('authoringWatermark'))).toBe(true);
  });

  it('rejects counts that disagree with the archive', () => {
    const manifest = baseManifest(archiveDir);
    manifest.counts = { forward: 99, down: 99 };
    const { failures } = evaluateArchive({ archiveDir, manifest });
    expect(failures.some((issue) => issue.includes('counts.forward'))).toBe(true);
    expect(failures.some((issue) => issue.includes('counts.down'))).toBe(true);
  });

  it('rejects a blocked or deferred migration that the development ledger records', () => {
    for (const disposition of ['blocked', 'deferred']) {
      const manifest = baseManifest(archiveDir);
      manifest.files[0].disposition = disposition;
      manifest.files[0].reason = 'because';
      const { failures } = evaluateArchive({ archiveDir, manifest });
      expect(failures).toContain(
        `${FORWARD} is ${disposition} but recorded as applied in development.`
      );
    }
  });

  it('requires a reason for every non-applied disposition', () => {
    const manifest = baseManifest(archiveDir);
    manifest.files[0].disposition = 'blocked';
    manifest.files[0].ledger = { dev: 'absent', prod: 'applied' };
    const { failures } = evaluateArchive({ archiveDir, manifest });
    expect(failures).toContain(`${FORWARD} is blocked but records no reason.`);
  });

  it('keeps an adopted migration out of the learner tracker and marks it replay-only', () => {
    const manifest = baseManifest(archiveDir);
    manifest.files[0].disposition = 'adopted-elsewhere';
    manifest.files[0].reason = 'adopted byte for byte into the admin namespace';
    const { failures } = evaluateArchive({ archiveDir, manifest });
    expect(failures.some((issue) => issue.includes('names no adopting path'))).toBe(true);
    expect(failures.some((issue) => issue.includes('must be marked replayOnly'))).toBe(true);
    expect(failures.some((issue) => issue.includes('exactly one tracker'))).toBe(true);
  });

  it('rejects an unknown disposition and an invalid ledger state', () => {
    const manifest = baseManifest(archiveDir);
    manifest.files[0].disposition = 'maybe-later';
    manifest.files[0].ledger = { dev: 'probably', prod: 'applied' };
    const { failures } = evaluateArchive({ archiveDir, manifest });
    expect(failures.some((issue) => issue.includes('unknown disposition'))).toBe(true);
    expect(failures.some((issue) => issue.includes('no valid dev ledger state'))).toBe(true);
  });

  it('rejects a manifest entry with a malformed hash', () => {
    const manifest = baseManifest(archiveDir);
    manifest.files[0].sha256 = 'not-a-hash';
    manifest.files[0].blob = 'nope';
    const { failures } = evaluateArchive({ archiveDir, manifest });
    expect(failures).toContain(`${FORWARD} has no valid sha256.`);
    expect(failures).toContain(`${FORWARD} has no valid git blob sha.`);
  });
});

describe('evaluateDevManifestAgreement', () => {
  it('passes when both manifests classify the same files the same way', () => {
    const manifest = {
      files: [
        { name: 'a.sql', disposition: 'blocked' },
        { name: 'b.sql', disposition: 'deferred' },
        { name: 'c.sql', disposition: 'adopted-elsewhere' },
        { name: 'd.sql', disposition: 'applied' },
      ],
    };
    const devManifest = {
      blockedMigrations: [{ name: 'a.sql', reason: 'x' }],
      deferredMigrations: [{ name: 'b.sql', reason: 'y' }],
      adoptedElsewhere: [{ name: 'c.sql', adoptedAs: 'z' }],
    };
    expect(evaluateDevManifestAgreement({ manifest, devManifest }).failures).toEqual([]);
  });

  it('reports drift in both directions', () => {
    const manifest = { files: [{ name: 'a.sql', disposition: 'blocked' }] };
    const devManifest = { blockedMigrations: [{ name: 'other.sql', reason: 'x' }] };
    const { failures } = evaluateDevManifestAgreement({ manifest, devManifest });
    expect(failures).toContain('a.sql is blocked in the archive but not in the dev manifest.');
    expect(failures).toContain('other.sql is blocked in the dev manifest but not in the archive.');
  });

  it('accepts plain-string dev manifest entries', () => {
    const manifest = { files: [{ name: 'a.sql', disposition: 'blocked' }] };
    const devManifest = { blockedMigrations: ['a.sql'] };
    expect(evaluateDevManifestAgreement({ manifest, devManifest }).failures).toEqual([]);
  });
});
