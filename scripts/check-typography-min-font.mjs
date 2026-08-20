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
 * 🚨범위 한계 — 이 검사가 통과해도 "규칙 100% 충족"은 아니다. `src/**` 만 보므로 **antd 가
 * 자기 토큰으로 그리는 12px 은 잡지 못한다**. 실측(2026-08-20 프로덕션 프리뷰 computed
 * font-size 전수 감사): 우리가 쓴 값은 전부 14 이상인데 `ant-tag` 만 12px 로 남았다. 원인은
 * 전역 antd 테마에 `fontSize` 가 없어 기본 14 → 파생 `fontSizeSM` 이 12 이기 때문이고, 해소
 * 수단은 전역 `fontSize: 16`(파생 SM=14) 하나뿐인데 그러면 앱 전체 본문이 커진다 —
 * 오너 결정 대기 사항이다(gap-register §3.16).
 */
const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC_DIR = path.join(ROOT_DIR, 'src');
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
    const lines = readFileSync(absoluteFile, 'utf8').split('\n');
    const isCss = absoluteFile.endsWith('.css');

    lines.forEach((line, index) => {
      // 인라인은 숫자 리터럴(`fontSize: 12`)과 문자열(`fontSize: '12px'`) 두 표기를 모두 본다.
      const match = isCss
        ? /font-size:\s*(\d+(?:\.\d+)?)px/.exec(line)
        : /fontSize:\s*'?(\d+(?:\.\d+)?)(?:px)?'?(?=[,\s}'])/.exec(line);
      if (!match) return;
      const size = Number(match[1]);
      if (size >= MIN_FONT_PX) return;
      if (isAllowed(posixFile, lines, index)) return;
      violations.push(`${posixFile}:${index + 1}: ${match[0]} — 가시 텍스트는 ${MIN_FONT_PX}px 이상이어야 합니다.`);
    });
  }

  return violations;
}

const violations = collectViolations();

if (violations.length > 0) {
  console.error('Typography minimum font check failed.');
  for (const violation of violations) {
    console.error(`  - ${violation}`);
  }
  console.error(`  아이콘 글리프 크기라면 ${path.basename(fileURLToPath(import.meta.url))} 의 ICON_GLYPH_ALLOWLIST 에 근거와 함께 등재하세요.`);
  process.exit(1);
}

console.log(`Typography minimum font check passed (최소 ${MIN_FONT_PX}px, 아이콘 예외 ${ICON_GLYPH_ALLOWLIST.length}건).`);
