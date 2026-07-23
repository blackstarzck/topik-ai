import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
  evaluateTransferSotChecklist,
  formatTransferSotChecklistReport
} from '../../scripts/check-transfer-sot-checklist.mjs';

let tempDirs = [];

const V13_FILES = [
  'AGENTS.md',
  'README.md',
  'docs/supabase/security-and-ownership.md',
  'supabase/migrations/INDEX.md',
  'scripts/check-notification-migration-replay.mjs',
  'tests/scripts/check-notification-migration-replay.test.mjs'
];

const TOPIK_AI_FILES = [
  'AGENTS.md',
  'supabase/README.md',
  'docs/architecture/shared-supabase-schema-ownership.md',
  'docs/specs/admin-data-contract.md',
  'docs/specs/admin-data-usage-map.md',
  'docs/specs/notification-contract.md',
  'docs/page-sync/message-history-page-sync.md',
  'docs/page-sync/message-inapp-page-sync.md',
  'docs/알림-기능-구현-페이즈-가이드.md',
  'docs/runbooks/notification-worker-production-verification.md'
];

const RUNBOOK_FILE = 'docs/runbooks/notification-worker-production-verification.md';

function createTempRoot(prefix) {
  const root = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(root);
  return root;
}

function writeProjectFile(root, relativePath, content = 'ok\n') {
  const absolutePath = join(root, relativePath);
  mkdirSync(join(absolutePath, '..'), { recursive: true });
  writeFileSync(absolutePath, content, 'utf8');
}

function writeValidFixtures(topikAiRoot, v13Root) {
  for (const file of TOPIK_AI_FILES) writeProjectFile(topikAiRoot, file);
  writeProjectFile(
    topikAiRoot,
    RUNBOOK_FILE,
    [
      'npm run harness:admin-transfer:local',
      'npm run harness:admin-boundary:production',
      'npm run check:admin-transfer-completion',
      'v13 transition retirement gate: pass'
    ].join('\n')
  );

  for (const file of V13_FILES) writeProjectFile(v13Root, file);
  writeProjectFile(
    v13Root,
    'docs/supabase/security-and-ownership.md',
    'topik-ai admin_schema_migrations user_notifications user_marketing_consent clean replay\n'
  );
  writeProjectFile(
    v13Root,
    'supabase/migrations/INDEX.md',
    '20260723011242_notification_pipeline_ownership_transfer.sql replay-safe no-op notification_email_config user_marketing_consent\n'
  );
  writeProjectFile(
    v13Root,
    'scripts/check-notification-migration-replay.mjs',
    'notification pipeline migration home: topik-ai 20260612180000_notification_dispatcher.sql 20260612200100_marketing_consent_in_dispatch.sql\n'
  );
}

afterEach(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
  tempDirs = [];
});

describe('check-transfer-sot-checklist', () => {
  it('passes when both repos expose the current SOT/checklist files and terms', () => {
    const topikAiRoot = createTempRoot('topik-ai-sot-checklist-');
    const v13Root = createTempRoot('v13-sot-checklist-');
    writeValidFixtures(topikAiRoot, v13Root);

    const result = evaluateTransferSotChecklist({ topikAiRoot, v13Root });
    const report = formatTransferSotChecklistReport(result);

    expect(result.failures).toEqual([]);
    expect(report).toContain('Transfer SOT checklist passed.');
    expect(report).toContain('docs/알림-기능-구현-페이즈-가이드.md');
    expect(report).toContain('docs/supabase/security-and-ownership.md');
    expect(report).toContain('Phase 0 local boundary');
    expect(report).toContain('topik-ai admin-owned notification objects');
  });

  it('fails when a required current v13 SOT file is missing', () => {
    const topikAiRoot = createTempRoot('topik-ai-sot-checklist-');
    const v13Root = createTempRoot('v13-sot-checklist-');
    writeValidFixtures(topikAiRoot, v13Root);
    rmSync(join(v13Root, 'docs/supabase/security-and-ownership.md'), { force: true });

    const result = evaluateTransferSotChecklist({ topikAiRoot, v13Root });

    expect(result.failures).toContain(
      'v13 required SOT/checklist file is missing: docs/supabase/security-and-ownership.md (current v13 notification ownership and security boundary)'
    );
  });

  it('fails when the v13 ownership contract loses a required boundary term', () => {
    const topikAiRoot = createTempRoot('topik-ai-sot-checklist-');
    const v13Root = createTempRoot('v13-sot-checklist-');
    writeValidFixtures(topikAiRoot, v13Root);
    writeProjectFile(v13Root, 'docs/supabase/security-and-ownership.md', 'user_notifications\n');

    const result = evaluateTransferSotChecklist({ topikAiRoot, v13Root });

    expect(result.failures).toContain(
      'v13 required SOT/checklist file must include checklist term: docs/supabase/security-and-ownership.md -> admin_schema_migrations'
    );
  });

  it('fails when the v13 migration index loses the topik-ai transfer migration', () => {
    const topikAiRoot = createTempRoot('topik-ai-sot-checklist-');
    const v13Root = createTempRoot('v13-sot-checklist-');
    writeValidFixtures(topikAiRoot, v13Root);
    writeProjectFile(v13Root, 'supabase/migrations/INDEX.md', 'replay-safe no-op notification_email_config user_marketing_consent\n');

    const result = evaluateTransferSotChecklist({ topikAiRoot, v13Root });

    expect(result.failures).toContain(
      'v13 required SOT/checklist file must include checklist term: supabase/migrations/INDEX.md -> 20260723011242_notification_pipeline_ownership_transfer.sql'
    );
  });

  it('fails when the production runbook omits the completion audit command', () => {
    const topikAiRoot = createTempRoot('topik-ai-sot-checklist-');
    const v13Root = createTempRoot('v13-sot-checklist-');
    writeValidFixtures(topikAiRoot, v13Root);
    writeProjectFile(topikAiRoot, RUNBOOK_FILE, 'npm run harness:admin-boundary:production\n');

    const result = evaluateTransferSotChecklist({ topikAiRoot, v13Root });

    expect(result.failures).toContain(
      'topik-ai required SOT/checklist file must include checklist term: docs/runbooks/notification-worker-production-verification.md -> npm run check:admin-transfer-completion'
    );
  });

  it('fails when the production runbook omits the cross-repo local transfer harness', () => {
    const topikAiRoot = createTempRoot('topik-ai-sot-checklist-');
    const v13Root = createTempRoot('v13-sot-checklist-');
    writeValidFixtures(topikAiRoot, v13Root);
    writeProjectFile(
      topikAiRoot,
      RUNBOOK_FILE,
      ['npm run harness:admin-boundary:production', 'npm run check:admin-transfer-completion', 'v13 transition retirement gate: pass'].join('\n')
    );

    const result = evaluateTransferSotChecklist({ topikAiRoot, v13Root });

    expect(result.failures).toContain(
      'topik-ai required SOT/checklist file must include checklist term: docs/runbooks/notification-worker-production-verification.md -> npm run harness:admin-transfer:local'
    );
  });

  it('fails when the production runbook omits the v13 retirement evidence marker', () => {
    const topikAiRoot = createTempRoot('topik-ai-sot-checklist-');
    const v13Root = createTempRoot('v13-sot-checklist-');
    writeValidFixtures(topikAiRoot, v13Root);
    writeProjectFile(
      topikAiRoot,
      RUNBOOK_FILE,
      ['npm run harness:admin-transfer:local', 'npm run harness:admin-boundary:production', 'npm run check:admin-transfer-completion'].join('\n')
    );

    const result = evaluateTransferSotChecklist({ topikAiRoot, v13Root });

    expect(result.failures).toContain(
      'topik-ai required SOT/checklist file must include checklist term: docs/runbooks/notification-worker-production-verification.md -> v13 transition retirement gate: pass'
    );
  });
});
