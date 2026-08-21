#!/usr/bin/env node
// 커밋된 CSS 변수 브리지가 디자인 토큰과 어긋나지 않는지 본다.
//
// 생성물을 커밋하는 방식의 유일한 위험은 **커밋본이 낡는 것**이다(토큰을 바꾸고 재생성을
// 잊으면 CSS 는 이전 색을 계속 쓴다). 그래서 생성기를 다시 돌려 커밋본과 대조한다.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { OUTPUT_FILE, ROOT_DIR, renderGeneratedCss } from './generate-design-token-css.mjs';

function main() {
  const expected = renderGeneratedCss();
  let actual;
  try {
    actual = readFileSync(OUTPUT_FILE, 'utf8');
  } catch {
    console.error(
      `Design token CSS drift check failed: ${path.relative(ROOT_DIR, OUTPUT_FILE)} 가 없습니다.`
    );
    console.error('  npm run gen:design-token-css 로 생성한 뒤 커밋하세요.');
    process.exit(1);
  }

  if (actual === expected) {
    const count = (expected.match(/^\s*--admin-/gm) ?? []).length;
    console.log(`Design token CSS drift check passed (변수 ${count}개).`);
    return;
  }

  const expectedLines = expected.split('\n');
  const actualLines = actual.split('\n');
  const diffs = [];
  for (let index = 0; index < Math.max(expectedLines.length, actualLines.length); index += 1) {
    if (expectedLines[index] !== actualLines[index]) {
      diffs.push(
        `  ${index + 1}행\n    커밋본: ${actualLines[index] ?? '(없음)'}\n    생성본: ${expectedLines[index] ?? '(없음)'}`
      );
    }
    if (diffs.length >= 10) break;
  }

  console.error('Design token CSS drift check failed — 커밋된 생성물이 디자인 토큰과 다릅니다.');
  console.error(diffs.join('\n'));
  console.error('  npm run gen:design-token-css 로 재생성한 뒤 커밋하세요.');
  process.exit(1);
}

main();
