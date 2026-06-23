import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
  evaluateClientBundleSecretLeaks,
  formatClientBundleSecretLeakReport
} from '../../scripts/check-client-secret-leaks.mjs';

let tempDirs = [];

function createTempRoot({ withDist = true } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'topik-ai-client-bundle-secret-leaks-'));
  tempDirs.push(root);
  if (withDist) {
    mkdirSync(join(root, 'dist', 'assets'), { recursive: true });
  }
  return root;
}

function writeDistFile(root, relativePath, content) {
  const absolutePath = join(root, 'dist', relativePath);
  mkdirSync(join(absolutePath, '..'), { recursive: true });
  writeFileSync(absolutePath, content, 'utf8');
}

afterEach(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  tempDirs = [];
});

describe('check-client-secret-leaks', () => {
  it('fails closed when dist is missing', () => {
    const root = createTempRoot({ withDist: false });

    const result = evaluateClientBundleSecretLeaks({ rootDir: root });

    expect(result).toEqual({ distMissing: true, matches: [] });
    expect(formatClientBundleSecretLeakReport(result)).toContain('Run npm run build');
  });

  it('passes when built client files have no server-only markers', () => {
    const root = createTempRoot();
    writeDistFile(root, 'assets/app.js', 'console.log("client");\n');

    const result = evaluateClientBundleSecretLeaks({ rootDir: root });

    expect(result).toEqual({ distMissing: false, matches: [] });
    expect(formatClientBundleSecretLeakReport(result)).toBe('Client bundle secret leak check passed.');
  });

  it('fails when built client files include worker secrets or endpoint markers', () => {
    const root = createTempRoot();
    writeDistFile(root, 'assets/app.js', 'fetch("/api/notifications/dispatch-email", { headers: { "x-worker-secret": "x" } });\n');

    const result = evaluateClientBundleSecretLeaks({ rootDir: root });

    expect(result.matches).toEqual([
      {
        file: join('dist', 'assets', 'app.js'),
        marker: 'api/notifications/dispatch-email'
      },
      {
        file: join('dist', 'assets', 'app.js'),
        marker: 'x-worker-secret'
      }
    ]);
  });
});
