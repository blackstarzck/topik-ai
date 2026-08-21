import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

/**
 * 가시 텍스트 최소 14px 규칙을 기계로 지킨다(오너 지시 2026-07-14).
 *
 * 배경: 페이지 CSS 와 인라인 style 이 antd 기본(14)보다 작은 10~13px 로 덮어써서 가독성이
 * 나빴다. 2026-07-14 에 `/analytics/learning` 한 화면만 올렸는데, 나머지 화면과 전역
 * `global.css` 에 33곳이 남아 있었다(2026-08-20 전수 치환).
 *
 * 검사 대상
 * - `src/**` 의 인라인 `fontSize: <숫자>`(px 단위 숫자 리터럴)
 * - `src/**` 의 `*.css` 의 `font-size: <숫자>px`
 *
 * 예외는 **아이콘 글리프 크기**뿐이다 — 아이콘은 텍스트가 아니라 도형이라 14 미만이 정상이다.
 * 예외는 아래 allowlist 에 파일·근거와 함께 명시하며 **줄이기만 한다**(max-lines baseline 과
 * 같은 래칫 정책). 새 예외를 추가하려면 그 값이 텍스트가 아니라는 근거가 필요하다.
 *
 * 🚨`src/**` 리터럴 스캔만으로는 부족하다 — **antd 가 자기 토큰으로 그리는 텍스트**는
 * 우리 소스에 숫자가 없다. 실측(2026-08-20 프로덕션 프리뷰 computed font-size 전수 감사)에서
 * 우리 값은 전부 14 이상인데 `ant-tag`(Tag 본문)와 `ant-switch-inner-*`(Switch 라벨)가
 * 12px 로 남았고, 원인은 antd 파생값 `fontSizeSM = fontSize(14) - 2 = 12` 였다. Badge count 나
 * 표 필터 빈 목록 문구처럼 DOM 을 훑어도 안 걸리는 표면도 같은 토큰에서 나온다.
 *
 * 그래서 이 검사는 리터럴 스캔에 더해 **테마 토큰이 소형 텍스트 기준값을 14 이상으로
 * 선언하는지**까지 본다(`src/app/theme.ts`). 토큰이 사라지면 리터럴은 깨끗한데 화면에는
 * 12px 이 되돌아오므로, 둘 중 하나만으로는 규칙을 지킬 수 없다.
 * (컴포넌트 단위로 좁히는 `components: { Tag: { fontSizeSM: 14 } }` 도 antd 가 허용하지만,
 * 파생 표면을 전수 열거해야 해서 전역 토큰 한 곳으로 뒀다.)
 */
const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC_DIR = path.join(ROOT_DIR, 'src');
const THEME_FILE = 'src/app/theme.ts';
const MIN_FONT_PX = 14;

/** 아이콘 글리프 크기 예외. 줄이기만 하고 늘리지 않는다. */
const ICON_GLYPH_ALLOWLIST = [
  {
    file: 'src/features/assessment/ui/question-tag-edit-modal.tsx',
    snippet: '<RightOutlined style={{ fontSize: 12 }} />',
    reason: '선택 표시 화살표 아이콘 — 텍스트가 아니라 도형'
  },
  {
    file: 'src/features/assessment/ui/question-tag-edit-modal.tsx',
    snippet: '<CheckOutlined style={{ fontSize: 11 }',
    reason: '칩 안 체크 아이콘 — 텍스트가 아니라 도형'
  },
  {
    file: 'src/shared/ui/table/status-column-title.tsx',
    snippet: 'cursor: \'help\'',
    reason: '컬럼 도움말 아이콘 래퍼(role=button, lineHeight 1) — 아이콘 크기 지정'
  }
];

function toPosix(value) {
  return value.split(path.sep).join('/');
}

function listFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFiles(full));
      continue;
    }
    if (/\.(ts|tsx|css)$/.test(entry.name)) files.push(full);
  }
  return files;
}

/**
 * 주석을 공백으로 덮어 **실행 코드만** 남긴다(라인 수·라인 번호는 그대로 유지).
 *
 * 🚨 이 저장소에서 반복된 함정 — 규칙을 설명하는 주석에 위반 예시(`fontSize={9}` 같은 것)를
 * 적으면 정규식이 그 예시에 매치된다. 방향에 따라 두 가지로 다 깨진다: 없는 위반을 만들거나
 * (이 검사), 진짜 선언을 지워도 주석 예시 때문에 통과한다(테마 `fontSizeSM` 검사에서 실제로
 * 겪었다). 그래서 문자열 리터럴은 남기고 주석만 지운다 — 문자열 안의 `//` 는 주석이 아니다.
 */
function stripComments(source) {
  let out = '';
  let index = 0;
  let state = 'code';
  let quote = '';

  while (index < source.length) {
    const char = source[index];
    const next = source[index + 1];

    if (state === 'code') {
      if (char === '/' && next === '/') {
        state = 'line-comment';
        out += '  ';
        index += 2;
        continue;
      }
      if (char === '/' && next === '*') {
        state = 'block-comment';
        out += '  ';
        index += 2;
        continue;
      }
      if (char === '"' || char === "'" || char === '`') {
        state = 'string';
        quote = char;
      }
      out += char;
      index += 1;
      continue;
    }

    if (state === 'string') {
      if (char === '\\') {
        out += source.slice(index, index + 2);
        index += 2;
        continue;
      }
      if (char === quote) {
        state = 'code';
        quote = '';
      }
      out += char;
      index += 1;
      continue;
    }

    // 주석 안 — 개행만 살려 라인 번호를 지킨다.
    if (char === '\n') {
      state = state === 'line-comment' ? 'code' : state;
      out += '\n';
      index += 1;
      continue;
    }
    if (state === 'block-comment' && char === '*' && next === '/') {
      state = 'code';
      out += '  ';
      index += 2;
      continue;
    }
    out += ' ';
    index += 1;
  }

  return out;
}

/** 위반 라인이 allowlist 예외에 해당하는지. 같은 파일 + snippet 포함 블록으로 판정한다. */
function isAllowed(posixFile, lines, lineIndex) {
  return ICON_GLYPH_ALLOWLIST.some((entry) => {
    if (entry.file !== posixFile) return false;
    const from = Math.max(0, lineIndex - 6);
    const to = Math.min(lines.length, lineIndex + 7);
    return lines.slice(from, to).join('\n').includes(entry.snippet);
  });
}

function collectViolations() {
  const violations = [];

  for (const absoluteFile of listFiles(SRC_DIR)) {
    const posixFile = toPosix(path.relative(ROOT_DIR, absoluteFile));
    const source = readFileSync(absoluteFile, 'utf8');
    const lines = source.split('\n');
    const isCss = absoluteFile.endsWith('.css');
    // CSS 는 `/* */` 만 쓰므로 같은 제거기로 처리된다.
    const codeLines = stripComments(source).split('\n');

    codeLines.forEach((line, index) => {
      // 인라인은 숫자 리터럴(`fontSize: 12`)과 문자열(`fontSize: '12px'`) 두 표기를 모두 본다.
      //
      // 🚨 JSX/SVG 속성형(`fontSize={9}`)은 콜론이 없어서 위 정규식이 놓쳤다 — 그래서
      // 인라인 SVG 차트의 9px 라벨 4곳이 게이트를 통과해 왔다(2026-08-20 발견). 두 표기를
      // 모두 본다. `fontSize={FONT_SIZE.base}` 처럼 식별자를 넘기는 형태는 숫자 리터럴이
      // 아니므로 걸리지 않는다.
      const match = isCss
        ? /font-size:\s*(\d+(?:\.\d+)?)px/.exec(line)
        : /fontSize:\s*'?(\d+(?:\.\d+)?)(?:px)?'?(?=[,\s}']|$)/.exec(line)
          ?? /fontSize=\{\s*(\d+(?:\.\d+)?)\s*\}/.exec(line)
          ?? /fontSize="(\d+(?:\.\d+)?)(?:px)?"/.exec(line);
      if (!match) return;
      const size = Number(match[1]);
      if (size >= MIN_FONT_PX) return;
      if (isAllowed(posixFile, lines, index)) return;
      violations.push(`${posixFile}:${index + 1}: ${match[0]} — 가시 텍스트는 ${MIN_FONT_PX}px 이상이어야 합니다.`);
    });
  }

  return violations;
}

/**
 * antd 소형 텍스트 파생 기준값(`fontSizeSM`)을 테마가 14 이상으로 선언하는지 본다.
 * 값 자체는 단위 테스트(`tests/unit/admin-theme-token.test.ts`)가 실물 import 로 확인하고,
 * 여기서는 harness:check 단독 실행에서도 선언 누락을 잡도록 소스 텍스트로 한 번 더 막는다.
 */
function collectThemeViolations() {
  const absoluteFile = path.join(ROOT_DIR, THEME_FILE);
  let source;
  try {
    source = readFileSync(absoluteFile, 'utf8');
  } catch {
    return [`${THEME_FILE}: antd 테마 토큰 파일이 없습니다 — 소형 텍스트 기준값을 선언할 곳이 필요합니다.`];
  }

  // 🚨주석에도 `fontSizeSM: 14` 예시가 들어 있어(컴포넌트 토큰 대안 설명) 주석을 먼저 걷어낸다.
  // 걷어내지 않으면 실제 선언을 지워도 주석이 매치돼 검사가 통과한다(red 검증에서 실측).
  const executable = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  const match = /fontSizeSM:\s*(?:MIN_VISIBLE_FONT_SIZE_PX|(\d+(?:\.\d+)?))/.exec(executable);
  if (!match) {
    return [
      `${THEME_FILE}: \`fontSizeSM\` 선언이 없습니다 — antd 기본 파생값 12px 이 Tag·Switch 라벨에 그대로 나갑니다.`
    ];
  }

  const declared = match[1] === undefined ? MIN_FONT_PX : Number(match[1]);
  if (declared >= MIN_FONT_PX) return [];
  return [`${THEME_FILE}: fontSizeSM ${declared} — 소형 텍스트 기준값도 ${MIN_FONT_PX}px 이상이어야 합니다.`];
}

const violations = [...collectViolations(), ...collectThemeViolations()];

if (violations.length > 0) {
  console.error('Typography minimum font check failed.');
  for (const violation of violations) {
    console.error(`  - ${violation}`);
  }
  console.error(`  아이콘 글리프 크기라면 ${path.basename(fileURLToPath(import.meta.url))} 의 ICON_GLYPH_ALLOWLIST 에 근거와 함께 등재하세요.`);
  process.exit(1);
}

console.log(
  `Typography minimum font check passed (최소 ${MIN_FONT_PX}px, 아이콘 예외 ${ICON_GLYPH_ALLOWLIST.length}건, 테마 fontSizeSM 확인).`
);
