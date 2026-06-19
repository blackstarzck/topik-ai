import process from 'node:process';
import { pathToFileURL } from 'node:url';

import {
  evaluateNotificationProductionEvidence
} from './check-notification-production-evidence.mjs';
import {
  evaluateAdminVerificationEnv
} from './check-admin-verification-env.mjs';
import {
  evaluateTransferSotChecklist
} from './check-transfer-sot-checklist.mjs';
import {
  evaluateVercelWorkerReadiness,
  shouldFailReadiness
} from './check-vercel-worker-readiness.mjs';

function item(name, status, detail) {
  return { name, status, detail };
}

export function evaluateAdminTransferCompletionAudit({
  topikAiRoot = process.cwd(),
  v13Root,
  env = process.env
} = {}) {
  const sot = evaluateTransferSotChecklist({ topikAiRoot, v13Root });
  const adminEnv = evaluateAdminVerificationEnv({ rootDir: topikAiRoot });
  const readiness = evaluateVercelWorkerReadiness({ rootDir: topikAiRoot, env });
  const evidence = evaluateNotificationProductionEvidence({
    rootDir: topikAiRoot,
    requireFile: true
  });

  const items = [
    item(
      'SOT checklist',
      sot.failures.length === 0 ? 'pass' : 'fail',
      sot.failures.length === 0 ? 'v13/topik-ai required docs and proposal terms are present.' : sot.failures.join('; ')
    ),
    item(
      'Admin verification env',
      adminEnv.failures.length === 0 ? 'pass' : 'missing',
      adminEnv.failures.join('; ') || `Required admin env names present: ${adminEnv.requiredNames.join(', ')}`
    ),
    item(
      'Vercel worker readiness',
      shouldFailReadiness(readiness, { strictEnv: true }) ? 'missing' : 'pass',
      [...readiness.failures, ...readiness.warnings].join('; ') || 'Vercel project and strict env readiness are present.'
    ),
    item(
      'Production handoff evidence',
      evidence.failures.length === 0 ? 'pass' : 'missing',
      evidence.failures.join('; ') || 'Production smoke and cross-app evidence file is complete.'
    )
  ];

  const status = items.every((entry) => entry.status === 'pass') ? 'complete' : 'incomplete';
  return { status, items };
}

export function formatAdminTransferCompletionAuditReport(result) {
  return [
    `Admin transfer completion audit: ${result.status}`,
    ...result.items.map((entry) => `- ${entry.name}: ${entry.status} - ${entry.detail}`)
  ].join('\n');
}

function main() {
  const result = evaluateAdminTransferCompletionAudit();
  const report = formatAdminTransferCompletionAuditReport(result);
  if (result.status !== 'complete') {
    console.error(report);
    process.exit(1);
  }
  console.log(report);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
