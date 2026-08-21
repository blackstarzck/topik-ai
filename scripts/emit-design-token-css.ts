import { CSS_COLOR_VARIABLES } from '@/shared/styles/design-tokens';

/**
 * `src/styles/generated-design-tokens.css` 의 본문을 stdout 으로 낸다.
 *
 * CSS 는 TS 모듈을 import 할 수 없으므로, 디자인 토큰을 CSS 변수로 내려주는 브리지가
 * 필요하다. 이 파일은 **TS 모듈을 실제로 import 해서** 값을 얻는다(그래서 vite alias 를
 * 아는 실행기 — `vite-node` — 로 돌려야 한다. 래퍼는 `scripts/generate-design-token-css.mjs`).
 *
 * 커밋된 결과물과 이 출력이 어긋나면 `scripts/check-design-token-css-drift.mjs` 가 막는다.
 */
export function renderDesignTokenCss(): string {
  const declarations = Object.entries(CSS_COLOR_VARIABLES)
    .map(([name, value]) => `  --admin-${name}: ${value};`)
    .join('\n');

  return [
    '/* 생성 파일 — 직접 편집하지 마세요. */',
    '/* 원본: src/shared/styles/design-tokens.ts 의 CSS_COLOR_VARIABLES */',
    '/* 재생성: npm run gen:design-token-css */',
    '',
    ':root {',
    declarations,
    '}',
    ''
  ].join('\n');
}

process.stdout.write(renderDesignTokenCss());
