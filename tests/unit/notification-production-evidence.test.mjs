import { copyFileSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';

import {
  evaluateNotificationProductionEvidence,
  formatNotificationProductionEvidenceReport
} from '../../scripts/check-notification-production-evidence.mjs';

let tempDirs = [];

function createTempRoot() {
  const root = mkdtempSync(join(tmpdir(), 'topik-ai-production-evidence-'));
  tempDirs.push(root);
  return root;
}

function writeEvidence(root, content) {
  const file = join(root, 'docs/runbooks/notification-worker-production-evidence.md');
  mkdirSync(join(file, '..'), { recursive: true });
  writeFileSync(file, content, 'utf8');
}

const COMPLETE_EVIDENCE = `
## Notification worker production verification - 2026-06-18

### SOT checklist
- v13 required SOT checked: yes
- topik-ai required SOT checked: yes
- SOT conflicts: none

### Local boundary
- topik-ai transfer checklist: pass
- topik-ai source secret check: pass
- topik-ai build: pass
- topik-ai bundle secret check: pass
- topik-ai targeted unit tests: pass
- v13 admin boundary harness: pass
- v13 transition retirement gate: pass

### Vercel readiness
- Project linked: yes
- Production env names configured: yes
- Readiness command: pass

### Smoke
- Unauthenticated GET 401: pass
- Authenticated cron GET 2xx: pass
- Authenticated manual POST 2xx: pass

### Cross-app data
- Dispatch id: dispatch-20260618-001
- Attempt ids: attempt-20260618-001
- topik-ai admin history verified: yes
- v13 owner-read history verified: yes

### Decision
- Keep v13 transition route
- Reason: production smoke verified, route retirement tracked separately.
`;

afterEach(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  tempDirs = [];
});

describe('check-notification-production-evidence', () => {
  it('skips when evidence is absent unless required', () => {
    const root = createTempRoot();

    const result = evaluateNotificationProductionEvidence({ rootDir: root });

    expect(result.skipped).toBe(true);
    expect(result.failures).toEqual([]);
    expect(formatNotificationProductionEvidenceReport(result)).toContain('SKIP');
  });

  it('fails when required evidence file is missing', () => {
    const root = createTempRoot();

    const result = evaluateNotificationProductionEvidence({ rootDir: root, requireFile: true });

    expect(result.failures).toContain('Production evidence file is missing: docs/runbooks/notification-worker-production-evidence.md');
  });

  it('passes complete evidence without secret values', () => {
    const root = createTempRoot();
    writeEvidence(root, COMPLETE_EVIDENCE);

    const result = evaluateNotificationProductionEvidence({ rootDir: root, requireFile: true });

    expect(result.failures).toEqual([]);
    expect(formatNotificationProductionEvidenceReport(result)).toContain('PASS');
  });

  it('fails placeholders and secret-looking values', () => {
    const root = createTempRoot();
    writeEvidence(
      root,
      COMPLETE_EVIDENCE
        .replace('Dispatch id: dispatch-20260618-001', 'Dispatch id: DISPATCH-ID')
        .concat('\nCRON_SECRET=super-secret-value\n')
    );

    const result = evaluateNotificationProductionEvidence({ rootDir: root, requireFile: true });

    expect(result.failures).toContain('Missing production evidence marker: dispatch id recorded');
    expect(result.failures.some((failure) => failure.includes('secret value'))).toBe(true);
  });

  it('fails when v13 transition retirement gate evidence is missing', () => {
    const root = createTempRoot();
    writeEvidence(
      root,
      COMPLETE_EVIDENCE.replace('- v13 transition retirement gate: pass\n', '')
    );

    const result = evaluateNotificationProductionEvidence({ rootDir: root, requireFile: true });

    expect(result.failures).toContain('Missing production evidence marker: v13 transition retirement gate pass');
  });

  it('fails redacted example values when used as the real production evidence file', () => {
    const root = createTempRoot();
    writeEvidence(
      root,
      COMPLETE_EVIDENCE
        .replace('dispatch-20260618-001', 'notification-dispatch-redacted-001')
        .replace('attempt-20260618-001', 'notification-attempt-redacted-001')
    );

    const result = evaluateNotificationProductionEvidence({ rootDir: root, requireFile: true });

    expect(result.failures).toContain('Missing production evidence marker: dispatch id recorded');
    expect(result.failures).toContain('Missing production evidence marker: attempt id recorded');
  });

  it('does not accept the checked-in example as real production evidence', () => {
    const root = createTempRoot();
    const evidenceFile = 'docs/runbooks/notification-worker-production-evidence.md';
    const destination = join(root, evidenceFile);
    mkdirSync(join(destination, '..'), { recursive: true });
    copyFileSync(
      join(process.cwd(), 'docs/runbooks/notification-worker-production-evidence.example.md'),
      destination
    );

    const result = evaluateNotificationProductionEvidence({ rootDir: root, requireFile: true });

    expect(result.failures).toContain('Missing production evidence marker: dispatch id recorded');
    expect(result.failures).toContain('Missing production evidence marker: attempt id recorded');
  });

  it('keeps the checked-in example synchronized with all non-id production markers', () => {
    const root = createTempRoot();
    const evidenceFile = 'docs/runbooks/notification-worker-production-evidence.md';
    const destination = join(root, evidenceFile);
    mkdirSync(join(destination, '..'), { recursive: true });
    copyFileSync(
      join(process.cwd(), 'docs/runbooks/notification-worker-production-evidence.example.md'),
      destination
    );

    const result = evaluateNotificationProductionEvidence({ rootDir: root, requireFile: true });

    expect(result.missingMarkers.sort()).toEqual([
      'attempt id recorded',
      'dispatch id recorded'
    ]);
  });

  it('requires explicit v13 SOT approval evidence before retiring the transition route', () => {
    const root = createTempRoot();
    writeEvidence(root, COMPLETE_EVIDENCE.replace('Keep v13 transition route', 'retire v13 transition route'));

    const result = evaluateNotificationProductionEvidence({ rootDir: root, requireFile: true });

    expect(result.failures).toContain('Missing production evidence marker: route retirement SOT approval recorded');
  });

  it('accepts transition route retirement only when v13 SOT approval evidence is recorded', () => {
    const root = createTempRoot();
    writeEvidence(
      root,
      COMPLETE_EVIDENCE
        .replace('Keep v13 transition route', 'retire v13 transition route')
        .concat('\n- Route retirement SOT approval: yes\n')
    );

    const result = evaluateNotificationProductionEvidence({ rootDir: root, requireFile: true });

    expect(result.failures).toEqual([]);
  });
});
