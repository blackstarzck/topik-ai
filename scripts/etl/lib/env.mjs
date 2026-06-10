// Shared env bootstrap for P2 ETL scripts (server-side only, never bundled).
// Fills process.env from the repo's gitignored .env.local for vars not already
// set, so `node scripts/etl/*.mjs` runs without manual injection. Secrets stay
// out of the repo; this only reads the local file.

import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
export const ETL_EVIDENCE_DIR = join(REPO_ROOT, '.omx', 'evidence', 'etl');

export function loadEnvLocal() {
  const path = join(REPO_ROOT, '.env.local');
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    const [, key, raw] = m;
    if (process.env[key] === undefined || process.env[key] === '') {
      process.env[key] = raw.replace(/^['"]|['"]$/g, '');
    }
  }
}

export function requireEnv(...names) {
  const missing = names.filter((n) => !process.env[n]);
  if (missing.length) {
    console.error(`Missing env vars: ${missing.join(', ')} (.env.local)`);
    process.exit(1);
  }
}
