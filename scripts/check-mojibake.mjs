import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const IGNORED_DIRS = new Set([
  '.git',
  '.codex-artifacts',
  'coverage',
  'dist',
  'node_modules',
  'playwright-report',
  'test-results'
]);
const DEFAULT_SCAN_ROOTS = ['src', 'docs', 'tests', 'scripts'];
const ROOT_FILES = ['index.html', 'package.json', 'README.md'];
const IGNORED_FILES = new Set([
  'scripts/check-mojibake.mjs',
  'tests/unit/mojibake-check.test.mjs'
]);
const TEXT_EXTENSIONS = new Set([
  '.css',
  '.cjs',
  '.html',
  '.js',
  '.json',
  '.jsx',
  '.md',
  '.mjs',
  '.ts',
  '.tsx',
  '.txt',
  '.yaml',
  '.yml'
]);

const SUSPICIOUS_FRAGMENTS = [
  '\uFFFD',
  '??line',
  '?꾩룇',
  '獄쏆',
  '疫꿸',
  '諛쒖',
  '?대젰',
  '?뚮┝',
  '湲곕뒫',
  '援ы쁽',
  '?섏씠',
  '筌?',
  '揶쎛'
];

function isTextFile(filePath) {
  return TEXT_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function isIgnoredFile(filePath, rootDir) {
  const relativePath = path.relative(rootDir, filePath).replaceAll(path.sep, '/');
  return IGNORED_FILES.has(relativePath);
}

function walk(targetPath, collector, rootDir) {
  if (!fs.existsSync(targetPath)) return;
  const stat = fs.statSync(targetPath);

  if (stat.isFile()) {
    if (isTextFile(targetPath) && !isIgnoredFile(targetPath, rootDir)) collector.push(targetPath);
    return;
  }

  for (const entry of fs.readdirSync(targetPath, { withFileTypes: true })) {
    if (entry.isDirectory() && IGNORED_DIRS.has(entry.name)) continue;
    walk(path.join(targetPath, entry.name), collector, rootDir);
  }
}

export function scanTextForMojibake(content) {
  const results = [];
  const lines = content.split(/\r?\n/);

  lines.forEach((line, index) => {
    if (SUSPICIOUS_FRAGMENTS.some((fragment) => line.includes(fragment))) {
      results.push({ line: index + 1, text: line.trim() });
    }
  });

  return results;
}

export function scanFile(filePath) {
  return scanTextForMojibake(fs.readFileSync(filePath, 'utf8'));
}

export function collectTextFiles({ rootDir = ROOT, scanRoots = DEFAULT_SCAN_ROOTS } = {}) {
  const files = [];
  for (const scanRoot of scanRoots) {
    walk(path.join(rootDir, scanRoot), files, rootDir);
  }
  if (scanRoots === DEFAULT_SCAN_ROOTS) {
    for (const rootFile of ROOT_FILES) {
      walk(path.join(rootDir, rootFile), files, rootDir);
    }
  }
  return files;
}

export function evaluateMojibake({ rootDir = ROOT, scanRoots = DEFAULT_SCAN_ROOTS } = {}) {
  const files = collectTextFiles({ rootDir, scanRoots });
  const findings = [];

  for (const filePath of files) {
    const matches = scanFile(filePath);
    matches.forEach((match) => {
      findings.push({
        filePath: path.relative(rootDir, filePath).replaceAll(path.sep, '/'),
        ...match
      });
    });
  }

  return { findings };
}

export function formatMojibakeReport(result) {
  if (result.findings.length === 0) {
    return 'No suspicious mojibake patterns found.';
  }

  return [
    'Suspicious mojibake patterns detected:',
    ...result.findings.map((finding) => `${finding.filePath}:${finding.line} ${finding.text}`)
  ].join('\n');
}

function main() {
  const scanRoots = process.argv.slice(2);
  const result = evaluateMojibake({
    scanRoots: scanRoots.length > 0 ? scanRoots : DEFAULT_SCAN_ROOTS
  });
  const report = formatMojibakeReport(result);

  if (result.findings.length > 0) {
    console.error(report);
    process.exit(1);
  }

  console.log(report);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
