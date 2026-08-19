import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { basename, dirname, join, relative } from 'node:path';
import { randomUUID } from 'node:crypto';

import { expectedActorFor } from './account-context.mjs';
import {
  defaultStateRoot,
  git,
  isPathWithin,
  manifestFiles,
  nowIso,
  readJson,
  sanitizeName
} from './session-core.mjs';

// 매니페스트 스키마·읽기·생성·승급 — 분해로 session-lifecycle.mjs 에서 이동(동작 동일).
// readManifests 가 upgradeManifest 를 부르므로 둘을 같은 모듈에 둔다(core 순환 회피).

export function readManifests(stateRoot = defaultStateRoot()) {
  const manifests = [];
  for (const file of manifestFiles(stateRoot)) {
    try {
      manifests.push({ ...upgradeManifest(readJson(file)), manifestFile: file });
    } catch (error) {
      manifests.push({
        manifestFile: file,
        status: 'RECOVERY_REQUIRED',
        manifestError: error instanceof Error ? error.message : String(error)
      });
    }
  }
  return manifests;
}

export function manifestPathForId(stateRoot, worktreeId) {
  return join(stateRoot, `${sanitizeName(worktreeId)}.json`);
}

export function worktreeIdFromPath(path, codexWorktreeRoot) {
  if (isPathWithin(codexWorktreeRoot, path)) {
    const rel = relative(codexWorktreeRoot, path).split(/[\\/]/)[0];
    if (rel) return rel;
  }
  return sanitizeName(`${basename(path)}-${randomUUID().slice(0, 8)}`);
}

export function normalizedTask(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

export function createDetachedWorktree({ run, root, codexWorktreeRoot }) {
  const worktreeId = randomUUID().slice(0, 8);
  const worktreePath = join(codexWorktreeRoot, worktreeId, basename(root));
  if (existsSync(worktreePath)) throw new Error(`worktree path already exists: ${worktreePath}`);
  mkdirSync(dirname(worktreePath), { recursive: true });
  try {
    git(run, root, ['worktree', 'add', '--detach', worktreePath, 'origin/main']);
  } catch (error) {
    if (existsSync(dirname(worktreePath)) && readdirSync(dirname(worktreePath)).length === 0) {
      rmSync(dirname(worktreePath), { recursive: true, force: true });
    }
    throw error;
  }
  return { worktreeId, worktreePath };
}

export const MANIFEST_SCHEMA_VERSION = 2;
export const LIFECYCLE_PHASES = Object.freeze(['ACTIVE', 'RETENTION', 'RECOVERY', 'CLOSED']);

// Test fixture repositories are not in the AGENTS §11.1 account mapping, so the
// expected actor degrades to null instead of failing session bookkeeping.
export function safeExpectedActor(repositorySlug) {
  try {
    return expectedActorFor(repositorySlug);
  } catch {
    return null;
  }
}

export function upgradeManifest(manifest) {
  if (!manifest || (manifest.schemaVersion ?? 0) >= MANIFEST_SCHEMA_VERSION) return manifest;
  return {
    ...manifest,
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    expectedActor: manifest.expectedActor ?? safeExpectedActor(manifest.repository),
    lifecyclePhase: manifest.lifecyclePhase ?? 'ACTIVE',
    cleanupStep: manifest.cleanupStep ?? 'NONE',
    prHeadSha: manifest.prHeadSha ?? null,
    prBaseRef: manifest.prBaseRef ?? null,
    mergedAt: manifest.mergedAt ?? null,
    retentionStartedAt: manifest.retentionStartedAt ?? null,
    branchExpiresAt: manifest.branchExpiresAt ?? null,
    pinned: manifest.pinned ?? false,
    pinnedAt: manifest.pinnedAt ?? null,
    localHeadSha: manifest.localHeadSha ?? null,
    remoteHeadSha: manifest.remoteHeadSha ?? null,
    remoteDeletedByGitHub: manifest.remoteDeletedByGitHub ?? false,
    worktreeRemovedAt: manifest.worktreeRemovedAt ?? null
  };
}

export function makeManifest({ repository, repositoryRoot: root, worktreeId, worktreePath, agent, taskSummary, branch, pr, status, dirty, createdAt, clock, previous = null }) {
  const timestamp = nowIso(clock);
  return {
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    repository,
    repositoryRoot: root,
    worktreeId,
    worktreePath,
    agent,
    taskSummary,
    branch: branch || null,
    pullRequestNumber: pr?.number || previous?.pullRequestNumber || null,
    pullRequestUrl: pr?.url || previous?.pullRequestUrl || null,
    status,
    dirty: Boolean(dirty),
    expectedActor: previous?.expectedActor ?? safeExpectedActor(repository),
    lifecyclePhase: previous?.lifecyclePhase ?? 'ACTIVE',
    cleanupStep: previous?.cleanupStep ?? 'NONE',
    prHeadSha: pr?.headRefOid ?? previous?.prHeadSha ?? null,
    prBaseRef: pr?.baseRefName ?? previous?.prBaseRef ?? null,
    mergedAt: pr?.mergedAt ?? previous?.mergedAt ?? null,
    retentionStartedAt: previous?.retentionStartedAt ?? null,
    branchExpiresAt: previous?.branchExpiresAt ?? null,
    pinned: previous?.pinned ?? false,
    pinnedAt: previous?.pinnedAt ?? null,
    localHeadSha: previous?.localHeadSha ?? null,
    remoteHeadSha: previous?.remoteHeadSha ?? null,
    remoteDeletedByGitHub: previous?.remoteDeletedByGitHub ?? false,
    worktreeRemovedAt: previous?.worktreeRemovedAt ?? null,
    createdAt: createdAt || timestamp,
    updatedAt: timestamp
  };
}
