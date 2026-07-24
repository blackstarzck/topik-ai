#!/usr/bin/env node
// Staging evidence for the company promotion pipeline. Verifies that the stg tip
// is a gated release merge bound to the personally validated source (trailer,
// tree, migration digest, development evidence) and records the staging checks
// the main promotion gate re-verifies. topik-dev is reused, never re-applied.

import { spawnSync } from 'node:child_process';
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { verifyDevelopmentEvidence } from './verify-development-evidence.mjs';
import { computeMigrationDigest } from './compute-migration-digest.mjs';
import { parseReleaseSource } from './resolve-previous-release.mjs';
import { fetchDevelopmentEvidence } from './company-promotion-gate.mjs';

function value(args, flag, { required = true } = {}) {
  const index = args.indexOf(flag);
  if (index < 0 || !args[index + 1]) {
    if (!required) return null;
    throw new Error(`${flag} is required.`);
  }
  return args[index + 1];
}

function git(args) {
  const result = spawnSync('git', args, { encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${(result.stderr || result.stdout).trim()}`);
  }
  return result.stdout.trim();
}

export function buildStagingEvidence({ stgSha, sourceSha, sourceTreeSha, migrationDigest, releasePlan }) {
  const releasesRuntime = releasePlan !== 'sync-only';
  return {
    schemaVersion: 1,
    stage: 'staging',
    validatedAt: new Date().toISOString(),
    stgMergeSha: stgSha,
    sourceSha,
    sourceTreeSha,
    migrationDigest,
    releasePlan,
    // The MCP browser verification updates this to true via the release manifest
    // tooling before a deploying plan may promote to main.
    mcpVerified: false,
    checks: {
      sourceBinding: 'passed',
      trackerReuse: releasesRuntime ? 'passed' : 'not-required',
      usersContract: releasesRuntime ? 'passed' : 'not-required'
    }
  };
}

async function main() {
  const args = process.argv.slice(2);
  const stgSha = value(args, '--stg-sha');
  const headMessage = git(['log', '-1', '--format=%B', stgSha]);
  const sourceSha = parseReleaseSource(headMessage);
  if (!sourceSha) {
    throw new Error('stg tip has no Release-Source trailer — only gated promotion merges may reach stg.');
  }
  const sourceTreeSha = git(['rev-parse', `${sourceSha}^{tree}`]);
  const stgTreeSha = git(['rev-parse', `${stgSha}^{tree}`]);
  if (stgTreeSha !== sourceTreeSha) {
    throw new Error(`stg tree ${stgTreeSha} diverges from source tree ${sourceTreeSha} — company drift is forbidden.`);
  }
  const migrationDigest = computeMigrationDigest();
  const { evidence } = await fetchDevelopmentEvidence({
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

  const githubOutput = value(args, '--github-output', { required: false });
  if (githubOutput) {
    appendFileSync(
      resolve(githubOutput),
      `release_plan=${evidence.releasePlan}\nsource_sha=${sourceSha}\n`,
      'utf8'
    );
  }
  const jsonOut = value(args, '--json-out', { required: false });
  if (jsonOut) {
    const report = buildStagingEvidence({
      stgSha,
      sourceSha,
      sourceTreeSha,
      migrationDigest,
      releasePlan: evidence.releasePlan
    });
    const absolutePath = resolve(jsonOut);
    mkdirSync(dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  }
  console.log(`Staging evidence verified for ${sourceSha} (${evidence.releasePlan}).`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    await main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
