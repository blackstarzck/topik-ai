import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';

import {
  evaluateAdminTransferCompletionAudit,
  formatAdminTransferCompletionAuditReport
} from '../../scripts/check-admin-transfer-completion-audit.mjs';

let tempDirs = [];

function createTempRoot(prefix) {
  const root = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(root);
  return root;
}

function write(root, relativePath, content = 'ok\n') {
  const file = join(root, relativePath);
  mkdirSync(join(file, '..'), { recursive: true });
  writeFileSync(file, content, 'utf8');
}

function writeRequiredDocs(topikAiRoot, v13Root) {
  for (const file of [
    'AGENTS.md',
    'supabase/README.md',
    'docs/architecture/shared-supabase-schema-ownership.md',
    'docs/specs/admin-data-contract.md',
    'docs/specs/admin-data-usage-map.md',
    'docs/specs/notification-contract.md',
    'docs/page-sync/message-history-page-sync.md',
    'docs/page-sync/message-inapp-page-sync.md',
    'docs/알림-기능-구현-페이즈-가이드.md'
  ]) {
    write(topikAiRoot, file);
  }
  for (const file of [
    'AGENTS.md',
    'README.md',
    'docs/scope-decisions/2026-06-17-ai-deferred-and-mvp-scope.md',
    'docs/Wireframe/data-usage-index.md',
    'docs/Wireframe/31-X-09-notification-settings/functional-spec.md',
    'docs/Wireframe/31-X-09-notification-settings/description.md',
    'docs/sot-change-proposals/2026-06-18-admin-ownership-transfer-to-topik-ai.md'
  ]) {
    write(v13Root, file);
  }
  write(
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
}

function writeReadinessFixtures(root) {
  write(root, '.vercel/project.json', JSON.stringify({
    projectId: 'prj_example',
    orgId: 'team_example'
  }));
  write(root, '.env.example', [
    'SUPABASE_URL=',
    'SUPABASE_SERVICE_ROLE_KEY=',
    'NOTIFICATION_WORKER_SECRET=',
    'CRON_SECRET=',
    'RESEND_API_KEY=',
    'RESEND_FROM=',
    'SITE_URL=',
    'TOPIK_AI_PRODUCTION_URL='
  ].join('\n'));
  write(root, 'vercel.json', JSON.stringify({
    crons: [{ path: '/api/notifications/dispatch-email', schedule: '*/15 * * * *' }],
    rewrites: [{ source: '/((?!api/).*)', destination: '/index.html' }]
  }));
  write(root, '.env.local', [
    'E2E_ADMIN_EMAIL=admin@example.com',
    'E2E_ADMIN_PASSWORD=secret-value'
  ].join('\n'));
}

function completeEvidenceWithoutRetirementGate() {
  return `
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
- Route retirement SOT approval: n/a
- Reason: production smoke verified, route retirement tracked separately.
`;
}

afterEach(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  tempDirs = [];
});

describe('check-admin-transfer-completion-audit', () => {
  it('marks the transfer incomplete when production evidence is absent even if SOT checklist passes', () => {
    const topikAiRoot = createTempRoot('topik-ai-completion-audit-');
    const v13Root = createTempRoot('v13-completion-audit-');
    writeRequiredDocs(topikAiRoot, v13Root);
    write(topikAiRoot, '.env.example', [
      'SUPABASE_URL=',
      'SUPABASE_SERVICE_ROLE_KEY=',
      'NOTIFICATION_WORKER_SECRET=',
      'CRON_SECRET=',
      'RESEND_API_KEY=',
      'RESEND_FROM=',
      'SITE_URL=',
      'TOPIK_AI_PRODUCTION_URL='
    ].join('\n'));
    write(topikAiRoot, 'vercel.json', JSON.stringify({
      crons: [{ path: '/api/notifications/dispatch-email', schedule: '*/15 * * * *' }],
      rewrites: [{ source: '/((?!api/).*)', destination: '/index.html' }]
    }));
    write(topikAiRoot, '.env.local', [
      'E2E_ADMIN_EMAIL=admin@example.com',
      'E2E_ADMIN_PASSWORD=secret-value'
    ].join('\n'));

    const result = evaluateAdminTransferCompletionAudit({ topikAiRoot, v13Root, env: {} });
    const report = formatAdminTransferCompletionAuditReport(result);

    expect(result.status).toBe('incomplete');
    expect(result.items).toContainEqual(expect.objectContaining({
      name: 'Admin verification env',
      status: 'pass'
    }));
    expect(result.items).toContainEqual(expect.objectContaining({
      name: 'Production handoff evidence',
      status: 'missing'
    }));
    expect(report).toContain('Admin transfer completion audit: incomplete');
    expect(report).toContain('Admin verification env: pass');
    expect(report).not.toContain('admin@example.com');
    expect(report).not.toContain('secret-value');
    expect(report).toContain('Production handoff evidence: missing');
  });

  it('marks the transfer incomplete when admin verification env names are absent', () => {
    const topikAiRoot = createTempRoot('topik-ai-completion-audit-');
    const v13Root = createTempRoot('v13-completion-audit-');
    writeRequiredDocs(topikAiRoot, v13Root);

    const result = evaluateAdminTransferCompletionAudit({ topikAiRoot, v13Root, env: {} });
    const report = formatAdminTransferCompletionAuditReport(result);

    expect(result.status).toBe('incomplete');
    expect(result.items).toContainEqual(expect.objectContaining({
      name: 'Admin verification env',
      status: 'missing',
      detail: expect.stringContaining('E2E_ADMIN_EMAIL')
    }));
    expect(report).toContain('Admin verification env: missing');
    expect(report).toContain('E2E_ADMIN_PASSWORD');
  });

  it('marks the transfer incomplete when production evidence omits the v13 transition retirement gate marker', () => {
    const topikAiRoot = createTempRoot('topik-ai-completion-audit-');
    const v13Root = createTempRoot('v13-completion-audit-');
    writeRequiredDocs(topikAiRoot, v13Root);
    writeReadinessFixtures(topikAiRoot);
    write(
      topikAiRoot,
      'docs/runbooks/notification-worker-production-evidence.md',
      completeEvidenceWithoutRetirementGate()
    );

    const result = evaluateAdminTransferCompletionAudit({
      topikAiRoot,
      v13Root,
      env: {
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
        NOTIFICATION_WORKER_SECRET: 'worker-secret',
        CRON_SECRET: 'cron-secret',
        RESEND_API_KEY: 'resend-key',
        RESEND_FROM: 'noreply@example.com',
        SITE_URL: 'https://app.example.com',
        TOPIK_AI_PRODUCTION_URL: 'https://admin.example.com'
      }
    });
    const report = formatAdminTransferCompletionAuditReport(result);

    expect(result.status).toBe('incomplete');
    expect(result.items).toContainEqual(expect.objectContaining({
      name: 'Production handoff evidence',
      status: 'missing',
      detail: expect.stringContaining('v13 transition retirement gate pass')
    }));
    expect(report).toContain('Admin transfer completion audit: incomplete');
  });
});
