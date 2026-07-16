import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

export const blockedPatterns = [
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

const textExtensions = new Set([
  '.css',
  '.html',
  '.js',
  '.json',
  '.map',
  '.svg',
  '.txt',
  '.webmanifest'
]);

function collectFiles(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(fullPath));
      continue;
    }
    if (entry.isFile() && textExtensions.has(extname(entry.name))) {
      files.push(fullPath);
    }
  }

  return files;
}

export function evaluateClientBundleSecretLeaks({ rootDir = process.cwd(), distRelativeDir = 'dist' } = {}) {
  const distDir = join(rootDir, distRelativeDir);

  if (!existsSync(distDir) || !statSync(distDir).isDirectory()) {
    return {
      distMissing: true,
      matches: []
    };
  }

  const matches = [];

  for (const file of collectFiles(distDir)) {
    const content = readFileSync(file, 'utf8');
    for (const pattern of blockedPatterns) {
      if (content.includes(pattern)) {
        matches.push({
          file: relative(rootDir, file),
          marker: pattern
        });
      }
    }
  }

  return {
    distMissing: false,
    matches
  };
}

export function formatClientBundleSecretLeakReport(result) {
  if (result.distMissing) {
    return 'dist directory not found. Run npm run build before check:client-secrets.';
  }

  if (result.matches.length > 0) {
    return [
      'Client bundle contains server-only notification worker markers:',
      ...result.matches.map((match) => `- ${match.file} contains ${match.marker}`)
    ].join('\n');
  }

  return 'Client bundle secret leak check passed.';
}

function main() {
  const result = evaluateClientBundleSecretLeaks();
  const report = formatClientBundleSecretLeakReport(result);

  if (result.distMissing || result.matches.length > 0) {
    console.error(report);
    process.exit(1);
  }

  console.log(report);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
