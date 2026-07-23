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
    file: 'docs/supabase/security-and-ownership.md',
    reason: 'current v13 notification ownership and security boundary'
  },
  {
    file: 'supabase/migrations/INDEX.md',
    reason: 'current v13 migration order and retired pipeline migration status'
  },
  {
    file: 'scripts/check-notification-migration-replay.mjs',
    reason: 'fail-closed static guard for retired notification pipeline migrations'
  },
  {
    file: 'tests/scripts/check-notification-migration-replay.test.mjs',
    reason: 'regression coverage for the notification migration replay guard'
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
      'topik-ai admin-owned notification objects: templates, groups, dispatches, delivery attempts, email config, private dispatcher/email/consent functions, and notification pg_cron registration',
      'cross-check commands: v13 pnpm harness:admin-boundary; v13 pnpm check:notification-migration-replay; topik-ai npm run harness:admin-boundary:local; topik-ai npm run db:shadow:verify'
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

const V13_REQUIRED_DOC_TERMS = [
  {
    file: 'docs/supabase/security-and-ownership.md',
    terms: [
      'topik-ai',
      'admin_schema_migrations',
      'user_notifications',
      'user_marketing_consent',
      'clean replay'
    ]
  },
  {
    file: 'supabase/migrations/INDEX.md',
    terms: [
      '20260723011242_notification_pipeline_ownership_transfer.sql',
      'replay-safe no-op',
      'notification_email_config',
      'user_marketing_consent'
    ]
  },
  {
    file: 'scripts/check-notification-migration-replay.mjs',
    terms: [
      'notification pipeline migration home: topik-ai',
      '20260612180000_notification_dispatcher.sql',
      '20260612200100_marketing_consent_in_dispatch.sql'
    ]
  }
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

  for (const doc of V13_REQUIRED_DOC_TERMS) {
    if (!hasFile(v13Root, doc.file)) continue;
    const text = readText(v13Root, doc.file);
    for (const term of doc.terms) {
      if (!text.includes(term)) {
        failures.push(`v13 required SOT/checklist file must include checklist term: ${doc.file} -> ${term}`);
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
  const v13Root = v13RootArg
    ? path.resolve(v13RootArg.slice('--v13-root='.length))
    : process.env.TOPIK_V13_ROOT
      ? path.resolve(process.env.TOPIK_V13_ROOT)
      : DEFAULT_V13_ROOT;
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
