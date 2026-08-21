#!/usr/bin/env node
// 디자인 토큰 → CSS 변수 브리지 생성기.
//
// `scripts/emit-design-token-css.ts` 를 vite-node 로 실행해(그래야 `@/` alias 와 antd 를
// 해석한다) 결과를 `src/styles/generated-design-tokens.css` 에 쓴다.
//
// 생성물을 **커밋한다** — 빌드 타임에만 만들면 개발·테스트 경로에서 파일이 없거나 낡은
// 상태가 될 수 있고, 리뷰에서 색 변경이 보이지 않는다. 대신 커밋본이 낡지 않도록
// `scripts/check-design-token-css-drift.mjs` 가 harness:check 에서 대조한다.

import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
export const ROOT_DIR = path.resolve(SCRIPT_DIR, '..');
export const OUTPUT_FILE = path.join(ROOT_DIR, 'src/styles/generated-design-tokens.css');
const EMITTER = path.join(SCRIPT_DIR, 'emit-design-token-css.ts');

/** 생성 결과 문자열을 얻는다(파일에 쓰지 않는다). */
export function renderGeneratedCss() {
  const viteNode = path.join(
    ROOT_DIR,
    'node_modules',
    'vite-node',
    'dist',
    'cli.mjs'
  );
  return execFileSync(process.execPath, [viteNode, EMITTER], {
    cwd: ROOT_DIR,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit']
  });
}

function main() {
  const css = renderGeneratedCss();
  writeFileSync(OUTPUT_FILE, css, 'utf8');
  const count = (css.match(/^\s*--admin-/gm) ?? []).length;
  console.log(`Generated src/styles/generated-design-tokens.css (${count} variables).`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
