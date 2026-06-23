import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const REQUIRED_SOURCE_REFERENCES = [
  {
    file: 'src/features/message/api/notification-supabase-adapter.ts',
    terms: [
      'notification_dispatches',
      'notification_delivery_attempts',
      ".eq('dispatch_id', dispatchId)",
      '.limit(200)'
    ]
  },
  {
    file: 'src/features/message/api/messages-service.ts',
    terms: ['notification_dispatches']
  },
  {
    file: 'src/features/message/pages/message-history-page.tsx',
    terms: ['notification_dispatches']
  }
];

const REQUIRED_DOC_REFERENCES = [
  {
    file: 'docs/specs/admin-data-contract.md',
    terms: ['NotificationDispatch', 'NotificationDeliveryAttempt', 'notification_dispatches', 'notification_delivery_attempts']
  },
  {
    file: 'docs/page-sync/message-history-page-sync.md',
    terms: ['NotificationDispatch', 'NotificationDeliveryAttempt', 'notification_dispatches', 'notification_delivery_attempts']
  },
  {
    file: 'docs/architecture/shared-supabase-schema-ownership.md',
    terms: ['notification_dispatches', 'notification_delivery_attempts', 'v13 X-09']
  }
];

const STALE_TERMS = ['message_histories', 'message_history_recipients'];
const SCAN_DIRS = ['src/features/message', 'docs/specs', 'docs/page-sync', 'docs/architecture'];
const ALLOWED_STALE_FILES = new Set(['logs/admin-doc-update-log.md']);
const ADMIN_ATTEMPT_READER_FILE = 'src/features/message/api/notification-supabase-adapter.ts';

function toPosix(value) {
  return value.split(path.sep).join('/');
}

function readProjectFile(rootDir, relativePath) {
  return readFileSync(path.join(rootDir, relativePath), 'utf8');
}

function listFiles(rootDir, relativeDir) {
  const absoluteDir = path.join(rootDir, relativeDir);
  const entries = readdirSync(absoluteDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = path.join(absoluteDir, entry.name);
    const relativePath = toPosix(path.relative(rootDir, absolutePath));

    if (entry.isDirectory()) {
      files.push(...listFiles(rootDir, relativePath));
      continue;
    }

    if (entry.isFile() && /\.(md|ts|tsx|mjs)$/.test(entry.name)) {
      files.push(relativePath);
    }
  }

  return files;
}

function fileExists(rootDir, relativePath) {
  try {
    return statSync(path.join(rootDir, relativePath)).isFile();
  } catch {
    return false;
  }
}

export function evaluateMessageHistoryBoundary({ rootDir = ROOT_DIR } = {}) {
  const failures = [];

  for (const requirement of [...REQUIRED_SOURCE_REFERENCES, ...REQUIRED_DOC_REFERENCES]) {
    if (!fileExists(rootDir, requirement.file)) {
      failures.push(`${requirement.file} is missing.`);
      continue;
    }

    const content = readProjectFile(rootDir, requirement.file);
    for (const term of requirement.terms) {
      if (!content.includes(term)) {
        failures.push(`${requirement.file} must reference ${term}.`);
      }
    }
  }

  const scanFiles = SCAN_DIRS.flatMap((dir) => listFiles(rootDir, dir));
  for (const relativePath of scanFiles) {
    if (ALLOWED_STALE_FILES.has(relativePath)) {
      continue;
    }

    const content = readProjectFile(rootDir, relativePath);
    for (const term of STALE_TERMS) {
      if (content.includes(term)) {
        failures.push(`${relativePath} still references stale message history table candidate ${term}.`);
      }
    }
  }

  if (fileExists(rootDir, ADMIN_ATTEMPT_READER_FILE)) {
    const adapter = readProjectFile(rootDir, ADMIN_ATTEMPT_READER_FILE);
    const attemptReaderStart = adapter.indexOf('export async function loadNotificationDispatchAttempts');
    const attemptReaderEnd = adapter.indexOf('\n// ---------------------------------------------------------------------------', attemptReaderStart + 1);
    const attemptReader =
      attemptReaderStart === -1
        ? ''
        : adapter.slice(attemptReaderStart, attemptReaderEnd === -1 ? adapter.length : attemptReaderEnd);

    if (attemptReader.includes(".eq('user_id'")) {
      failures.push(
        `${ADMIN_ATTEMPT_READER_FILE} loadNotificationDispatchAttempts must not filter by user_id; topik-ai admin detail reads are dispatch-scoped.`
      );
    }
  }

  return { failures };
}

export function formatMessageHistoryBoundaryReport(result) {
  if (result.failures.length === 0) {
    return 'Message history boundary check passed.';
  }

  return ['Message history boundary check failed:', ...result.failures.map((failure) => `- ${failure}`)].join('\n');
}

function main() {
  const result = evaluateMessageHistoryBoundary();
  const report = formatMessageHistoryBoundaryReport(result);

  if (result.failures.length > 0) {
    console.error(report);
    process.exit(1);
  }

  console.log(report);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
