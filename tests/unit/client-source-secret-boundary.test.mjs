import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';

import {
  evaluateClientSourceSecretBoundary,
  formatClientSourceSecretBoundaryReport
} from '../../scripts/check-client-source-secret-boundary.mjs';

let tempDirs = [];

function createTempRoot() {
  const root = mkdtempSync(join(tmpdir(), 'topik-ai-client-source-secret-boundary-'));
  tempDirs.push(root);
  mkdirSync(join(root, 'src'), { recursive: true });
  return root;
}

function writeProjectFile(root, relativePath, content) {
  const absolutePath = join(root, relativePath);
  mkdirSync(join(absolutePath, '..'), { recursive: true });
  writeFileSync(absolutePath, content, 'utf8');
}

afterEach(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  tempDirs = [];
});

describe('check-client-source-secret-boundary', () => {
  it('passes when client source has no server-only worker markers', () => {
    const root = createTempRoot();
    writeProjectFile(root, 'src/app.tsx', "export const publicKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;\n");

    const result = evaluateClientSourceSecretBoundary({ rootDir: root });

    expect(result).toEqual({ matches: [] });
    expect(formatClientSourceSecretBoundaryReport(result)).toBe('Client source secret boundary check passed.');
  });

  it('fails when client source references a server-only env name', () => {
    const root = createTempRoot();
    writeProjectFile(root, 'src/app.tsx', 'const secret = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;\n');

    const result = evaluateClientSourceSecretBoundary({ rootDir: root });

    expect(result.matches).toContainEqual({ file: 'src/app.tsx', marker: 'SUPABASE_SERVICE_ROLE_KEY' });
  });

  it('fails when client source calls the worker endpoint directly', () => {
    const root = createTempRoot();
    writeProjectFile(root, 'src/features/message/send.ts', "fetch('/api/notifications/dispatch-email');\n");

    const result = evaluateClientSourceSecretBoundary({ rootDir: root });

    expect(result.matches).toContainEqual({
      file: 'src/features/message/send.ts',
      marker: '/api/notifications/dispatch-email'
    });
  });

  it('allows the dedicated admin-session worker kick wrapper', () => {
    const root = createTempRoot();
    writeProjectFile(
      root,
      'src/shared/api/notification-email-kick.ts',
      "fetch('/api/notifications/dispatch-email', { headers: { Authorization: 'Bearer session' } });\n"
    );

    const result = evaluateClientSourceSecretBoundary({ rootDir: root });

    expect(result).toEqual({ matches: [] });
  });
});
