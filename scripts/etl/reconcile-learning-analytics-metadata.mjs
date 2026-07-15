#!/usr/bin/env node
// 환경별 TOPIK 쓰기 problem_id를 canonical metadata에 보정한다.
// 기본은 read-only dry-run. --apply와 --restore는 명시한 dev project ref에서만 실행한다.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  buildApplySql,
  buildCandidateSql,
  buildReconciliationManifest,
  buildRestoreSql,
  buildSnapshotSql,
  candidateFingerprint,
  sha256,
  verifyManifest,
} from './lib/learning-analytics-reconciliation-core.mjs';
import { REPO_ROOT } from './lib/env.mjs';

const DEV_PROJECT_REF = 'fglggyfvzjdsbyckinqa';
const args = process.argv.slice(2);
const valueOf = (name, fallback = null) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
};
const has = (name) => args.includes(name);
const projectRef = valueOf('--project-ref', process.env.SUPABASE_PROJECT_REF ?? DEV_PROJECT_REF);
const expectedProjectRef = valueOf('--expected-project-ref');
const token = process.env.SUPABASE_ACCESS_TOKEN;
const batch = valueOf('--batch', `analytics-learning-${new Date().toISOString().slice(0, 10)}`);
const evidenceDir = join(REPO_ROOT, '.omx', 'evidence', 'analytics-learning');
const timestamp = new Date().toISOString().replaceAll(':', '').replaceAll('.', '-');
const output = valueOf('--out', join(evidenceDir, `reconciliation-${timestamp}.json`));

if (!token) {
  console.error('SUPABASE_ACCESS_TOKEN is required. The script never reads or prints the token.');
  process.exit(1);
}
if ((has('--apply') || has('--restore')) && (!expectedProjectRef || expectedProjectRef !== projectRef)) {
  console.error('--apply/--restore requires --expected-project-ref equal to --project-ref.');
  process.exit(1);
}
if ((has('--apply') || has('--restore')) && projectRef !== DEV_PROJECT_REF && !has('--allow-non-dev')) {
  console.error('Non-dev mutation is blocked. This task only authorizes the dev project.');
  process.exit(1);
}

async function runSql(sql) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Management API SQL failed (${response.status}): ${text}`);
  return text ? JSON.parse(text) : [];
}

async function readState() {
  const [snapshot, candidates] = await Promise.all([
    runSql(buildSnapshotSql()),
    runSql(buildCandidateSql()),
  ]);
  return { snapshot, candidates };
}

function writeEvidence(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
  console.log(path);
}

function aliasesFromCandidates(candidates, targetProblemIds) {
  const targets = new Set(targetProblemIds);
  return candidates
    .filter((row) => targets.has(row.expected_problem_id) && row.existing_question_id)
    .map((row) => ({
      problemId: row.expected_problem_id,
      questionId: row.existing_question_id,
      aliasKind: row.existing_alias_kind,
      source: row.existing_source,
      backfillBatch: row.existing_backfill_batch,
      mappingStatus: row.existing_mapping_status,
      holdReason: row.existing_hold_reason ?? null,
      matchHash: row.existing_match_hash,
    }))
    .sort((a, b) => a.problemId.localeCompare(b.problemId));
}

function assertAliasSet(label, actual, expected) {
  const sortedExpected = [...expected].sort((a, b) => a.problemId.localeCompare(b.problemId));
  if (actual.length !== sortedExpected.length || sha256(actual) !== sha256(sortedExpected)) {
    throw new Error(`${label}: expected ${sortedExpected.length}, found ${actual.length}`);
  }
}

if (has('--restore')) {
  const restorePath = valueOf('--restore');
  if (!restorePath || !existsSync(restorePath)) throw new Error('--restore requires an apply report path');
  const report = JSON.parse(readFileSync(restorePath, 'utf8'));
  const before = await readState();
  if (sha256(before.snapshot.filter((row) => row.protected)) !== report.postProtectedSnapshotHash) {
    throw new Error('restore blocked: protected data changed after apply');
  }
  await runSql(buildRestoreSql(report.restorePayload));
  const after = await readState();
  const targetProblemIds = report.restorePayload.appliedAliases.map((row) => row.problemId);
  const restoredAliases = aliasesFromCandidates(after.candidates, targetProblemIds);
  assertAliasSet('restore verification failed: before image mismatch', restoredAliases, report.restorePayload.beforeAliases);
  const anchorsStillPresent = report.restorePayload.createdSourceMapAnchors.filter((anchor) => (
    after.candidates.some((row) => (
      row.question_id === anchor.questionId
      && row.source_map_question_id === anchor.questionId
      && Number(row.source_map_item_number) === anchor.itemNumber
    ))
  ));
  if (anchorsStillPresent.length) {
    throw new Error(`restore verification failed: ${anchorsStillPresent.length} created source-map anchor(s) remain`);
  }
  writeEvidence(output, {
    mode: 'restore', projectRef, restoredAt: new Date().toISOString(), sourceReport: restorePath,
    protectedSnapshotHash: sha256(after.snapshot.filter((row) => row.protected)),
    restoredAliasCount: restoredAliases.length,
    restoredAliasHash: sha256(restoredAliases),
    removedSourceMapAnchorCount: report.restorePayload.createdSourceMapAnchors.length,
    status: 'PASS',
  });
  process.exit(0);
}

if (has('--apply')) {
  const manifestPath = valueOf('--manifest');
  if (!manifestPath || !existsSync(manifestPath)) throw new Error('--apply requires --manifest <dry-run.json>');
  const manifest = verifyManifest(JSON.parse(readFileSync(manifestPath, 'utf8')));
  if (manifest.projectRef !== projectRef) throw new Error('manifest project ref mismatch');
  const before = await readState();
  if (sha256(before.snapshot) !== manifest.snapshotHash) throw new Error('apply blocked: snapshot drift');
  if (candidateFingerprint(before.candidates) !== manifest.candidateHash) throw new Error('apply blocked: candidate drift');
  if (manifest.holds.length) throw new Error(`apply blocked: ${manifest.holds.length} hold(s)`);
  await runSql(buildApplySql(manifest));
  const after = await readState();
  const postProtectedSnapshotHash = sha256(after.snapshot.filter((row) => row.protected));
  if (postProtectedSnapshotHash !== manifest.protectedSnapshotHash) {
    throw new Error('apply verification failed: protected data changed');
  }
  const appliedAliases = manifest.desiredAliases;
  const preMappingSnapshotHash = sha256(before.snapshot.filter((row) => !row.protected));
  const postMappingSnapshotHash = sha256(after.snapshot.filter((row) => !row.protected));
  const actualAliases = aliasesFromCandidates(after.candidates, appliedAliases.map((row) => row.problemId));
  assertAliasSet('apply verification failed: alias set mismatch', actualAliases, appliedAliases);
  const createdAnchors = manifest.sourceMapAnchors.filter((anchor) => (
    after.candidates.some((row) => (
      row.question_id === anchor.questionId
      && row.source_map_question_id === anchor.questionId
      && Number(row.source_map_item_number) === anchor.itemNumber
    ))
  ));
  if (createdAnchors.length !== manifest.sourceMapAnchors.length) {
    throw new Error(`apply verification failed: expected ${manifest.sourceMapAnchors.length} source-map anchor(s), found ${createdAnchors.length}`);
  }
  writeEvidence(output, {
    mode: 'apply', projectRef, appliedAt: new Date().toISOString(), sourceManifest: manifestPath,
    manifestHash: manifest.manifestHash, postProtectedSnapshotHash,
    preMappingSnapshotHash,
    postMappingSnapshotHash,
    mappingChanged: preMappingSnapshotHash !== postMappingSnapshotHash,
    verifiedAliasCount: actualAliases.length,
    verifiedSourceMapAnchorCount: createdAnchors.length,
    counts: manifest.counts,
    restorePayload: {
      beforeAliases: manifest.beforeAliases,
      appliedAliases,
      createdSourceMapAnchors: manifest.sourceMapAnchors,
    },
    status: 'PASS',
  });
  process.exit(0);
}

const { snapshot, candidates } = await readState();
const manifest = buildReconciliationManifest({
  projectRef, batch, snapshot, candidates, generatedAt: new Date().toISOString(),
});
writeEvidence(output, manifest);
console.log(JSON.stringify(manifest.counts));
if (manifest.holds.length) console.log(`holds=${manifest.holds.length}; apply will remain blocked`);
