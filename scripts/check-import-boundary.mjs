import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

/**
 * import 경로 표기를 한 가지 규칙으로 고정한다.
 *
 * 규칙: **모듈 루트를 벗어나는 참조는 `@/` alias, 루트 안의 참조는 상대경로.**
 * 모듈 루트는 `src/features/<feature>` · `src/shared` · `src/app`(그 밖은 `src`)이다.
 *
 * 왜 이 방향인가:
 * - 루트를 벗어나는 참조를 `../../..` 로 적으면 파일을 옮길 때마다 깨지고, 몇 단계를 올라가는지
 *   세어야 어느 레이어를 참조하는지 알 수 있다. `@/shared/...` 는 옮겨도 그대로다.
 * - 반대로 같은 feature 안의 참조까지 `@/` 로 적으면 지역성이 사라져, 그 파일이 자기 feature 에
 *   속한 것을 참조하는지 남의 것을 참조하는지 한눈에 구분되지 않는다.
 *
 * 이 검사가 없으면 표기가 다시 섞인다 — 도입 시점(2026-08-20)에 상대경로 905개와 `@/` 343개가
 * 반반으로 섞여 있었고, 그 상태에서는 어느 쪽이 규칙인지 코드만 봐서는 알 수 없었다.
 */
const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC_DIR = path.join(ROOT_DIR, 'src');
const RESOLVE_EXTENSIONS = ['.ts', '.tsx', '.d.ts', '.json', '.css'];
const SPECIFIER_PATTERN = /(?:\bfrom\s*|\bimport\s*|\bimport\(\s*)(['"])([^'"]+)\1/g;

function toPosix(value) {
  return value.split(path.sep).join('/');
}

function listSourceFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listSourceFiles(full));
      continue;
    }
    if (/\.(ts|tsx)$/.test(entry.name)) files.push(full);
  }
  return files;
}

/** 그 파일이 속한 모듈 루트(절대경로). */
function moduleRootOf(absoluteFile) {
  const relative = toPosix(path.relative(SRC_DIR, absoluteFile));
  const feature = /^features\/([^/]+)\//.exec(relative);
  if (feature) return path.join(SRC_DIR, 'features', feature[1]);
  const top = /^([^/]+)\//.exec(relative);
  if (top && (top[1] === 'shared' || top[1] === 'app')) return path.join(SRC_DIR, top[1]);
  return SRC_DIR;
}

/** 확장자 없이 적힌 specifier 도 실제 파일로 확인한다. 못 찾으면 undefined(판정하지 않음). */
function resolveModulePath(absoluteTarget) {
  if (/\.(ts|tsx|css|json)$/.test(absoluteTarget) && existsSync(absoluteTarget)) {
    return absoluteTarget;
  }
  for (const extension of RESOLVE_EXTENSIONS) {
    if (existsSync(`${absoluteTarget}${extension}`)) return `${absoluteTarget}${extension}`;
  }
  for (const extension of RESOLVE_EXTENSIONS) {
    const indexPath = path.join(absoluteTarget, `index${extension}`);
    if (existsSync(indexPath)) return indexPath;
  }
  return undefined;
}

function isInside(rootDir, absolutePath) {
  return !toPosix(path.relative(rootDir, absolutePath)).startsWith('..');
}

function collectViolations() {
  const violations = [];

  for (const absoluteFile of listSourceFiles(SRC_DIR)) {
    const source = readFileSync(absoluteFile, 'utf8');
    const posixFile = toPosix(path.relative(ROOT_DIR, absoluteFile));
    const moduleRoot = moduleRootOf(absoluteFile);

    for (const match of source.matchAll(SPECIFIER_PATTERN)) {
      const specifier = match[2];
      const isRelative = specifier.startsWith('.');
      const isAlias = specifier.startsWith('@/');
      if (!isRelative && !isAlias) continue;

      const absoluteTarget = isAlias
        ? path.join(SRC_DIR, specifier.slice('@/'.length))
        : path.resolve(path.dirname(absoluteFile), specifier);
      const resolved = resolveModulePath(absoluteTarget);
      if (!resolved) continue;

      const insideOwnRoot = isInside(moduleRoot, resolved);
      const rootLabel = toPosix(path.relative(ROOT_DIR, moduleRoot));

      if (isRelative && !insideOwnRoot) {
        violations.push(
          `${posixFile}: \`${specifier}\` 가 모듈 루트 \`${rootLabel}\` 를 벗어납니다. \`@/${toPosix(path.relative(SRC_DIR, absoluteTarget))}\` 로 적으세요.`
        );
      } else if (isAlias && insideOwnRoot) {
        violations.push(
          `${posixFile}: \`${specifier}\` 는 같은 모듈 루트 \`${rootLabel}\` 안입니다. 상대경로로 적으세요.`
        );
      }
    }
  }

  return violations;
}

const violations = collectViolations();

if (violations.length > 0) {
  console.error('Import boundary check failed.');
  for (const violation of violations) {
    console.error(`  - ${violation}`);
  }
  console.error('  규칙: 모듈 루트를 벗어나면 `@/`, 루트 안이면 상대경로.');
  process.exit(1);
}

console.log('Import boundary check passed.');
