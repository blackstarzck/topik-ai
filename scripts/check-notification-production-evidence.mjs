import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const DEFAULT_EVIDENCE_FILE = 'docs/runbooks/notification-worker-production-evidence.md';

const REQUIRED_MARKERS = [
  { label: 'v13 required SOT checked', pattern: /v13 required SOT checked:\s*yes/i },
  { label: 'topik-ai required SOT checked', pattern: /topik-ai required SOT checked:\s*yes/i },
  { label: 'topik-ai transfer checklist pass', pattern: /topik-ai transfer checklist:\s*pass/i },
  { label: 'topik-ai source secret check pass', pattern: /topik-ai source secret check:\s*pass/i },
  { label: 'topik-ai build pass', pattern: /topik-ai build:\s*pass/i },
  { label: 'topik-ai bundle secret check pass', pattern: /topik-ai bundle secret check:\s*pass/i },
  { label: 'topik-ai targeted unit tests pass', pattern: /topik-ai targeted unit tests:\s*pass/i },
  { label: 'v13 admin boundary harness pass', pattern: /v13 admin boundary harness:\s*pass/i },
  { label: 'v13 transition retirement gate pass', pattern: /v13 transition retirement gate:\s*pass/i },
  { label: 'Vercel project linked', pattern: /Project linked:\s*yes/i },
  { label: 'production env configured', pattern: /Production env names configured:\s*yes/i },
  { label: 'readiness command pass', pattern: /Readiness command:\s*pass/i },
  { label: 'unauthenticated GET 401 pass', pattern: /Unauthenticated GET 401:\s*pass/i },
  { label: 'authenticated cron GET 2xx pass', pattern: /Authenticated cron GET 2xx:\s*pass/i },
  { label: 'authenticated manual POST 2xx pass', pattern: /Authenticated manual POST 2xx:\s*pass/i },
  { label: 'topik-ai admin history verified', pattern: /topik-ai admin history verified:\s*yes/i },
  { label: 'v13 owner-read history verified', pattern: /v13 owner-read history verified:\s*yes/i },
  { label: 'route decision recorded', pattern: /- (Keep v13 transition route|retire v13 transition route)/i }
];

const SECRET_VALUE_PATTERNS = [
  /SUPABASE_ACCESS_TOKEN\s*=\s*\S+/i,
  /SUPABASE_SERVICE_ROLE_KEY\s*=\s*\S+/i,
  /SUPABASE_SECRET_KEY\s*=\s*\S+/i,
  /CRON_SECRET\s*=\s*\S+/i,
  /NOTIFICATION_WORKER_SECRET\s*=\s*\S+/i,
  /RESEND_API_KEY\s*=\s*\S+/i,
  /SMTP_PASS\s*=\s*\S+/i,
  /Bearer\s+[A-Za-z0-9._~+/=-]{12,}/i
];

function hasNonPlaceholderValue(text, label, placeholders) {
  const line = text
    .split(/\r?\n/)
    .find((entry) => entry.trim().toLowerCase().startsWith(`- ${label.toLowerCase()}:`));
  if (!line) return false;
  const value = line.slice(line.indexOf(':') + 1).trim();
  if (!value) return false;
  return !placeholders.some((placeholder) => value.toLowerCase() === placeholder);
}

export function evaluateNotificationProductionEvidence({
  rootDir = process.cwd(),
  evidenceFile = DEFAULT_EVIDENCE_FILE,
  requireFile = false
} = {}) {
  const absolutePath = path.join(rootDir, evidenceFile);
  if (!existsSync(absolutePath)) {
    return {
      skipped: !requireFile,
      failures: requireFile ? [`Production evidence file is missing: ${evidenceFile}`] : [],
      missingMarkers: requireFile ? REQUIRED_MARKERS.map((marker) => marker.label) : [],
      evidenceFile
    };
  }

  const text = readFileSync(absolutePath, 'utf8');
  const missingMarkers = REQUIRED_MARKERS.filter((marker) => !marker.pattern.test(text)).map((marker) => marker.label);
  if (!hasNonPlaceholderValue(text, 'Dispatch id', ['dispatch-id', 'n/a', 'none']) || /dispatch id:\s*.*redacted/i.test(text)) {
    missingMarkers.push('dispatch id recorded');
  }
  if (!hasNonPlaceholderValue(text, 'Attempt ids', ['attempt-id', 'n/a', 'none']) || /attempt ids:\s*.*redacted/i.test(text)) {
    missingMarkers.push('attempt id recorded');
  }
  if (/retire v13 transition route/i.test(text) && !/Route retirement SOT approval:\s*yes/i.test(text)) {
    missingMarkers.push('route retirement SOT approval recorded');
  }
  const secretLeaks = SECRET_VALUE_PATTERNS.filter((pattern) => pattern.test(text)).map((pattern) => String(pattern));
  const failures = [
    ...missingMarkers.map((marker) => `Missing production evidence marker: ${marker}`),
    ...secretLeaks.map((pattern) => `Evidence file appears to contain a secret value matching ${pattern}`)
  ];

  return {
    skipped: false,
    failures,
    missingMarkers,
    secretLeaks,
    evidenceFile
  };
}

export function formatNotificationProductionEvidenceReport(result) {
  if (result.skipped) {
    return `[notification-production-evidence] SKIP: ${result.evidenceFile} is absent. Use --require for the production handoff gate.`;
  }

  if (result.failures.length > 0) {
    return [
      '[notification-production-evidence] FAIL',
      ...result.failures.map((failure) => `- ${failure}`)
    ].join('\n');
  }

  return '[notification-production-evidence] PASS: production handoff evidence is complete and no secret value patterns were found.';
}

function main() {
  const requireFile = process.argv.includes('--require');
  const fileArg = process.argv.find((arg) => arg.startsWith('--file='));
  const evidenceFile = fileArg ? fileArg.slice('--file='.length) : DEFAULT_EVIDENCE_FILE;
  const result = evaluateNotificationProductionEvidence({ requireFile, evidenceFile });
  const report = formatNotificationProductionEvidenceReport(result);
  if (result.failures.length > 0) {
    console.error(report);
    process.exit(1);
  }
  console.log(report);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
