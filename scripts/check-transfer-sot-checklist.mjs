import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const TOPIK_AI_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_V13_ROOT = path.resolve(TOPIK_AI_ROOT, '..', 'topik-project', 'v13');

const V13_REQUIRED_DOCS = [
  {
    file: 'AGENTS.md',
    reason: 'work procedure, SOT edit limits, verification and reporting rules'
  },
  {
    file: 'README.md',
    reason: 'v13 runtime and deployment baseline'
  },
  {
    file: 'docs/scope-decisions/2026-06-17-ai-deferred-and-mvp-scope.md',
    reason: 'MVP and deferred/external integration boundary'
  },
  {
    file: 'docs/Wireframe/data-usage-index.md',
    reason: 'active SOT DB object references and cleanup target'
  },
  {
    file: 'docs/Wireframe/31-X-09-notification-settings/functional-spec.md',
    reason: 'v13 notification settings and history user contract'
  },
  {
    file: 'docs/Wireframe/31-X-09-notification-settings/description.md',
    reason: 'v13 notification settings screen description'
  },
  {
    file: 'docs/sot-change-proposals/2026-06-18-admin-ownership-transfer-to-topik-ai.md',
    reason: 'proposal record for admin ownership transfer without direct active SOT edits'
  }
];

const TOPIK_AI_REQUIRED_DOCS = [
  {
    file: 'AGENTS.md',
    reason: 'topik-ai admin repo work rules'
  },
  {
    file: 'supabase/README.md',
    reason: 'topik_writing/admin migration tracker separation'
  },
  {
    file: 'docs/architecture/shared-supabase-schema-ownership.md',
    reason: 'shared Supabase schema owner/writer/reader matrix'
  },
  {
    file: 'docs/specs/admin-data-contract.md',
    reason: 'admin page data contract'
  },
  {
    file: 'docs/specs/admin-data-usage-map.md',
    reason: 'admin page Supabase source map'
  },
  {
    file: 'docs/specs/notification-contract.md',
    reason: 'notification dispatch/attempt status contract'
  },
  {
    file: 'docs/page-sync/message-history-page-sync.md',
    reason: 'Message history page-sync'
  },
  {
    file: 'docs/page-sync/message-inapp-page-sync.md',
    reason: 'in-app message send page-sync'
  },
  {
    file: 'docs/알림-기능-구현-페이즈-가이드.md',
    reason: 'notification worker ownership and production transfer checklist'
  },
  {
    file: 'docs/runbooks/notification-worker-production-verification.md',
    reason: 'operator runbook for production handoff and completion audit'
  }
];

const PHASE_OWNERSHIP_CHECKLIST = [
  {
    phase: 'Phase 0 local boundary',
    items: [
      'v13 retained user-facing/shared objects: profiles, notification_settings, user_notifications, user_marketing_consent, notification_delivery_attempts owner-read, subscription_plans, subscriptions, payment_history, legal_documents, user_consents',
      'topik-ai admin-owned objects: get_admin_users, admin_set_user_status, admin_audit_logs, notification templates/groups/dispatches, operation, community, commerce, system metadata/log objects',
      'cross-check commands: v13 pnpm harness:admin-boundary; topik-ai npm run harness:admin-boundary:local'
    ]
  },
  {
    phase: 'Phase 1 production handoff gate',
    items: [
      'production handoff gate: .vercel/project.json, server-only runtime env, TOPIK_AI_PRODUCTION_URL, authenticated worker smoke, production evidence file',
      'v13 transition route retirement waits for production evidence and approved SOT cleanup'
    ]
  }
];

const REQUIRED_PROPOSAL_TERMS = [
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
];

const REQUIRED_PRODUCTION_RETIREMENT_TERMS = [
  'topik-ai production runtime env is configured',
  'topik-ai `npm run check:vercel-worker-readiness -- --strict-env` passes',
  'topik-ai `npm run check:notification-production-evidence -- --require` passes',
  'topik-ai `npm run harness:admin-boundary:production` passes',
  'actual `notification_delivery_attempts` state moves from `pending` to `sent` or failure bookkeeping state',
  "v13 X-09 owner-read history verifies only the logged-in user's scope",
  'after verification, decide whether to remove the v13 transition route'
];

const TOPIK_AI_REQUIRED_DOC_TERMS = [
  {
    file: 'docs/runbooks/notification-worker-production-verification.md',
    terms: [
      'npm run harness:admin-transfer:local',
      'npm run harness:admin-boundary:production',
      'npm run check:admin-transfer-completion',
      'v13 transition retirement gate: pass'
    ]
  }
];

function hasFile(rootDir, relativePath) {
  try {
    return statSync(path.join(rootDir, relativePath)).isFile();
  } catch {
    return false;
  }
}

function readText(rootDir, relativePath) {
  return readFileSync(path.join(rootDir, relativePath), 'utf8');
}

function checkDocs(rootDir, docs, label) {
  return docs.flatMap((doc) => {
    if (hasFile(rootDir, doc.file)) {
      return [];
    }

    return [`${label} required SOT/checklist file is missing: ${doc.file} (${doc.reason})`];
  });
}

export function evaluateTransferSotChecklist({
  topikAiRoot = TOPIK_AI_ROOT,
  v13Root = DEFAULT_V13_ROOT
} = {}) {
  const failures = [
    ...checkDocs(v13Root, V13_REQUIRED_DOCS, 'v13'),
    ...checkDocs(topikAiRoot, TOPIK_AI_REQUIRED_DOCS, 'topik-ai')
  ];

  const proposalPath = 'docs/sot-change-proposals/2026-06-18-admin-ownership-transfer-to-topik-ai.md';
  if (hasFile(v13Root, proposalPath)) {
    const proposal = readText(v13Root, proposalPath);
    for (const term of REQUIRED_PROPOSAL_TERMS) {
      if (!proposal.includes(term)) {
        failures.push(`v13 transfer proposal must include checklist term: ${term}`);
      }
    }

    for (const term of REQUIRED_PRODUCTION_RETIREMENT_TERMS) {
      if (!proposal.includes(term)) {
        failures.push(`v13 transfer proposal must include production retirement checklist term: ${term}`);
      }
    }
  }

  for (const doc of TOPIK_AI_REQUIRED_DOC_TERMS) {
    if (!hasFile(topikAiRoot, doc.file)) continue;
    const text = readText(topikAiRoot, doc.file);
    for (const term of doc.terms) {
      if (!text.includes(term)) {
        failures.push(`topik-ai required SOT/checklist file must include checklist term: ${doc.file} -> ${term}`);
      }
    }
  }

  return {
    failures,
    checklist: {
      v13: V13_REQUIRED_DOCS,
      topikAi: TOPIK_AI_REQUIRED_DOCS,
      phases: PHASE_OWNERSHIP_CHECKLIST
    }
  };
}

export function formatTransferSotChecklistReport(result) {
  if (result.failures.length > 0) {
    return ['Transfer SOT checklist failed:', ...result.failures.map((failure) => `- ${failure}`)].join('\n');
  }

  const lines = ['Transfer SOT checklist passed.', 'v13 required files:'];
  for (const doc of result.checklist.v13) {
    lines.push(`- ${doc.file} - ${doc.reason}`);
  }
  lines.push('topik-ai required files:');
  for (const doc of result.checklist.topikAi) {
    lines.push(`- ${doc.file} - ${doc.reason}`);
  }
  lines.push('phase ownership checklist:');
  for (const phase of result.checklist.phases) {
    lines.push(`- ${phase.phase}`);
    for (const item of phase.items) {
      lines.push(`  - ${item}`);
    }
  }
  return lines.join('\n');
}

function main() {
  const v13RootArg = process.argv.find((arg) => arg.startsWith('--v13-root='));
  const v13Root = v13RootArg ? path.resolve(v13RootArg.slice('--v13-root='.length)) : DEFAULT_V13_ROOT;
  const result = evaluateTransferSotChecklist({ v13Root });
  const report = formatTransferSotChecklistReport(result);

  if (result.failures.length > 0) {
    console.error(report);
    process.exit(1);
  }

  console.log(report);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
