#!/usr/bin/env node
// Company-side promotion gate. Runs from the checked-out PR head inside
// keduall/topik-admin and fails closed unless the promoted head is exactly the
// personally validated source: same commit lineage, same tree, same migration
// digest, verified development evidence, and (for stg→main) verified staging
// evidence. Company-side conflict resolution is forbidden — any divergence is
// reported as COMPANY_DRIFT and must be fixed in the source repository.

import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { inflateRawSync } from 'node:zlib';
import { verifyDevelopmentEvidence } from './verify-development-evidence.mjs';
import { computeMigrationDigest } from './compute-migration-digest.mjs';
import { parseReleaseSource } from './resolve-previous-release.mjs';
import { verifyMcpEvidence } from './verify-mcp-evidence.mjs';

const SOURCE_REPOSITORY = process.env.SOURCE_REPOSITORY || 'blackstarzck/topik-ai';
const SHA_PATTERN = /^[0-9a-f]{40}$/;

function value(args, flag, { required = true } = {}) {
  const index = args.indexOf(flag);
  if (index < 0 || !args[index + 1]) {
    if (!required) return null;
    throw new Error(`${flag} is required.`);
  }
  return args[index + 1];
}

function git(args, { allowFailure = false } = {}) {
  const result = spawnSync('git', args, { encoding: 'utf8', windowsHide: true });
  if (result.status !== 0 && !allowFailure) {
    throw new Error(`git ${args.join(' ')} failed: ${(result.stderr || result.stdout).trim()}`);
  }
  return { status: result.status ?? 1, stdout: result.stdout || '', stderr: result.stderr || '' };
}

async function githubApi(path, token, { raw = false } = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: raw ? 'application/vnd.github.v3.raw' : 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    }
  });
  if (!response.ok) throw new Error(`GitHub API ${path} failed: HTTP ${response.status}`);
  return raw ? response.arrayBuffer() : response.json();
}

// Downloads development-evidence-<sourceSha> produced by the source repository's
// successful main validation run. Artifacts are same-repo scoped, so the company
// side reads them through the API with an actions:read token.
export async function fetchDevelopmentEvidence({ sourceSha, token, repository = SOURCE_REPOSITORY }) {
  if (!token) {
    throw new Error('EVIDENCE_GITHUB_TOKEN is required to read source-repository evidence.');
  }
  const runs = await githubApi(
    `/repos/${repository}/actions/workflows/release-development.yml/runs?head_sha=${sourceSha}&branch=main&status=success&per_page=5`,
    token
  );
  const run = runs.workflow_runs?.[0];
  if (!run) throw new Error(`No successful main validation run found for ${sourceSha}.`);
  const artifacts = await githubApi(`/repos/${repository}/actions/runs/${run.id}/artifacts?per_page=50`, token);
  const artifact = artifacts.artifacts?.find((entry) => entry.name === `development-evidence-${sourceSha}`);
  if (!artifact) throw new Error(`development-evidence-${sourceSha} artifact is missing on run ${run.id}.`);
  const zipBuffer = Buffer.from(await githubApi(
    `/repos/${repository}/actions/artifacts/${artifact.id}/zip`,
    token,
    { raw: true }
  ));
  const evidence = extractJsonFromZip(zipBuffer, 'development.json');
  return { evidence, runUrl: run.html_url };
}

// Minimal STORED-entry zip reader — GitHub artifact zips store small JSON files
// uncompressed; fall back to inflateRawSync for DEFLATE entries.
export function extractJsonFromZip(zipBuffer, fileName) {
  // GitHub artifact zips are stream-written with data descriptors, so a local
  // file header's compressed size is unreliable (often 0). The central directory
  // holds the authoritative sizes and offsets, so entries are located through it.
  const EOCD_SIGNATURE = 0x06054b50;
  const CENTRAL_SIGNATURE = 0x02014b50;
  let eocd = -1;
  for (let i = zipBuffer.length - 22; i >= 0; i -= 1) {
    if (zipBuffer.readUInt32LE(i) === EOCD_SIGNATURE) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('ZIP end-of-central-directory record not found.');
  const entryCount = zipBuffer.readUInt16LE(eocd + 10);
  let pointer = zipBuffer.readUInt32LE(eocd + 16);
  for (let index = 0; index < entryCount; index += 1) {
    if (zipBuffer.readUInt32LE(pointer) !== CENTRAL_SIGNATURE) break;
    const method = zipBuffer.readUInt16LE(pointer + 10);
    const compressedSize = zipBuffer.readUInt32LE(pointer + 20);
    const nameLength = zipBuffer.readUInt16LE(pointer + 28);
    const extraLength = zipBuffer.readUInt16LE(pointer + 30);
    const commentLength = zipBuffer.readUInt16LE(pointer + 32);
    const localOffset = zipBuffer.readUInt32LE(pointer + 42);
    const name = zipBuffer.slice(pointer + 46, pointer + 46 + nameLength).toString('utf8');
    if (name === fileName || name.endsWith(`/${fileName}`)) {
      const localNameLength = zipBuffer.readUInt16LE(localOffset + 26);
      const localExtraLength = zipBuffer.readUInt16LE(localOffset + 28);
      const dataStart = localOffset + 30 + localNameLength + localExtraLength;
      const data = zipBuffer.slice(dataStart, dataStart + compressedSize);
      if (method === 0) return JSON.parse(data.toString('utf8'));
      if (method === 8) return JSON.parse(inflateRawSync(data).toString('utf8'));
      throw new Error(`Unsupported zip compression method ${method} for ${name}.`);
    }
    pointer += 46 + nameLength + extraLength + commentLength;
  }
  throw new Error(`${fileName} was not found in the artifact zip.`);
}

export function resolveSourceSha({ baseRef, headSha, headMessage }) {
  if (baseRef === 'stg') {
    return { sourceSha: headSha, via: 'promote-head' };
  }
  if (baseRef === 'main') {
    const trailer = parseReleaseSource(headMessage);
    if (!trailer) {
      throw new Error('stg tip has no Release-Source trailer — only gated stg merges may promote to main.');
    }
    return { sourceSha: trailer, via: 'stg-merge-trailer' };
  }
  throw new Error(`Unsupported promotion base: ${baseRef}`);
}

// COMPANY_DRIFT check: merging the head into the base must reproduce the source
// tree exactly; conflicts or extra company-side content block the promotion.
export function checkCompanyDrift({ baseSha, headSha, sourceTreeSha }) {
  const merge = git(['merge-tree', '--write-tree', baseSha, headSha], { allowFailure: true });
  if (merge.status !== 0) {
    return { drift: true, reason: 'merge-conflict' };
  }
  const mergedTree = merge.stdout.trim().split(/\r?\n/)[0];
  if (mergedTree !== sourceTreeSha) {
    return { drift: true, reason: 'merged-tree-diverges-from-source', mergedTree };
  }
  return { drift: false, mergedTree };
}

async function main() {
  const args = process.argv.slice(2);
  const printIndex = args.indexOf('--print-attestation');
  if (printIndex >= 0) {
    const report = JSON.parse(readFileSync(resolve(args[printIndex + 1]), 'utf8'));
    console.log([
      'Promotion attestation (automated, AGENTS §11.1 routing).',
      '',
      '```json',
      JSON.stringify(report.attestation, null, 2),
      '```'
    ].join('\n'));
    return;
  }

  const baseRef = value(args, '--base-ref');
  const baseSha = value(args, '--base-sha');
  const headSha = value(args, '--head-sha');
  const prNumber = Number(value(args, '--pr-number'));
  const jsonOut = resolve(value(args, '--json-out'));
  if (!SHA_PATTERN.test(headSha) || !SHA_PATTERN.test(baseSha)) {
    throw new Error('base and head SHAs must be 40-hex commits.');
  }

  const headMessage = git(['log', '-1', '--format=%B', headSha]).stdout;
  const { sourceSha, via } = resolveSourceSha({ baseRef, headSha, headMessage });
  if (!SHA_PATTERN.test(sourceSha)) throw new Error('resolved source SHA is invalid.');

  const sourceTreeSha = git(['rev-parse', `${sourceSha}^{tree}`]).stdout.trim();
  const headTreeSha = git(['rev-parse', `${headSha}^{tree}`]).stdout.trim();
  if (headTreeSha !== sourceTreeSha) {
    throw new Error(`COMPANY_DRIFT: promoted head tree ${headTreeSha} differs from source tree ${sourceTreeSha} — fix in ${SOURCE_REPOSITORY}, never here.`);
  }

  const migrationDigest = computeMigrationDigest();
  const { evidence, runUrl } = await fetchDevelopmentEvidence({
    sourceSha,
    token: process.env.EVIDENCE_GITHUB_TOKEN?.trim()
  });
  const issues = verifyDevelopmentEvidence(evidence, {
    commitSha: sourceSha,
    sourceTreeSha,
    migrationDigest
  });
  if (issues.length > 0) {
    throw new Error(`development evidence verification failed: ${issues.join(', ')}`);
  }

  const drift = checkCompanyDrift({ baseSha, headSha, sourceTreeSha });
  if (drift.drift) {
    throw new Error(`COMPANY_DRIFT: ${drift.reason} — resolve in ${SOURCE_REPOSITORY} and re-promote.`);
  }

  let staging = null;
  if (baseRef === 'main') {
    const ghToken = process.env.GH_TOKEN?.trim();
    const artifacts = await githubApi(
      `/repos/${process.env.GITHUB_REPOSITORY}/actions/artifacts?name=staging-evidence-${headSha}&per_page=5`,
      ghToken
    );
    const artifact = artifacts.artifacts?.[0];
    if (!artifact) {
      throw new Error(`staging-evidence-${headSha} is missing — the company stg validation must succeed before a main promotion.`);
    }
    const zipBuffer = Buffer.from(await githubApi(
      `/repos/${process.env.GITHUB_REPOSITORY}/actions/artifacts/${artifact.id}/zip`,
      ghToken,
      { raw: true }
    ));
    staging = extractJsonFromZip(zipBuffer, 'staging.json');
    if (staging.sourceSha !== sourceSha || staging.stgMergeSha !== headSha) {
      throw new Error('staging evidence does not bind to this source and stg tip.');
    }
    if (staging.releasePlan !== 'sync-only') {
      // Deploying plans additionally need the Playwright MCP staging verification
      // posted on this PR by a release controller session.
      const comments = await githubApi(
        `/repos/${process.env.GITHUB_REPOSITORY}/issues/${prNumber}/comments?per_page=100`,
        ghToken
      );
      const { issues: mcpIssues } = verifyMcpEvidence({
        comments: comments.map((comment) => ({ author: comment.user?.login, body: comment.body })),
        expected: { sourceSha, stgMergeSha: headSha, deploymentUrl: staging.stagingDeploymentUrl ?? null }
      });
      if (mcpIssues.length > 0) {
        throw new Error(`MCP staging verification failed: ${mcpIssues.join(', ')}`);
      }
    }
  }

  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    baseRef,
    prNumber,
    sourceResolvedVia: via,
    releasePlan: evidence.releasePlan,
    developmentRunUrl: runUrl,
    staging,
    attestation: {
      schemaVersion: 1,
      kind: 'promotion-attestation',
      target: baseRef,
      sourceSha,
      sourceTreeSha,
      migrationDigest,
      baseTipSha: baseSha,
      headSha,
      releasePlan: evidence.releasePlan,
      developmentRunUrl: runUrl,
      verifiedAt: new Date().toISOString()
    }
  };
  mkdirSync(dirname(jsonOut), { recursive: true });
  writeFileSync(jsonOut, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`Promotion gate passed for ${sourceSha} → ${baseRef} (${evidence.releasePlan}).`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    await main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
