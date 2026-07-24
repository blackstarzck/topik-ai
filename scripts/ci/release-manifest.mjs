#!/usr/bin/env node
// Local release manifest for the Playwright MCP browser-verification protocol.
// State lives outside the repository (per-machine) so any release-controller
// session can pick up an interrupted verification by source SHA alone; only the
// signed summary comment travels to GitHub where the gates verify it.

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { MCP_STG_MARKER } from './verify-mcp-evidence.mjs';

export const CHECKLIST_ITEMS = [
  'login',
  'coreFlows',
  'consoleErrors',
  'failedRequests',
  'baselineCompared',
  'shaMatch',
  'screenshotsSaved'
];

export function manifestRoot() {
  return process.env.TOPIK_RELEASE_MANIFEST_ROOT
    || join(homedir(), '.topik-ai', 'release-manifests');
}

function manifestPath(sourceSha) {
  return join(manifestRoot(), `${sourceSha}.json`);
}

function writeJsonAtomic(file, value) {
  mkdirSync(dirname(file), { recursive: true });
  const temp = `${file}.tmp-${process.pid}`;
  writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  renameSync(temp, file);
}

function emptyStage() {
  return {
    deploymentUrl: null,
    deploymentId: null,
    ciRunUrl: null,
    checklist: Object.fromEntries(CHECKLIST_ITEMS.map((item) => [item, 'pending'])),
    screenshots: [],
    verdict: 'in-progress',
    verifiedAt: null,
    summary: null
  };
}

export function loadManifest(sourceSha) {
  const file = manifestPath(sourceSha);
  if (!existsSync(file)) return null;
  return JSON.parse(readFileSync(file, 'utf8'));
}

export function initManifest({ sourceSha, releasePlan, stgMergeSha = null, mainPr = null, sessionId = null }) {
  const existing = loadManifest(sourceSha);
  if (existing) return existing;
  const manifest = {
    schemaVersion: 1,
    sourceSha,
    releasePlan,
    stgMergeSha,
    mainPr,
    handoff: { lastSessionId: sessionId, updatedAt: new Date().toISOString(), note: null },
    stg: emptyStage(),
    production: emptyStage()
  };
  writeJsonAtomic(manifestPath(sourceSha), manifest);
  return manifest;
}

export function updateManifest(sourceSha, mutate, { sessionId = null, note = null } = {}) {
  const manifest = loadManifest(sourceSha);
  if (!manifest) throw new Error(`no release manifest for ${sourceSha}; run init first.`);
  mutate(manifest);
  manifest.handoff = {
    lastSessionId: sessionId ?? manifest.handoff?.lastSessionId ?? null,
    updatedAt: new Date().toISOString(),
    note: note ?? manifest.handoff?.note ?? null
  };
  writeJsonAtomic(manifestPath(sourceSha), manifest);
  return manifest;
}

export function buildStgEvidenceComment(manifest) {
  const stage = manifest.stg;
  const pendingItems = Object.entries(stage.checklist)
    .filter(([, state]) => state !== 'pass')
    .map(([item]) => item);
  if (stage.verdict !== 'pass' || pendingItems.length > 0) {
    throw new Error(`stg verification is not complete (verdict=${stage.verdict}, pending=${pendingItems.join(',') || 'none'}).`);
  }
  const payload = {
    kind: 'mcp-stg-evidence',
    sourceSha: manifest.sourceSha,
    stgMergeSha: manifest.stgMergeSha,
    deploymentUrl: stage.deploymentUrl,
    deploymentId: stage.deploymentId,
    checklist: stage.checklist,
    screenshotsSha256: stage.screenshots,
    verdict: stage.verdict,
    verifiedAt: stage.verifiedAt,
    summary: stage.summary
  };
  return [
    `${MCP_STG_MARKER}: Playwright MCP staging verification (release manifest ${manifest.sourceSha.slice(0, 7)}).`,
    '',
    '```json',
    JSON.stringify(payload, null, 2),
    '```'
  ].join('\n');
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = {};
  for (let index = 0; index < rest.length; index += 1) {
    if (!rest[index].startsWith('--')) continue;
    const name = rest[index].slice(2);
    const next = rest[index + 1];
    if (next && !next.startsWith('--')) {
      options[name] = next;
      index += 1;
    } else {
      options[name] = true;
    }
  }
  return { command, options };
}

async function main() {
  const { command, options } = parseArgs(process.argv.slice(2));
  if (command === 'init') {
    const manifest = initManifest({
      sourceSha: options['source-sha'],
      releasePlan: options['release-plan'] ?? 'unknown',
      stgMergeSha: options['stg-sha'] ?? null,
      sessionId: options.session ?? null
    });
    console.log(JSON.stringify(manifest, null, 2));
    return;
  }
  if (command === 'set') {
    const stage = options.stage;
    if (!['stg', 'production'].includes(stage)) throw new Error('--stage must be stg or production.');
    const manifest = updateManifest(options['source-sha'], (current) => {
      const target = current.stg && stage === 'stg' ? current.stg : current[stage];
      if (options.item) {
        if (!CHECKLIST_ITEMS.includes(options.item)) throw new Error(`unknown checklist item: ${options.item}`);
        target.checklist[options.item] = options.state ?? 'pass';
      }
      if (options['deployment-url']) target.deploymentUrl = options['deployment-url'];
      if (options['deployment-id']) target.deploymentId = options['deployment-id'];
      if (options.screenshot) target.screenshots.push(options.screenshot);
      if (options.summary) target.summary = options.summary;
      if (options.verdict) {
        target.verdict = options.verdict;
        target.verifiedAt = new Date().toISOString();
      }
    }, { sessionId: options.session ?? null, note: options.note ?? null });
    console.log(JSON.stringify(manifest[stage], null, 2));
    return;
  }
  if (command === 'comment') {
    const manifest = loadManifest(options['source-sha']);
    if (!manifest) throw new Error('no release manifest for that source SHA.');
    console.log(buildStgEvidenceComment(manifest));
    return;
  }
  if (command === 'show') {
    const manifest = loadManifest(options['source-sha']);
    console.log(manifest ? JSON.stringify(manifest, null, 2) : 'null');
    return;
  }
  throw new Error('usage: release-manifest.mjs <init|set|comment|show> --source-sha <sha> [...]');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    await main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
