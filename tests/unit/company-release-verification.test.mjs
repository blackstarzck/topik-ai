import { deflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import {
  extractJsonFromZip,
  resolveSourceSha
} from '../../scripts/ci/company-promotion-gate.mjs';
import {
  parseAttestationBody,
  verifyAttestation,
  verifyReleaseShape
} from '../../scripts/ci/verify-company-release.mjs';
import { buildStagingEvidence } from '../../scripts/ci/write-stg-evidence.mjs';
import { parseMcpComment, verifyMcpEvidence } from '../../scripts/ci/verify-mcp-evidence.mjs';
import { buildStgEvidenceComment } from '../../scripts/ci/release-manifest.mjs';

const SHA_A = 'a'.repeat(40);
const SHA_B = 'b'.repeat(40);
const SHA_C = 'c'.repeat(40);
const TREE = 'd'.repeat(40);
const DIGEST = 'e'.repeat(64);

// Build a complete zip the way GitHub artifact zips are written: streaming, with
// the data-descriptor flag set and zeroed sizes in the local header, so the
// authoritative sizes live only in the central directory.
function buildZip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const { name, content, deflate = false } of entries) {
    const nameBuffer = Buffer.from(name, 'utf8');
    const raw = Buffer.from(content, 'utf8');
    const data = deflate ? deflateRawSync(raw) : raw;
    const method = deflate ? 8 : 0;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(0x0008, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(0, 18);
    local.writeUInt32LE(0, 22);
    local.writeUInt16LE(nameBuffer.length, 26);
    local.writeUInt16LE(0, 28);
    const localRecord = Buffer.concat([local, nameBuffer, data]);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(0x0008, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(nameBuffer.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(Buffer.concat([central, nameBuffer]));
    locals.push(localRecord);
    offset += localRecord.length;
  }
  const localBlob = Buffer.concat(locals);
  const centralBlob = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralBlob.length, 12);
  eocd.writeUInt32LE(localBlob.length, 16);
  return Buffer.concat([localBlob, centralBlob, eocd]);
}

describe('promotion source resolution', () => {
  it('uses the promote head for stg PRs and the trailer for main PRs', () => {
    expect(resolveSourceSha({ baseRef: 'stg', headSha: SHA_A, headMessage: 'promote' }))
      .toEqual({ sourceSha: SHA_A, via: 'promote-head' });
    expect(resolveSourceSha({
      baseRef: 'main',
      headSha: SHA_B,
      headMessage: `release: stg merge\n\nRelease-Source: ${SHA_A}\n`
    })).toEqual({ sourceSha: SHA_A, via: 'stg-merge-trailer' });
    expect(() => resolveSourceSha({ baseRef: 'main', headSha: SHA_B, headMessage: 'no trailer' }))
      .toThrow('Release-Source');
    expect(() => resolveSourceSha({ baseRef: 'develop', headSha: SHA_B, headMessage: '' }))
      .toThrow('Unsupported promotion base');
  });

  it('reads stored and deflated entries via the central directory', () => {
    const zip = buildZip([
      { name: 'development.json', content: JSON.stringify({ ok: 1 }) },
      { name: 'nested/staging.json', content: JSON.stringify({ ok: 2 }), deflate: true },
    ]);
    expect(extractJsonFromZip(zip, 'development.json')).toEqual({ ok: 1 });
    expect(extractJsonFromZip(zip, 'staging.json')).toEqual({ ok: 2 });
    expect(() => extractJsonFromZip(zip, 'missing.json')).toThrow('was not found');
  });
});

describe('company release verification', () => {
  it('flags direct pushes that are not gated release merges', () => {
    expect(verifyReleaseShape({
      tipSha: SHA_C,
      tipMessage: 'docs: direct push',
      parents: [SHA_B]
    }).issues).toEqual(expect.arrayContaining([
      'direct-main-push:not-a-merge-commit',
      'direct-main-push:missing-release-source-trailer'
    ]));

    const merged = verifyReleaseShape({
      tipSha: SHA_C,
      tipMessage: `release: db-only\n\nRelease-Source: ${SHA_A}\n`,
      parents: [SHA_B, SHA_A]
    });
    expect(merged.issues).toEqual([]);
    expect(merged.sourceSha).toBe(SHA_A);
  });

  it('parses fenced attestation JSON and rejects other review bodies', () => {
    const body = [
      'Promotion attestation.',
      '```json',
      JSON.stringify({ kind: 'promotion-attestation', target: 'main', sourceSha: SHA_A }),
      '```'
    ].join('\n');
    expect(parseAttestationBody(body)).toEqual(expect.objectContaining({ sourceSha: SHA_A }));
    expect(parseAttestationBody('LGTM')).toBeNull();
    expect(parseAttestationBody('```json\n{"kind":"something-else"}\n```')).toBeNull();
  });

  it('rejects missing or stale attestations field by field', () => {
    const expected = {
      sourceSha: SHA_A,
      sourceTreeSha: TREE,
      migrationDigest: DIGEST,
      headSha: SHA_B,
      baseTipSha: SHA_C
    };
    expect(verifyAttestation({ attestation: null, expected })).toEqual(['missing-attestation']);
    expect(verifyAttestation({
      attestation: { kind: 'promotion-attestation', target: 'main', ...expected },
      expected
    })).toEqual([]);
    expect(verifyAttestation({
      attestation: {
        kind: 'promotion-attestation',
        target: 'main',
        ...expected,
        sourceTreeSha: 'f'.repeat(40),
        baseTipSha: SHA_A
      },
      expected
    })).toEqual(expect.arrayContaining([
      'stale-attestation:sourceTreeSha',
      'stale-attestation:baseTipSha'
    ]));
  });

  it('builds staging evidence that binds source, tree, digest, and plan', () => {
    const staging = buildStagingEvidence({
      stgSha: SHA_B,
      sourceSha: SHA_A,
      sourceTreeSha: TREE,
      migrationDigest: DIGEST,
      releasePlan: 'db-only',
      deploymentUrl: 'https://preview.example.test'
    });
    expect(staging).toEqual(expect.objectContaining({
      stage: 'staging',
      stgMergeSha: SHA_B,
      sourceSha: SHA_A,
      stagingDeploymentUrl: 'https://preview.example.test'
    }));
    expect(staging.checks.trackerReuse).toBe('passed');
    expect(staging.checks.previewDeploy).toBe('passed');
    expect(buildStagingEvidence({
      stgSha: SHA_B,
      sourceSha: SHA_A,
      sourceTreeSha: TREE,
      migrationDigest: DIGEST,
      releasePlan: 'sync-only'
    }).checks.trackerReuse).toBe('not-required');
  });
});

describe('MCP staging verification evidence', () => {
  function mcpComment(overrides = {}) {
    const payload = {
      kind: 'mcp-stg-evidence',
      sourceSha: SHA_A,
      stgMergeSha: SHA_B,
      deploymentUrl: 'https://preview.example.test',
      checklist: {
        login: 'pass',
        coreFlows: 'pass',
        consoleErrors: 'pass',
        failedRequests: 'pass',
        baselineCompared: 'pass',
        shaMatch: 'pass',
        screenshotsSaved: 'pass'
      },
      verdict: 'pass',
      verifiedAt: '2026-07-24T00:00:00.000Z',
      ...overrides
    };
    return {
      author: 'guestkeduall-design',
      body: `MCP-STG-EVIDENCE summary\n\n\`\`\`json\n${JSON.stringify(payload, null, 2)}\n\`\`\``
    };
  }

  it('accepts a bound passing comment from an allowed author only', () => {
    const expected = { sourceSha: SHA_A, stgMergeSha: SHA_B, deploymentUrl: null };
    expect(verifyMcpEvidence({ comments: [mcpComment()], expected }).issues).toEqual([]);
    expect(verifyMcpEvidence({
      comments: [{ ...mcpComment(), author: 'random-user' }],
      expected
    }).issues).toEqual(['missing-mcp-evidence-comment']);
    expect(verifyMcpEvidence({ comments: [], expected }).issues)
      .toEqual(['missing-mcp-evidence-comment']);
  });

  it('rejects SHA mismatches, failed verdicts, and incomplete checklists', () => {
    const expected = { sourceSha: SHA_A, stgMergeSha: SHA_B, deploymentUrl: null };
    expect(verifyMcpEvidence({
      comments: [mcpComment({ sourceSha: SHA_C })],
      expected
    }).issues).toContain('mcp-evidence:source-sha-mismatch');
    expect(verifyMcpEvidence({
      comments: [mcpComment({ verdict: 'fail' })],
      expected
    }).issues).toContain('mcp-evidence:verdict-not-pass');
    expect(verifyMcpEvidence({
      comments: [mcpComment({ checklist: { login: 'pass' } })],
      expected
    }).issues).toContain('mcp-evidence:checklist-consoleErrors');
    expect(parseMcpComment('plain comment')).toBeNull();
  });

  it('renders a postable comment only from a completed manifest stage', () => {
    const manifest = {
      sourceSha: SHA_A,
      stgMergeSha: SHA_B,
      stg: {
        deploymentUrl: 'https://preview.example.test',
        deploymentId: 'dpl_1',
        checklist: {
          login: 'pass',
          coreFlows: 'pass',
          consoleErrors: 'pass',
          failedRequests: 'pass',
          baselineCompared: 'pass',
          shaMatch: 'pass',
          screenshotsSaved: 'pass'
        },
        screenshots: ['abc123'],
        verdict: 'pass',
        verifiedAt: '2026-07-24T00:00:00.000Z',
        summary: 'all core flows verified'
      }
    };
    const body = buildStgEvidenceComment(manifest);
    expect(parseMcpComment(body)).toEqual(expect.objectContaining({ sourceSha: SHA_A }));

    manifest.stg.checklist.shaMatch = 'pending';
    expect(() => buildStgEvidenceComment(manifest)).toThrow('not complete');
  });
});
