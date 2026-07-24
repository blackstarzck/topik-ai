#!/usr/bin/env node
// Sole entrance to production mutations. GitHub Free cannot server-enforce the
// company branch protections, so every push to company main is re-verified here
// from scratch: a direct push, a missing or stale attestation, unresolved review
// threads, missing staging evidence, or any tree/digest mismatch leaves the
// database and Vercel untouched.

import { spawnSync } from 'node:child_process';
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { verifyDevelopmentEvidence } from './verify-development-evidence.mjs';
import { computeMigrationDigest } from './compute-migration-digest.mjs';
import { parseReleaseSource } from './resolve-previous-release.mjs';
import { extractJsonFromZip, fetchDevelopmentEvidence } from './company-promotion-gate.mjs';

const ATTESTOR = 'blackstarzck';
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

async function githubApi(path, token, { raw = false, method = 'GET', body = null } = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: raw ? 'application/vnd.github.v3.raw' : 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!response.ok) throw new Error(`GitHub API ${path} failed: HTTP ${response.status}`);
  return raw ? response.arrayBuffer() : response.json();
}

export function parseAttestationBody(body) {
  const match = /```json\s*\n([\s\S]*?)\n\s*```/.exec(body ?? '');
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1]);
    return parsed.kind === 'promotion-attestation' ? parsed : null;
  } catch {
    return null;
  }
}

export function verifyReleaseShape({ tipSha, tipMessage, parents }) {
  const issues = [];
  if (parents.length !== 2) issues.push('direct-main-push:not-a-merge-commit');
  const sourceSha = parseReleaseSource(tipMessage);
  if (!sourceSha) issues.push('direct-main-push:missing-release-source-trailer');
  if (!SHA_PATTERN.test(tipSha ?? '')) issues.push('invalid-tip-sha');
  return { issues, sourceSha };
}

export function verifyAttestation({ attestation, expected }) {
  const issues = [];
  if (!attestation) {
    issues.push('missing-attestation');
    return issues;
  }
  if (attestation.target !== 'main') issues.push('attestation-wrong-target');
  for (const field of ['sourceSha', 'sourceTreeSha', 'migrationDigest', 'headSha', 'baseTipSha']) {
    if (attestation[field] !== expected[field]) issues.push(`stale-attestation:${field}`);
  }
  return issues;
}

async function main() {
  const args = process.argv.slice(2);
  const tipSha = value(args, '--tip-sha');
  const evidenceDir = resolve(value(args, '--evidence-dir'));
  const jsonOut = resolve(value(args, '--json-out'));
  const repository = process.env.GITHUB_REPOSITORY;
  const repoToken = process.env.GH_TOKEN?.trim();
  if (!repository || !repoToken) throw new Error('GITHUB_REPOSITORY and GH_TOKEN are required.');

  const tipMessage = git(['log', '-1', '--format=%B', tipSha]).stdout;
  const parents = git(['log', '-1', '--format=%P', tipSha]).stdout.trim().split(/\s+/).filter(Boolean);
  const shape = verifyReleaseShape({ tipSha, tipMessage, parents });
  const issues = [...shape.issues];
  const sourceSha = shape.sourceSha;
  const stgTipSha = parents[1] ?? null;
  const previousMainSha = parents[0] ?? null;

  let releasePlan = null;
  if (issues.length === 0) {
    const sourceTreeSha = git(['rev-parse', `${sourceSha}^{tree}`]).stdout.trim();
    const tipTreeSha = git(['rev-parse', `${tipSha}^{tree}`]).stdout.trim();
    if (tipTreeSha !== sourceTreeSha) issues.push('company-drift:tip-tree');
    const migrationDigest = computeMigrationDigest();

    // The merged PR whose merge commit is exactly this tip.
    const pulls = await githubApi(`/repos/${repository}/commits/${tipSha}/pulls`, repoToken);
    const pr = pulls.find((entry) => entry.merge_commit_sha === tipSha && entry.base?.ref === 'main');
    if (!pr) {
      issues.push('direct-main-push:no-merged-pr');
    } else {
      if (pr.head?.sha !== stgTipSha) issues.push('stale-attestation:pr-head-vs-merge-parent');

      const reviews = await githubApi(`/repos/${repository}/pulls/${pr.number}/reviews?per_page=100`, repoToken);
      const attested = reviews
        .filter((review) => review.user?.login === ATTESTOR && review.state === 'APPROVED')
        .map((review) => ({ review, attestation: parseAttestationBody(review.body) }))
        .filter((entry) => entry.attestation)
        .at(-1);
      const attestationIssues = verifyAttestation({
        attestation: attested?.attestation ?? null,
        expected: {
          sourceSha,
          sourceTreeSha,
          migrationDigest,
          headSha: stgTipSha,
          baseTipSha: previousMainSha
        }
      });
      issues.push(...attestationIssues);
      if (attested && attested.review.commit_id !== stgTipSha) {
        issues.push('stale-attestation:review-commit');
      }

      const threads = await githubApi(
        '/graphql',
        repoToken,
        {
          method: 'POST',
          body: {
            query: `query($owner:String!,$name:String!,$number:Int!){repository(owner:$owner,name:$name){pullRequest(number:$number){reviewThreads(first:100){nodes{isResolved}}}}}`,
            variables: {
              owner: repository.split('/')[0],
              name: repository.split('/')[1],
              number: pr.number
            }
          }
        }
      );
      const unresolved = threads.data?.repository?.pullRequest?.reviewThreads?.nodes
        ?.filter((node) => node.isResolved === false).length ?? 0;
      if (unresolved > 0) issues.push('unresolved-review-threads');
    }

    // Staging evidence bound to the merged stg tip.
    const artifacts = await githubApi(
      `/repos/${repository}/actions/artifacts?name=staging-evidence-${stgTipSha}&per_page=5`,
      repoToken
    );
    const stagingArtifact = artifacts.artifacts?.[0];
    if (!stagingArtifact) {
      issues.push('missing-staging-evidence');
    } else {
      const zip = Buffer.from(await githubApi(
        `/repos/${repository}/actions/artifacts/${stagingArtifact.id}/zip`,
        repoToken,
        { raw: true }
      ));
      const staging = extractJsonFromZip(zip, 'staging.json');
      if (staging.sourceSha !== sourceSha || staging.stgMergeSha !== stgTipSha) {
        issues.push('staging-evidence-binding-mismatch');
      }
      releasePlan = staging.releasePlan;
      if (staging.releasePlan !== 'sync-only' && staging.mcpVerified !== true) {
        issues.push('missing-mcp-staging-verification');
      }
    }

    // Development evidence for the source SHA, re-verified against this checkout.
    try {
      const { evidence } = await fetchDevelopmentEvidence({
        sourceSha,
        token: process.env.EVIDENCE_GITHUB_TOKEN?.trim()
      });
      issues.push(...verifyDevelopmentEvidence(evidence, {
        commitSha: sourceSha,
        sourceTreeSha,
        migrationDigest
      }));
      releasePlan = releasePlan ?? evidence.releasePlan;
      mkdirSync(evidenceDir, { recursive: true });
      writeFileSync(join(evidenceDir, 'development.json'), `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
    } catch (error) {
      issues.push(`development-evidence:${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const deployApp = releasePlan === 'app-only' || releasePlan === 'app-db';
  const applyMigrations = releasePlan === 'db-only' || releasePlan === 'app-db';
  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    tipSha,
    sourceSha: sourceSha ?? null,
    stgTipSha,
    previousMainSha,
    releasePlan,
    deployApp,
    applyMigrations,
    clean: issues.length === 0,
    issues
  };
  mkdirSync(dirname(jsonOut), { recursive: true });
  writeFileSync(jsonOut, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  const githubOutput = value(args, '--github-output', { required: false });
  if (githubOutput && issues.length === 0) {
    appendFileSync(
      resolve(githubOutput),
      `release_plan=${releasePlan}\ndeploy_app=${deployApp}\napply_migrations=${applyMigrations}\nsource_sha=${sourceSha}\n`,
      'utf8'
    );
  }
  if (issues.length > 0) {
    for (const issue of issues) console.error(`[company-release] ${issue}`);
    process.exit(1);
  }
  console.log(`Company release verified for ${sourceSha} (${releasePlan}).`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    await main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
