import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.cwd();
const THIS_FILE = fileURLToPath(import.meta.url);
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

const SUSPICIOUS_PATTERNS = [
  '�',
  '?댁쁺',
  '?섏젙',
  '?ㅼ젙',
  '媛먯',
  '硫붿',
  '荑좏',
  '願',
  '而ㅻ',
  '異붽',
  '痍⑥',
  '??쒕낫',
  '鍮꾪솢',
  '怨좉컼?'
];

function isTextFile(filePath) {
  return TEXT_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function walk(targetPath, collector) {
  if (!fs.existsSync(targetPath)) return;
  const stat = fs.statSync(targetPath);

  if (stat.isFile()) {
    if (path.resolve(targetPath) === path.resolve(THIS_FILE)) {
      return;
    }
    if (isTextFile(targetPath)) collector.push(targetPath);
    return;
  }

  for (const entry of fs.readdirSync(targetPath, { withFileTypes: true })) {
    if (entry.isDirectory() && IGNORED_DIRS.has(entry.name)) continue;
    walk(path.join(targetPath, entry.name), collector);
  }
}

function scanFile(filePath) {
  const results = [];
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);

  lines.forEach((line, index) => {
    if (line.includes('??')) {
      const normalized = line.replaceAll('??', '');
      if (SUSPICIOUS_PATTERNS.some((pattern) => pattern !== '�' && normalized.includes(pattern))) {
        results.push({ line: index + 1, text: line.trim() });
      }
      return;
    }

    if (SUSPICIOUS_PATTERNS.some((pattern) => line.includes(pattern))) {
      results.push({ line: index + 1, text: line.trim() });
    }
  });

  return results;
}

const scanRoots = process.argv.slice(2);
const effectiveRoots = scanRoots.length > 0 ? scanRoots : DEFAULT_SCAN_ROOTS;

const files = [];
for (const scanRoot of effectiveRoots) {
  walk(path.join(ROOT, scanRoot), files);
}
if (scanRoots.length === 0) {
  for (const rootFile of ROOT_FILES) {
    walk(path.join(ROOT, rootFile), files);
  }
}

const findings = [];
for (const filePath of files) {
  const matches = scanFile(filePath);
  matches.forEach((match) => {
    findings.push({
      filePath: path.relative(ROOT, filePath).replaceAll(path.sep, '/'),
      ...match
    });
  });
}

if (findings.length === 0) {
  console.log('No suspicious mojibake patterns found.');
  process.exit(0);
}

console.error('Suspicious mojibake patterns detected:');
for (const finding of findings) {
  console.error(`${finding.filePath}:${finding.line} ${finding.text}`);
}
process.exit(1);
