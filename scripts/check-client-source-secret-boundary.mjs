import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLIENT_SOURCE_DIRS = ['src'];
const WORKER_ENDPOINT_MARKERS = [
  '/api/notifications/dispatch-email',
  'api/notifications/dispatch-email'
];
const WORKER_ENDPOINT_ALLOWLIST = new Set([
  'src/shared/api/notification-email-kick.ts'
]);

const BLOCKED_MARKERS = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_SECRET_KEY',
  'RESEND_API_KEY',
  'SMTP_HOST',
  'SMTP_USER',
  'SMTP_PASS',
  'SMTP_FROM',
  'NOTIFICATION_WORKER_SECRET',
  'CRON_SECRET',
  'x-worker-secret'
];

const TEXT_FILE_PATTERN = /\.(ts|tsx|js|jsx|mjs|cjs|json|css|scss|md|mdx)$/;
const SKIP_DIRS = new Set(['.git', 'dist', 'node_modules', 'playwright-report', 'test-results']);

function toPosix(value) {
  return value.split(path.sep).join('/');
}

function listTextFiles(rootDir, relativeDir) {
  const absoluteDir = path.join(rootDir, relativeDir);
  const entries = readdirSync(absoluteDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      files.push(...listTextFiles(rootDir, path.join(relativeDir, entry.name)));
      continue;
    }

    if (entry.isFile() && TEXT_FILE_PATTERN.test(entry.name)) {
      files.push(toPosix(path.join(relativeDir, entry.name)));
    }
  }

  return files;
}

export function evaluateClientSourceSecretBoundary({ rootDir = ROOT_DIR } = {}) {
  const files = CLIENT_SOURCE_DIRS.flatMap((dir) => listTextFiles(rootDir, dir));
  const matches = [];

  for (const file of files) {
    const content = readFileSync(path.join(rootDir, file), 'utf8');
    for (const marker of BLOCKED_MARKERS) {
      if (content.includes(marker)) {
        matches.push({ file, marker });
      }
    }

    if (!WORKER_ENDPOINT_ALLOWLIST.has(file)) {
      for (const marker of WORKER_ENDPOINT_MARKERS) {
        if (content.includes(marker)) {
          matches.push({ file, marker });
        }
      }
    }
  }

  return { matches };
}

export function formatClientSourceSecretBoundaryReport(result) {
  if (result.matches.length === 0) {
    return 'Client source secret boundary check passed.';
  }

  return [
    'Client source contains server-only notification worker markers:',
    ...result.matches.map((match) => `- ${match.file}: ${match.marker}`)
  ].join('\n');
}

function main() {
  const result = evaluateClientSourceSecretBoundary();
  const report = formatClientSourceSecretBoundaryReport(result);

  if (result.matches.length > 0) {
    console.error(report);
    process.exit(1);
  }

  console.log(report);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
