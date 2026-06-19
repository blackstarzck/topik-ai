import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';

import {
  evaluateTransferSotChecklist,
  formatTransferSotChecklistReport
} from '../../scripts/check-transfer-sot-checklist.mjs';

let tempDirs = [];

const V13_FILES = [
  'AGENTS.md',
  'README.md',
  'docs/scope-decisions/2026-06-17-ai-deferred-and-mvp-scope.md',
  'docs/Wireframe/data-usage-index.md',
  'docs/Wireframe/31-X-09-notification-settings/functional-spec.md',
  'docs/Wireframe/31-X-09-notification-settings/description.md',
  'docs/sot-change-proposals/2026-06-18-admin-ownership-transfer-to-topik-ai.md'
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
  for (const file of TOPIK_AI_FILES) {
    writeProjectFile(topikAiRoot, file);
  }
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
  for (const file of V13_FILES) {
    writeProjectFile(v13Root, file);
  }
  writeProjectFile(
    v13Root,
    'docs/sot-change-proposals/2026-06-18-admin-ownership-transfer-to-topik-ai.md',
    [
      'topik-ai',
      'v13',
      'get_admin_users',
      'admin_set_user_status',
      'admin_list_audit_logs',
      'admin_set_admin_app_role',
      'admin_list_admin_app_roles',
      'admin_audit_logs',
      'notification_templates',
      'notification_groups',
      'notification_dispatches',
      'notification_delivery_attempts',
      'operation_notices',
      'operation_faqs',
      'operation_faq_curations',
      'operation_faq_metrics',
      'operation_events',
      'operation_policies',
      'operation_policy_histories',
      'community_posts',
      'community_post_admin_notes',
      'community_reports',
      'commerce_point_policies',
      'commerce_point_ledgers',
      'commerce_point_expirations',
      'commerce_coupons',
      'commerce_coupon_subscription_templates',
      'commerce_refunds',
      'system_metadata_groups',
      'system_metadata_group_items',
      'system_logs',
      'harness:admin-boundary',
      'check:migration-boundary',
      'harness:admin-boundary:production',
      '--dispatch',
      '--require',
      'subscription_plans',
      'subscriptions',
      'payment_history',
      'legal_documents',
      'user_consents',
      'profiles.nationality',
      'topik-ai production runtime env is configured',
      'topik-ai `npm run check:vercel-worker-readiness -- --strict-env` passes',
      'topik-ai `npm run check:notification-production-evidence -- --require` passes',
      'topik-ai `npm run harness:admin-boundary:production` passes',
      'actual `notification_delivery_attempts` state moves from `pending` to `sent` or failure bookkeeping state',
      "v13 X-09 owner-read history verifies only the logged-in user's scope",
      'after verification, decide whether to remove the v13 transition route'
    ].join('\n')
  );
}

afterEach(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  tempDirs = [];
});

describe('check-transfer-sot-checklist', () => {
  it('passes when both repos expose the required SOT/checklist files', () => {
    const topikAiRoot = createTempRoot('topik-ai-sot-checklist-');
    const v13Root = createTempRoot('v13-sot-checklist-');
    writeValidFixtures(topikAiRoot, v13Root);

    const result = evaluateTransferSotChecklist({ topikAiRoot, v13Root });
    const report = formatTransferSotChecklistReport(result);

    expect(result.failures).toEqual([]);
    expect(report).toContain('Transfer SOT checklist passed.');
    expect(report).toContain('docs/알림-기능-구현-페이즈-가이드.md');
    expect(report).toContain('Message history page-sync');
    expect(report).toContain('phase ownership checklist:');
    expect(report).toContain('Phase 0 local boundary');
    expect(report).toContain('v13 retained user-facing/shared objects');
    expect(report).toContain('topik-ai admin-owned objects');
    expect(report).toContain('production handoff gate');
  });

  it('fails when a required v13 SOT file is missing', () => {
    const topikAiRoot = createTempRoot('topik-ai-sot-checklist-');
    const v13Root = createTempRoot('v13-sot-checklist-');
    writeValidFixtures(topikAiRoot, v13Root);
    rmSync(join(v13Root, 'docs/Wireframe/data-usage-index.md'), { force: true });

    const result = evaluateTransferSotChecklist({ topikAiRoot, v13Root });

    expect(result.failures).toContain(
      'v13 required SOT/checklist file is missing: docs/Wireframe/data-usage-index.md (active SOT DB object references and cleanup target)'
    );
  });

  it('fails when the v13 transfer proposal no longer records the phase harness terms', () => {
    const topikAiRoot = createTempRoot('topik-ai-sot-checklist-');
    const v13Root = createTempRoot('v13-sot-checklist-');
    writeValidFixtures(topikAiRoot, v13Root);
    writeProjectFile(v13Root, 'docs/sot-change-proposals/2026-06-18-admin-ownership-transfer-to-topik-ai.md', 'topik-ai v13\n');

    const result = evaluateTransferSotChecklist({ topikAiRoot, v13Root });

    expect(result.failures).toContain('v13 transfer proposal must include checklist term: harness:admin-boundary');
    expect(result.failures).toContain('v13 transfer proposal must include checklist term: check:migration-boundary');
    expect(result.failures).toContain('v13 transfer proposal must include checklist term: harness:admin-boundary:production');
    expect(result.failures).toContain('v13 transfer proposal must include checklist term: --dispatch');
    expect(result.failures).toContain('v13 transfer proposal must include checklist term: --require');
    expect(result.failures).toContain('v13 transfer proposal must include checklist term: payment_history');
    expect(result.failures).toContain('v13 transfer proposal must include checklist term: system_logs');
  });

  it('fails when the v13 transfer proposal omits the production retirement checklist terms', () => {
    const topikAiRoot = createTempRoot('topik-ai-sot-checklist-');
    const v13Root = createTempRoot('v13-sot-checklist-');
    writeValidFixtures(topikAiRoot, v13Root);
    writeProjectFile(
      v13Root,
      'docs/sot-change-proposals/2026-06-18-admin-ownership-transfer-to-topik-ai.md',
      [
        'topik-ai',
        'v13',
        'get_admin_users',
        'admin_set_user_status',
        'admin_list_audit_logs',
        'admin_set_admin_app_role',
        'admin_list_admin_app_roles',
        'admin_audit_logs',
        'notification_templates',
        'notification_groups',
        'notification_dispatches',
        'notification_delivery_attempts',
        'operation_notices',
        'operation_faqs',
        'operation_faq_curations',
        'operation_faq_metrics',
        'operation_events',
        'operation_policies',
        'operation_policy_histories',
        'community_posts',
        'community_post_admin_notes',
        'community_reports',
        'commerce_point_policies',
        'commerce_point_ledgers',
        'commerce_point_expirations',
        'commerce_coupons',
        'commerce_coupon_subscription_templates',
        'commerce_refunds',
        'system_metadata_groups',
        'system_metadata_group_items',
        'system_logs',
        'harness:admin-boundary',
        'check:migration-boundary',
        'harness:admin-boundary:production',
        '--dispatch',
        '--require',
        'subscription_plans',
        'subscriptions',
        'payment_history',
        'legal_documents',
        'user_consents',
        'profiles.nationality'
      ].join('\n')
    );

    const result = evaluateTransferSotChecklist({ topikAiRoot, v13Root });

    expect(result.failures).toContain(
      'v13 transfer proposal must include production retirement checklist term: topik-ai production runtime env is configured'
    );
    expect(result.failures).toContain(
      'v13 transfer proposal must include production retirement checklist term: v13 X-09 owner-read history verifies only the logged-in user\'s scope'
    );
  });

  it('fails when the production runbook does not mention the completion audit command', () => {
    const topikAiRoot = createTempRoot('topik-ai-sot-checklist-');
    const v13Root = createTempRoot('v13-sot-checklist-');
    writeValidFixtures(topikAiRoot, v13Root);
    writeProjectFile(topikAiRoot, RUNBOOK_FILE, 'npm run harness:admin-boundary:production\n');

    const result = evaluateTransferSotChecklist({ topikAiRoot, v13Root });

    expect(result.failures).toContain(
      'topik-ai required SOT/checklist file must include checklist term: docs/runbooks/notification-worker-production-verification.md -> npm run check:admin-transfer-completion'
    );
  });

  it('fails when the production runbook does not mention the cross-repo local transfer harness', () => {
    const topikAiRoot = createTempRoot('topik-ai-sot-checklist-');
    const v13Root = createTempRoot('v13-sot-checklist-');
    writeValidFixtures(topikAiRoot, v13Root);
    writeProjectFile(
      topikAiRoot,
      RUNBOOK_FILE,
      [
        'npm run harness:admin-boundary:production',
        'npm run check:admin-transfer-completion',
        'v13 transition retirement gate: pass'
      ].join('\n')
    );

    const result = evaluateTransferSotChecklist({ topikAiRoot, v13Root });

    expect(result.failures).toContain(
      'topik-ai required SOT/checklist file must include checklist term: docs/runbooks/notification-worker-production-verification.md -> npm run harness:admin-transfer:local'
    );
  });

  it('fails when the production runbook does not require the v13 transition retirement gate evidence marker', () => {
    const topikAiRoot = createTempRoot('topik-ai-sot-checklist-');
    const v13Root = createTempRoot('v13-sot-checklist-');
    writeValidFixtures(topikAiRoot, v13Root);
    writeProjectFile(
      topikAiRoot,
      RUNBOOK_FILE,
      [
        'npm run harness:admin-boundary:production',
        'npm run check:admin-transfer-completion'
      ].join('\n')
    );

    const result = evaluateTransferSotChecklist({ topikAiRoot, v13Root });

    expect(result.failures).toContain(
      'topik-ai required SOT/checklist file must include checklist term: docs/runbooks/notification-worker-production-verification.md -> v13 transition retirement gate: pass'
    );
  });
});
