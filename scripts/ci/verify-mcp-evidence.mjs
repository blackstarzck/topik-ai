#!/usr/bin/env node
// Verifies the Playwright MCP browser-verification evidence that a release
// controller session posts as an `MCP-STG-EVIDENCE` fenced-JSON comment on the
// stg→main promotion PR. Deploying release plans may not promote to main without
// a passing, correctly-bound comment; sync-only plans need none.

import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const MCP_STG_MARKER = 'MCP-STG-EVIDENCE';
const ALLOWED_AUTHORS = new Set(['blackstarzck', 'guestkeduall-design']);
const REQUIRED_CHECKLIST = [
  'login',
  'coreFlows',
  'consoleErrors',
  'failedRequests',
  'shaMatch',
  'screenshotsSaved'
];

export function parseMcpComment(body) {
  if (!body?.includes(MCP_STG_MARKER)) return null;
  const match = /```json\s*\n([\s\S]*?)\n\s*```/.exec(body);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1]);
    return parsed.kind === 'mcp-stg-evidence' ? parsed : null;
  } catch {
    return null;
  }
}

export function verifyMcpEvidence({ comments, expected }) {
  const issues = [];
  const candidates = (comments ?? [])
    .filter((comment) => ALLOWED_AUTHORS.has(comment.author))
    .map((comment) => parseMcpComment(comment.body))
    .filter(Boolean);
  const evidence = candidates.at(-1) ?? null;
  if (!evidence) {
    issues.push('missing-mcp-evidence-comment');
    return { issues, evidence: null };
  }
  if (evidence.sourceSha !== expected.sourceSha) issues.push('mcp-evidence:source-sha-mismatch');
  if (evidence.stgMergeSha !== expected.stgMergeSha) issues.push('mcp-evidence:stg-sha-mismatch');
  if (expected.deploymentUrl && evidence.deploymentUrl !== expected.deploymentUrl) {
    issues.push('mcp-evidence:deployment-url-mismatch');
  }
  if (evidence.verdict !== 'pass') issues.push('mcp-evidence:verdict-not-pass');
  for (const item of REQUIRED_CHECKLIST) {
    if (evidence.checklist?.[item] !== 'pass') issues.push(`mcp-evidence:checklist-${item}`);
  }
  return { issues, evidence };
}

async function main() {
  const args = process.argv.slice(2);
  const index = (flag) => args.indexOf(flag);
  const value = (flag) => {
    const i = index(flag);
    if (i < 0 || !args[i + 1]) throw new Error(`${flag} is required.`);
    return args[i + 1];
  };
  const repository = process.env.GITHUB_REPOSITORY;
  const token = process.env.GH_TOKEN?.trim();
  const prNumber = Number(value('--pr-number'));
  const expected = {
    sourceSha: value('--source-sha'),
    stgMergeSha: value('--stg-sha'),
    deploymentUrl: index('--deployment-url') >= 0 ? args[index('--deployment-url') + 1] : null
  };
  const response = await fetch(
    `https://api.github.com/repos/${repository}/issues/${prNumber}/comments?per_page=100`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    }
  );
  if (!response.ok) throw new Error(`comment listing failed: HTTP ${response.status}`);
  const comments = (await response.json()).map((comment) => ({
    author: comment.user?.login,
    body: comment.body
  }));
  const { issues } = verifyMcpEvidence({ comments, expected });
  if (issues.length > 0) {
    for (const issue of issues) console.error(`[mcp-evidence] ${issue}`);
    process.exit(1);
  }
  console.log('MCP staging evidence verified.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    await main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
