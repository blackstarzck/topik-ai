import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

/**
 * router state "저장 완료" 신호를 단일 경로로 고정한다.
 *
 * 소비는 `useRouterStateNotice`, 생산은 `routerSavedState` 로만 한다. 이 경계가 무너지면
 * 2026-08-03 에 고친 결함 두 개가 그대로 되살아난다(gap-register §3.8):
 * - `location.state` 를 직접 읽는 effect: 소비 기록이 없어 StrictMode 이중 실행으로 알림 2개
 * - state 를 지우지 않는 구현: 리마운트 재진입 시 오래된 알림 재발화(프로덕션에서도 재현)
 *
 * 검사 두 가지:
 * 1. 훅 파일 외에는 `location.state` 를 읽지 않는다.
 * 2. `navigate(..., { state })` 로 저장 신호를 실을 때 키를 인라인 리터럴로 적지 않는다
 *    (생산·소비 키 오타가 "알림 0개"로만 나타나던 침묵 경로를 막는다).
 */
const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCAN_DIR = 'src';
const CONSUMER_HOOK_FILE = 'src/shared/model/use-router-state-notice.ts';
const PRODUCER_HELPER_FILE = 'src/shared/model/router-saved-state.ts';
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx']);

function toPosix(value) {
  return value.split(path.sep).join('/');
}

function listSourceFiles(relativeDir) {
  const absoluteDir = path.join(ROOT_DIR, relativeDir);
  const files = [];

  for (const entry of readdirSync(absoluteDir, { withFileTypes: true })) {
    const relativePath = `${relativeDir}/${entry.name}`;
    if (entry.isDirectory()) {
      files.push(...listSourceFiles(relativePath));
      continue;
    }
    if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(relativePath);
    }
  }

  return files;
}

function collectViolations() {
  // RouterSavedStateMap 의 최상위 키를 전부 뽑는다. 접미사(`*Saved` 등)로 좁히면 새 키가
  // 조용히 검사에서 빠지므로 들여쓰기 2칸 + `: {` 형태로만 판별한다.
  const savedStateKeys = new Set(
    [
      ...readFileSync(path.join(ROOT_DIR, PRODUCER_HELPER_FILE), 'utf8').matchAll(
        /^ {2}([A-Za-z][A-Za-z0-9]*): \{$/gm
      )
    ].map((match) => match[1])
  );

  if (savedStateKeys.size === 0) {
    return [
      `${PRODUCER_HELPER_FILE} 에서 저장 신호 키를 찾지 못했습니다. RouterSavedStateMap 형태가 바뀌었는지 확인하세요.`
    ];
  }

  const violations = [];

  for (const file of listSourceFiles(SCAN_DIR)) {
    const source = readFileSync(path.join(ROOT_DIR, file), 'utf8');
    const posixFile = toPosix(file);

    if (posixFile !== CONSUMER_HOOK_FILE && /location\.state/.test(source)) {
      violations.push(
        `${posixFile}: \`location.state\` 를 직접 읽습니다. \`useRouterStateNotice\` 를 쓰세요 (gap-register §3.8).`
      );
    }

    if (posixFile === PRODUCER_HELPER_FILE) {
      continue;
    }

    for (const key of savedStateKeys) {
      // 생산부는 `routerSavedState('key', ...)` 로만 키를 적는다. 객체 리터럴 속성으로
      // 적으면(`state: { key: {...} }`) 소비부 키와 어긋나도 아무 게이트가 잡지 못한다.
      if (new RegExp(`(^|[^'"\\w])${key}\\s*:`, 'm').test(source)) {
        violations.push(
          `${posixFile}: 저장 신호 키 \`${key}\` 를 객체 리터럴 속성으로 적었습니다. \`routerSavedState('${key}', ...)\` 를 쓰세요.`
        );
      }
    }
  }

  return violations;
}

const violations = collectViolations();

if (violations.length > 0) {
  console.error('Router state notice boundary check failed.');
  for (const violation of violations) {
    console.error(`  - ${violation}`);
  }
  process.exit(1);
}

console.log('Router state notice boundary check passed.');
