#!/usr/bin/env node
// Resolves the previous successful release SHA (N-1) for the upgrade replay gate.
// Source of truth is the company repository main tip: once the promotion pipeline
// is live every release lands as a merge commit carrying a `Release-Source:`
// trailer, and during the legacy fast-forward mirror era the tip itself IS the
// last released source SHA (bootstrap rule). `UPGRADE_REPLAY_BASE_OVERRIDE` is the
// documented emergency escape hatch and must stay empty in normal operation.

import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

export const COMPANY_REPOSITORY = 'keduall/topik-admin';
const SHA_PATTERN = /^[0-9a-f]{40}$/;

export function parseReleaseSource(message) {
  const match = /(^|\n)Release-Source:[ \t]*([0-9a-f]{40})\s*(\r?\n|$)/i.exec(message ?? '');
  return match ? match[2].toLowerCase() : null;
}

export function resolvePreviousRelease({ tipSha, tipMessage, override = null }) {
  if (override) {
    if (!SHA_PATTERN.test(override)) {
      throw new Error('UPGRADE_REPLAY_BASE_OVERRIDE must be a 40-hex commit SHA.');
    }
    return { sha: override, source: 'override' };
  }
  if (!SHA_PATTERN.test(tipSha ?? '')) {
    throw new Error('The company main tip SHA is unavailable.');
  }
  const trailer = parseReleaseSource(tipMessage);
  if (trailer) return { sha: trailer, source: 'release-source-trailer' };
  return { sha: tipSha, source: 'mirror-tip-bootstrap' };
}

export async function fetchCompanyMainTip({
  repository = COMPANY_REPOSITORY,
  token,
  fetchImpl = fetch
} = {}) {
  if (!token) {
    throw new Error(
      'COMPANY_RELEASE_READ_TOKEN is required to read the company main tip '
      + '(register the PROMOTION_GITHUB_TOKEN secret, or set the '
      + 'UPGRADE_REPLAY_BASE_OVERRIDE variable for an emergency release).'
    );
  }
  const response = await fetchImpl(`https://api.github.com/repos/${repository}/commits/main`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    }
  });
  if (!response.ok) {
    throw new Error(`Company main tip lookup failed: HTTP ${response.status}`);
  }
  const body = await response.json();
  return { tipSha: body.sha, tipMessage: body.commit?.message ?? '' };
}

async function main() {
  const override = process.env.UPGRADE_REPLAY_BASE_OVERRIDE?.trim() || null;
  if (override) {
    const resolved = resolvePreviousRelease({ tipSha: null, tipMessage: null, override });
    console.error(`[previous-release] source=${resolved.source}`);
    console.log(resolved.sha);
    return;
  }
  const tip = await fetchCompanyMainTip({ token: process.env.COMPANY_RELEASE_READ_TOKEN?.trim() });
  const resolved = resolvePreviousRelease(tip);
  console.error(`[previous-release] source=${resolved.source} tip=${tip.tipSha.slice(0, 7)}`);
  console.log(resolved.sha);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    await main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
