#!/usr/bin/env node
// Byte-exact custody of the v13-authored learner migration history.
//
// Ownership transfer program M2 (docs/plans/v13-db-ownership-transfer-program-plan.md).
// The learner migrations were authored in blackstarzck/topik-project-v13. This
// repo now holds the canonical copy so CI replay and remote apply no longer
// depend on checking out another repository.
//
// What moved is custody, not the database: no file here is re-applied, and the
// tracker each file belongs to is unchanged (supabase_migrations.schema_migrations
// for the learner namespace, written only by scripts/db/apply-v13-migration.mjs).
//
// Byte identity is proven two ways, so the proof survives deleting the v13
// checkout:
//   1. sha256 of the archived bytes, recorded per file.
//   2. the git blob sha of the v13 commit's object, recomputed locally from the
//      archived bytes. A match means these bytes hash to the same git object the
//      v13 history contains, without needing that history present.
// With --v13-root the verifier additionally diffs against `git show`, which is
// the assertion the dual-verification release (M3) runs while both sources exist.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DEFAULT_ARCHIVE_DIR = join(ROOT, 'supabase', 'migrations-v13');
const DEFAULT_MANIFEST = join(ROOT, 'scripts', 'db', 'manifests', 'v13-archive.json');
const DEFAULT_DEV_MANIFEST = join(ROOT, 'scripts', 'db', 'manifests', 'v13-shared-dev.json');

const FORWARD_NAME = /^(\d{14})_([a-z0-9_]+)\.sql$/;
const SHA40 = /^[0-9a-f]{40}$/;
const SHA256 = /^[0-9a-f]{64}$/;

// A file's disposition decides whether any runner may ever select it. The
// archive keeps every historical file for replay fidelity, so "present in the
// archive" must never be read as "safe to apply".
export const DISPOSITIONS = Object.freeze({
  applied: 'Normal learner history. Recorded in the learner tracker.',
  blocked: 'Never apply. Applying today would regress the post-cutover structure.',
  deferred: 'Owner decision pending. Not applied to development.',
  'adopted-elsewhere': 'Applied and tracked from another namespace in this repo.',
});

export function sha256Hex(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

// git hashes a blob as sha1("blob <byteLength>\0" + content).
export function gitBlobSha(buffer) {
  return createHash('sha1')
    .update(Buffer.from(`blob ${buffer.length}\0`, 'binary'))
    .update(buffer)
    .digest('hex');
}

export function parseForwardName(fileName) {
  const match = FORWARD_NAME.exec(fileName);
  if (!match) return null;
  return { version: match[1], name: match[2], fileName };
}

function fail(message) {
  throw new Error(message);
}

function listSqlFiles(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory)
    .filter((name) => name.endsWith('.sql'))
    .sort();
}

export function listArchive(archiveDir) {
  return {
    forward: listSqlFiles(archiveDir),
    down: listSqlFiles(join(archiveDir, 'down')),
  };
}

function readGitObject({ repoRoot, sha, path }) {
  try {
    return execFileSync('git', ['-C', repoRoot, 'show', `${sha}:${path}`], {
      maxBuffer: 64 * 1024 * 1024,
      // Buffer output: any encoding conversion here would defeat byte comparison.
      encoding: 'buffer',
    });
  } catch (error) {
    fail(`Cannot read ${sha}:${path} from ${repoRoot}: ${String(error.message).split('\n')[0]}`);
  }
  return null;
}

function listGitTree({ repoRoot, sha, path }) {
  const output = execFileSync(
    'git',
    ['-C', repoRoot, 'ls-tree', '-r', '-z', '--format=%(objectname) %(path)', sha, '--', path],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
  );
  return output
    .split('\0')
    .filter((line) => line.length > 0)
    .map((line) => {
      const separator = line.indexOf(' ');
      return { blob: line.slice(0, separator), path: line.slice(separator + 1) };
    });
}

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------

export function evaluateArchive({ archiveDir, manifest, readFile = readFileSync }) {
  const failures = [];
  const entries = manifest.files ?? [];
  if (entries.length === 0) failures.push('Manifest lists no files.');

  const declared = new Map();
  for (const entry of entries) {
    if (declared.has(entry.name)) failures.push(`Manifest lists ${entry.name} twice.`);
    declared.set(entry.name, entry);
  }

  const onDisk = listArchive(archiveDir);
  const diskNames = new Set([
    ...onDisk.forward,
    ...onDisk.down.map((name) => `down/${name}`),
  ]);

  for (const name of diskNames) {
    if (!declared.has(name)) failures.push(`${name} is present in the archive but absent from the manifest.`);
  }

  let forwardCount = 0;
  let downCount = 0;
  let watermark = '';
  for (const entry of entries) {
    const isDown = entry.name.startsWith('down/');
    const bareName = isDown ? entry.name.slice('down/'.length) : entry.name;
    const parsed = parseForwardName(bareName);
    if (!parsed) {
      failures.push(`${entry.name} does not match the migration file name contract.`);
      continue;
    }
    if (isDown) {
      downCount += 1;
    } else {
      forwardCount += 1;
      if (parsed.version > watermark) watermark = parsed.version;
    }

    if (!SHA256.test(entry.sha256 ?? '')) failures.push(`${entry.name} has no valid sha256.`);
    if (!SHA40.test(entry.blob ?? '')) failures.push(`${entry.name} has no valid git blob sha.`);

    if (!diskNames.has(entry.name)) {
      failures.push(`${entry.name} is declared in the manifest but missing from the archive.`);
      continue;
    }

    const bytes = readFile(join(archiveDir, entry.name));
    const actualSha256 = sha256Hex(bytes);
    const actualBlob = gitBlobSha(bytes);
    if (actualSha256 !== entry.sha256) {
      failures.push(`${entry.name} sha256 drift: manifest ${entry.sha256}, file ${actualSha256}.`);
    }
    if (actualBlob !== entry.blob) {
      failures.push(
        `${entry.name} git blob drift: manifest ${entry.blob}, file ${actualBlob} — `
        + 'the archived bytes no longer hash to the v13 object.'
      );
    }

    if (isDown) continue;

    if (!Object.hasOwn(DISPOSITIONS, entry.disposition ?? '')) {
      failures.push(`${entry.name} has an unknown disposition: ${entry.disposition}.`);
    }
    for (const environment of ['dev', 'prod']) {
      const state = entry.ledger?.[environment];
      if (state !== 'applied' && state !== 'absent') {
        failures.push(`${entry.name} has no valid ${environment} ledger state.`);
      }
    }
    if (entry.disposition === 'blocked' && entry.ledger?.dev === 'applied') {
      failures.push(`${entry.name} is blocked but recorded as applied in development.`);
    }
    if (entry.disposition === 'deferred' && entry.ledger?.dev === 'applied') {
      failures.push(`${entry.name} is deferred but recorded as applied in development.`);
    }
    if (entry.disposition === 'adopted-elsewhere') {
      if (!entry.adoptedAs) failures.push(`${entry.name} is adopted elsewhere but names no adopting path.`);
      if (entry.replayOnly !== true) {
        failures.push(`${entry.name} is adopted elsewhere so it must be marked replayOnly.`);
      }
      if (entry.ledger?.dev === 'applied' || entry.ledger?.prod === 'applied') {
        failures.push(
          `${entry.name} is adopted elsewhere so the learner tracker must not record it — `
          + 'one migration belongs to exactly one tracker.'
        );
      }
    }
    if (entry.disposition !== 'applied' && !entry.reason) {
      failures.push(`${entry.name} is ${entry.disposition} but records no reason.`);
    }
  }

  if (manifest.authoringWatermark !== watermark) {
    failures.push(
      `authoringWatermark ${manifest.authoringWatermark} does not match the highest archived `
      + `forward version ${watermark}. Anything above the watermark is topik-ai-authored.`
    );
  }
  if (manifest.counts?.forward !== forwardCount) {
    failures.push(`counts.forward ${manifest.counts?.forward} does not match ${forwardCount} archived forward files.`);
  }
  if (manifest.counts?.down !== downCount) {
    failures.push(`counts.down ${manifest.counts?.down} does not match ${downCount} archived down files.`);
  }

  return { failures, forwardCount, downCount, watermark };
}

// The dev apply manifest and this archive must classify the same files the same
// way. Without this cross-check one could drift and a blocked migration would
// look applicable from whichever document the operator happened to open.
export function evaluateDevManifestAgreement({ manifest, devManifest }) {
  const failures = [];
  const byDisposition = (disposition) => new Set(
    (manifest.files ?? [])
      .filter((entry) => entry.disposition === disposition)
      .map((entry) => entry.name)
  );
  const namesOf = (list) => new Set((list ?? []).map((entry) => (
    typeof entry === 'string' ? entry : entry.name
  )));

  const pairs = [
    ['blocked', byDisposition('blocked'), namesOf(devManifest.blockedMigrations)],
    ['deferred', byDisposition('deferred'), namesOf(devManifest.deferredMigrations)],
    ['adopted-elsewhere', byDisposition('adopted-elsewhere'), namesOf(devManifest.adoptedElsewhere)],
  ];
  for (const [label, archived, dev] of pairs) {
    for (const name of archived) {
      if (!dev.has(name)) failures.push(`${name} is ${label} in the archive but not in the dev manifest.`);
    }
    for (const name of dev) {
      if (!archived.has(name)) failures.push(`${name} is ${label} in the dev manifest but not in the archive.`);
    }
  }
  return { failures };
}

export function evaluateSourceParity({ archiveDir, manifest, repoRoot, sourceGitSha }) {
  const failures = [];
  if (!SHA40.test(sourceGitSha ?? '')) fail('--v13-sha requires a full 40-character commit sha.');
  if (manifest.sourceGitSha && manifest.sourceGitSha !== sourceGitSha) {
    failures.push(`Manifest pins sourceGitSha ${manifest.sourceGitSha}, compared against ${sourceGitSha}.`);
  }
  const sourceDir = manifest.sourceMigrationsDir ?? 'supabase/migrations';
  const tree = new Map(
    listGitTree({ repoRoot, sha: sourceGitSha, path: sourceDir })
      .map((item) => [item.path.slice(`${sourceDir}/`.length), item.blob])
  );

  for (const entry of manifest.files ?? []) {
    const sourceBlob = tree.get(entry.name);
    if (!sourceBlob) {
      failures.push(`${entry.name} is archived but absent from ${sourceGitSha}:${sourceDir}.`);
      continue;
    }
    if (sourceBlob !== entry.blob) {
      failures.push(`${entry.name} blob mismatch: source ${sourceBlob}, manifest ${entry.blob}.`);
    }
    const sourceBytes = readGitObject({ repoRoot, sha: sourceGitSha, path: `${sourceDir}/${entry.name}` });
    const archivedBytes = readFileSync(join(archiveDir, entry.name));
    if (!sourceBytes.equals(archivedBytes)) {
      failures.push(`${entry.name} differs byte for byte from ${sourceGitSha}:${sourceDir}.`);
    }
    tree.delete(entry.name);
  }

  const unarchived = [...tree.keys()].filter((name) => name.endsWith('.sql'));
  if (unarchived.length > 0) {
    failures.push(
      `${unarchived.length} source migration(s) are not archived: ${unarchived.slice(0, 5).join(', ')}`
      + `${unarchived.length > 5 ? ', …' : ''}. The archive must be complete or the replay diverges.`
    );
  }
  return { failures, comparedFiles: (manifest.files ?? []).length };
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

function buildManifest({ repoRoot, sourceGitSha, sourceDir, tree, devManifest, ledger, archiveDir }) {
  const blocked = new Map(
    (devManifest.blockedMigrations ?? []).map((entry) => [entry.name, entry.reason])
  );
  const deferred = new Map(
    (devManifest.deferredMigrations ?? []).map((entry) => [entry.name, entry.reason])
  );
  const adopted = new Map(
    (devManifest.adoptedElsewhere ?? []).map((entry) => [entry.name, entry])
  );

  const files = [];
  let watermark = '';
  let forwardCount = 0;
  let downCount = 0;

  for (const { path, blob } of tree) {
    const relativeName = path.slice(`${sourceDir}/`.length);
    if (!relativeName.endsWith('.sql')) continue;
    const isDown = relativeName.startsWith('down/');
    const bareName = isDown ? relativeName.slice('down/'.length) : relativeName;
    const parsed = parseForwardName(bareName);
    if (!parsed) fail(`Source file does not match the naming contract: ${relativeName}`);

    const bytes = readGitObject({ repoRoot, sha: sourceGitSha, path });
    const computedBlob = gitBlobSha(bytes);
    if (computedBlob !== blob) {
      fail(`Local git blob computation disagrees with the source tree for ${relativeName}.`);
    }
    const target = join(archiveDir, relativeName);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, bytes);

    const entry = {
      name: relativeName,
      sha256: sha256Hex(bytes),
      blob,
      bytes: bytes.length,
    };
    if (isDown) {
      downCount += 1;
    } else {
      forwardCount += 1;
      if (parsed.version > watermark) watermark = parsed.version;
      entry.ledger = {
        dev: ledger.dev.includes(parsed.version) ? 'applied' : 'absent',
        prod: ledger.prod.includes(parsed.version) ? 'applied' : 'absent',
      };
      if (blocked.has(relativeName)) {
        entry.disposition = 'blocked';
        entry.reason = blocked.get(relativeName);
      } else if (deferred.has(relativeName)) {
        entry.disposition = 'deferred';
        entry.reason = deferred.get(relativeName);
      } else if (adopted.has(relativeName)) {
        const record = adopted.get(relativeName);
        entry.disposition = 'adopted-elsewhere';
        entry.adoptedAs = record.adoptedAs;
        entry.adoptedTracker = record.tracker;
        entry.replayOnly = true;
        entry.reason = record.reason;
      } else {
        entry.disposition = 'applied';
      }
    }
    files.push(entry);
  }

  files.sort((left, right) => left.name.localeCompare(right.name));

  // The four dispositions must partition the forward set exactly, and the
  // `applied` subset must equal the development ledger. If these disagree the
  // archive is describing a history that no environment actually has.
  const appliedNames = files.filter((entry) => entry.disposition === 'applied');
  const devApplied = files.filter((entry) => entry.ledger?.dev === 'applied');
  if (appliedNames.length !== devApplied.length) {
    fail(
      `Disposition/ledger disagreement: ${appliedNames.length} files are 'applied' but `
      + `${devApplied.length} are recorded in the development ledger.`
    );
  }
  for (const entry of appliedNames) {
    if (entry.ledger.dev !== 'applied') {
      fail(`${entry.name} is 'applied' but absent from the development ledger.`);
    }
  }

  return {
    $comment:
      'Byte-exact archive of the v13-authored learner migration history, adopted into this repo by '
      + 'ownership transfer program M2 (docs/plans/v13-db-ownership-transfer-program-plan.md). Files here are '
      + 'custody and CI replay input only: nothing is re-applied and no tracker assignment changes. '
      + 'Verify with scripts/db/v13-archive.mjs. `disposition` is the sole authority on whether a runner may '
      + 'select a file — presence in this archive never implies it is safe to apply.',
    namespace: 'v13_user_facing',
    sourceRepo: devManifest.sourceRepo ?? 'blackstarzck/topik-project-v13',
    sourceMigrationsDir: sourceDir,
    sourceGitSha,
    archiveDir: 'supabase/migrations-v13',
    tracker: devManifest.trackerTable ?? 'supabase_migrations.schema_migrations',
    runner: 'scripts/db/apply-v13-migration.mjs',
    authoringWatermark: watermark,
    authoringWatermarkComment:
      'The highest v13-authored forward version. At or below this version a migration is v13-authored '
      + 'history and keeps its tracker; above it, the migration is topik-ai-authored in this directory.',
    ledgerMeasuredAt: ledger.measuredAt,
    counts: { forward: forwardCount, down: downCount },
    dispositions: DISPOSITIONS,
    files,
  };
}

function importArchive({ repoRoot, sourceGitSha, archiveDir, manifestPath, devManifestPath, ledgerPath }) {
  const devManifest = JSON.parse(readFileSync(devManifestPath, 'utf8'));
  const ledger = JSON.parse(readFileSync(ledgerPath, 'utf8'));
  for (const environment of ['dev', 'prod']) {
    if (!Array.isArray(ledger[environment])) fail(`Ledger snapshot is missing the ${environment} version array.`);
  }
  const sourceDir = devManifest.sourceMigrationsDir ?? 'supabase/migrations';
  const tree = listGitTree({ repoRoot, sha: sourceGitSha, path: sourceDir });

  rmSync(archiveDir, { recursive: true, force: true });
  mkdirSync(archiveDir, { recursive: true });
  const manifest = buildManifest({
    repoRoot,
    sourceGitSha,
    sourceDir,
    tree,
    devManifest,
    ledger,
    archiveDir,
  });

  // INDEX.md travels with the archive as the human-readable change log. It is
  // reference material, not part of the sha contract, so it is copied but not
  // listed in `files`.
  const sourceIndex = `${sourceDir}/INDEX.md`;
  try {
    const indexBytes = readGitObject({ repoRoot, sha: sourceGitSha, path: sourceIndex });
    writeFileSync(join(archiveDir, 'INDEX.md'), indexBytes);
  } catch {
    // An absent INDEX.md is not a contract failure.
  }

  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return manifest;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function getArgValue(args, flag) {
  const inline = args.find((arg) => arg.startsWith(`${flag}=`));
  if (inline) return inline.slice(flag.length + 1);
  const index = args.indexOf(flag);
  if (index < 0) return null;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) fail(`${flag} requires a value.`);
  return value;
}

function usage() {
  console.log(`Usage:
  node scripts/db/v13-archive.mjs [--verify] [--v13-root <path> --v13-sha <sha40>] [--json-out <path>]
  node scripts/db/v13-archive.mjs --import --v13-root <path> --v13-sha <sha40> --ledger <path>

  --verify  (default) recompute sha256 and git blob sha for every archived file,
            cross-check dispositions against the dev apply manifest, and — when
            --v13-root is given — diff every file against the v13 git objects.
  --import  re-materialize the archive and manifest from a v13 commit. Requires a
            ledger snapshot: {"dev":[versions],"prod":[versions],"measuredAt":"…"}.`);
}

export async function main(argv = process.argv.slice(2)) {
  if (argv.includes('--help') || argv.includes('-h')) {
    usage();
    return 0;
  }
  const archiveDir = resolve(getArgValue(argv, '--archive-dir') ?? DEFAULT_ARCHIVE_DIR);
  const manifestPath = resolve(getArgValue(argv, '--manifest') ?? DEFAULT_MANIFEST);
  const devManifestPath = resolve(getArgValue(argv, '--dev-manifest') ?? DEFAULT_DEV_MANIFEST);
  const v13Root = getArgValue(argv, '--v13-root');
  const v13Sha = getArgValue(argv, '--v13-sha');

  if (argv.includes('--import')) {
    if (!v13Root || !v13Sha) fail('--import requires --v13-root and --v13-sha.');
    const ledgerPath = getArgValue(argv, '--ledger');
    if (!ledgerPath) fail('--import requires --ledger.');
    const manifest = importArchive({
      repoRoot: resolve(v13Root),
      sourceGitSha: v13Sha,
      archiveDir,
      manifestPath,
      devManifestPath,
      ledgerPath: resolve(ledgerPath),
    });
    console.log(
      `Imported ${manifest.counts.forward} forward + ${manifest.counts.down} down migrations `
      + `from ${v13Sha.slice(0, 8)} (watermark ${manifest.authoringWatermark}).`
    );
    return 0;
  }

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const archive = evaluateArchive({ archiveDir, manifest });
  const failures = [...archive.failures];

  if (existsSync(devManifestPath)) {
    const devManifest = JSON.parse(readFileSync(devManifestPath, 'utf8'));
    failures.push(...evaluateDevManifestAgreement({ manifest, devManifest }).failures);
  }

  let parity = null;
  if (v13Root) {
    if (!v13Sha) fail('--v13-root requires --v13-sha.');
    parity = evaluateSourceParity({
      archiveDir,
      manifest,
      repoRoot: resolve(v13Root),
      sourceGitSha: v13Sha,
    });
    failures.push(...parity.failures);
  }

  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    archiveDir: manifest.archiveDir,
    sourceGitSha: manifest.sourceGitSha,
    authoringWatermark: manifest.authoringWatermark,
    forwardCount: archive.forwardCount,
    downCount: archive.downCount,
    sourceParityChecked: Boolean(parity),
    clean: failures.length === 0,
    failures,
  };
  const jsonOut = getArgValue(argv, '--json-out');
  if (jsonOut) {
    const absolutePath = resolve(jsonOut);
    mkdirSync(dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  }

  if (failures.length > 0) {
    console.error('v13 archive verification failed:');
    for (const failure of failures) console.error(`- ${failure}`);
    return 1;
  }
  console.log(
    `v13 archive verified: ${archive.forwardCount} forward + ${archive.downCount} down, `
    + `watermark ${manifest.authoringWatermark}`
    + `${parity ? `, byte parity with ${manifest.sourceGitSha.slice(0, 8)} confirmed` : ''}.`
  );
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().then(
    (code) => {
      process.exitCode = code ?? 0;
    },
    (error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
  );
}
