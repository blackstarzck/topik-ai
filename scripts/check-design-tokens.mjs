import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

/**
 * 디자인 값의 단일 소스를 기계로 지킨다(리팩토링 Phase 6).
 *
 * 규칙: 인라인 style 의 **색·간격·모서리·글자 크기**는 리터럴로 적지 않고
 * `@/shared/styles/design-tokens` 를 거친다. 그 모듈은 `src/app/theme.ts` 의 antd 테마에서
 * 값을 파생하므로, 테마를 바꾸면 화면이 따라온다 — 리터럴은 따라오지 않는다.
 *
 * 검사 대상(`src/**` 의 `.ts`/`.tsx`)
 * - 색 리터럴: `#rgb`/`#rrggbb`/`#rrggbbaa`/`rgb()`/`rgba()`
 * - 간격(`margin*`/`padding*`/`gap`/`rowGap`/`columnGap`): 숫자·`Npx` 문자열
 * - 모서리(`borderRadius`)·글자 크기(`fontSize`): 숫자 리터럴
 *
 * 예외는 아래 세 부류뿐이고 **줄이기만 한다**(max-lines baseline 과 같은 래칫).
 * 1. 데이터 시각화 팔레트 — 계열 색은 값 자체가 데이터의 의미다.
 * 2. 제3자 브랜드색 — 소셜 로그인 마크는 그쪽 브랜드 가이드가 정한다.
 * 3. mock 픽스처·HTML 문자열 — 앱 크롬이 아니라 콘텐츠다.
 *
 * 🚨범위 한계: `src/**` 만 본다. `src/styles/global.css` 의 색·크기는 아직 리터럴이고,
 * CSS 는 TS 모듈을 import 할 수 없어 CSS 변수 브리지가 선행돼야 한다(후속 작업).
 */
const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC_DIR = path.join(ROOT_DIR, 'src');
const TOKEN_MODULE = 'src/shared/styles/design-tokens.ts';
const SPACE_SCALE = new Set([0, 4, 8, 12, 16, 20, 24, 32, 48]);

/** 파일 전체를 검사에서 제외한다. 이유가 파일 성격에서 오는 경우만. */
const EXEMPT_FILES = [
  {
    file: TOKEN_MODULE,
    reason: '토큰 정의 원본 — 앱 고유값이 모이는 유일한 자리'
  },
  {
    file: 'src/app/theme.ts',
    reason: 'antd 테마 시드(colorPrimary 등) — 토큰 파생의 출발점'
  },
  {
    file: 'src/shared/ui/social-provider/social-provider-tags.tsx',
    reason: '제3자 브랜드색(카카오·구글·애플 등) — 그쪽 브랜드 가이드가 정한다'
  },
  {
    file: 'src/features/community/api/mock-community.ts',
    reason: 'mock 게시글 본문 HTML — 앱 크롬이 아니라 콘텐츠'
  }
];

/**
 * 파일 안의 특정 블록만 제외한다. snippet 을 포함한 `[-before, +after]` 줄 창에서만 통한다.
 * 배열 리터럴처럼 여러 줄에 걸치는 예외는 `after` 를 넉넉히 준다.
 */
const EXEMPT_BLOCKS = [
  {
    file: 'src/features/assessment/ui/source-data-chart.tsx',
    snippet: 'const PALETTE = [',
    before: 14,
    reason: '차트 계열 팔레트 — 색이 데이터 계열을 구분하는 의미를 가진다'
  },
  {
    file: 'src/features/assessment/ui/source-data-chart.tsx',
    snippet: 'fontSize={9}',
    reason:
      '차트 축·눈금 라벨 크기 — 14px 로 올리면 라벨이 겹친다. 차트 레이아웃 재설계가 선행돼야 하는 별도 항목(gap-register §3.17)'
  },
  {
    file: 'src/features/analytics/model/analytics-learning-page-schema.ts',
    snippet: 'export const scoreColors = [',
    reason: '점수 구간 차트 계열 색 — 데이터 의미를 가진다'
  },
  {
    file: 'src/features/analytics/model/analytics-learning-page-schema.ts',
    snippet: 'learningTypographyTheme',
    reason:
      'antd 테마 시드(페이지 단위 ConfigProvider) — 인라인 style 이 아니라 토큰 선언이다. 전역 테마와의 정합은 gap-register §3.17 항목'
  },
  {
    file: 'src/features/analytics/model/analytics-learning-page-schema.ts',
    snippet: 'pdfUsage',
    reason: 'PDF 사용 분포 차트 계열 색 — 데이터 의미를 가진다'
  },
  {
    file: 'src/features/message/pages/auth-email-panel.tsx',
    snippet: '본문이 비어 있습니다',
    reason: '미리보기 placeholder HTML 문자열 — 앱 크롬이 아니라 콘텐츠'
  },
  {
    file: 'src/features/assessment/ui/question-tag-edit-modal.tsx',
    snippet: '<RightOutlined',
    reason: '아이콘 글리프 크기 — 텍스트가 아니라 도형([[typography-min-font-rule]] 예외와 동일)'
  },
  {
    file: 'src/features/assessment/ui/question-tag-edit-modal.tsx',
    snippet: '<CheckOutlined',
    reason: '아이콘 글리프 크기 — 텍스트가 아니라 도형'
  },
  {
    file: 'src/shared/ui/table/status-column-title.tsx',
    snippet: "cursor: 'help'",
    reason: '컬럼 도움말 아이콘 래퍼 — 아이콘 크기 지정'
  }
];

const COLOR_LITERAL = /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b|\brgba?\(\s*\d/;
const SPACE_PROP = /\b(margin|padding|gap|rowGap|columnGap)[A-Za-z]*\s*:\s*(-?\d+(?:\.\d+)?)(?=[\s,}\n;)])/g;
const SPACE_STRING_PROP = /\b(margin|padding|gap|rowGap|columnGap)[A-Za-z]*\s*:\s*(['"])([^'"]*\d+px[^'"]*)\2/g;
const NUMERIC_PROP = /\b(borderRadius|fontSize)\s*:\s*(-?\d+(?:\.\d+)?)(?=[\s,}\n;)])/g;

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
    if (/\.tsx?$/.test(entry.name)) files.push(full);
  }
  return files;
}

function isBlockExempt(posixFile, lines, lineIndex) {
  return EXEMPT_BLOCKS.some((entry) => {
    if (entry.file !== posixFile) return false;
    const from = Math.max(0, lineIndex - (entry.before ?? 6));
    const to = Math.min(lines.length, lineIndex + (entry.after ?? 6) + 1);
    return lines.slice(from, to).join('\n').includes(entry.snippet);
  });
}

function collectViolations() {
  const violations = [];
  const exemptFiles = new Set(EXEMPT_FILES.map((entry) => entry.file));

  for (const absoluteFile of listFiles(SRC_DIR)) {
    const posixFile = toPosix(path.relative(ROOT_DIR, absoluteFile));
    if (exemptFiles.has(posixFile)) continue;
    const lines = readFileSync(absoluteFile, 'utf8').split('\n');

    lines.forEach((line, index) => {
      // 주석 줄은 설명이므로 대상이 아니다(게이트가 자기 설명에 걸리는 사고 방지).
      const trimmed = line.trim();
      if (trimmed.startsWith('*') || trimmed.startsWith('//')) return;
      if (isBlockExempt(posixFile, lines, index)) return;
      const at = `${posixFile}:${index + 1}`;

      const colorMatch = COLOR_LITERAL.exec(line);
      if (colorMatch) {
        violations.push(`${at}: 색 리터럴 ${colorMatch[0]} — ${TOKEN_MODULE} 의 COLOR/APP_COLOR 를 쓰세요.`);
      }

      for (const match of line.matchAll(SPACE_PROP)) {
        const value = Math.abs(Number(match[2]));
        if (SPACE_SCALE.has(value)) continue;
        violations.push(`${at}: 간격 ${match[0].trim()} — 스케일(${[...SPACE_SCALE].join('/')}) 밖입니다. SPACE 를 쓰세요.`);
      }

      for (const match of line.matchAll(SPACE_STRING_PROP)) {
        const offScale = [...match[3].matchAll(/(\d+)px/g)]
          .map((px) => Number(px[1]))
          .filter((value) => !SPACE_SCALE.has(value));
        if (offScale.length === 0) continue;
        violations.push(`${at}: 간격 '${match[3]}' 안의 ${offScale.join('/')}px — 스케일 밖입니다.`);
      }

      for (const match of line.matchAll(NUMERIC_PROP)) {
        if (Number(match[2]) === 0) continue;
        violations.push(`${at}: ${match[0].trim()} — 숫자 대신 ${TOKEN_MODULE} 의 RADIUS/FONT_SIZE/ICON_SIZE 를 쓰세요.`);
      }
    });
  }

  return violations;
}

/**
 * CSS 파일은 TS 모듈을 import 할 수 없어 전면 토큰화는 CSS 변수 브리지가 선행돼야 한다
 * (`src/styles/global.css` 에 색 리터럴이 아직 100줄 넘게 있다 — gap-register §3.17).
 * 다만 **antd 기본 파랑이 되돌아오는 것**만은 지금 막는다. 테마가 `colorLink` 를 브랜드색으로
 * 지정했는데 CSS 가 `#1677ff` 로 덮으면 antd 링크와 순수 `<a>` 링크의 색이 갈린다
 * (이 PR 에서 실제로 겪은 회귀 — 프리뷰 computed style 에서 `/users` 20개가 stock blue 였다).
 */
const ANTD_STOCK_BLUE = /#1677ff/i;

function collectCssViolations() {
  const results = [];
  const stack = [SRC_DIR];
  while (stack.length > 0) {
    const dir = stack.pop();
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
        continue;
      }
      if (!entry.name.endsWith('.css')) continue;
      const posixFile = toPosix(path.relative(ROOT_DIR, full));
      readFileSync(full, 'utf8')
        .split('\n')
        .forEach((line, index) => {
          if (!ANTD_STOCK_BLUE.test(line)) return;
          results.push(
            `${posixFile}:${index + 1}: antd 기본 파랑 #1677ff — 테마가 지정한 브랜드색을 쓰세요(링크 색이 antd 와 갈립니다).`
          );
        });
    }
  }
  return results;
}

const violations = [...collectViolations(), ...collectCssViolations()];

if (violations.length > 0) {
  console.error('Design token check failed.');
  for (const violation of violations) {
    console.error(`  - ${violation}`);
  }
  console.error(
    `  데이터 시각화 팔레트·제3자 브랜드색·mock 콘텐츠라면 ${path.basename(fileURLToPath(import.meta.url))} 의 EXEMPT_FILES/EXEMPT_BLOCKS 에 근거와 함께 등재하세요.`
  );
  process.exit(1);
}

console.log(
  `Design token check passed (파일 예외 ${EXEMPT_FILES.length}건, 블록 예외 ${EXEMPT_BLOCKS.length}건).`
);
