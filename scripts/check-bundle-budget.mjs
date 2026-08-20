import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

/**
 * 초기 페이로드(첫 화면이 실행 전에 반드시 내려받는 자산) 예산 게이트.
 *
 * 무엇을 재는가: `dist/index.html` 이 직접 참조하는 `<script type="module">` 과
 * `<link rel="stylesheet">` 만 합산한다. dynamic import 로 갈라진 청크는 첫 화면에
 * 필요 없으므로 세지 않는다 — 이 구분이 없으면 "총량은 줄었는데 첫 로드는 커진"
 * 변경(예: 지연 청크를 vendor 그룹으로 끌어오는 manualChunks)을 통과시킨다.
 *
 * 왜 필요한가: Phase 5 이전에는 계측이 없어 초기 청크가 1,244 kB 까지 커져 있었고
 * 그 안에 한 번도 요청을 보내지 않는 axios 클라이언트와, 인증 세션에서는 렌더되지
 * 않는 로그인 화면의 폼 의존성이 실려 있었다(gap-register §3.14). 게이트가 없으면
 * 같은 방식으로 조용히 되돌아간다.
 *
 * 예산 SoT 는 `package.json` 의 `bundleBudget` 키다(jscpd 임계와 같은 방식).
 * 의도적으로 늘려야 할 때만 그 값을 올리고, 올린 근거를 PR 에 남긴다.
 */
const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const INDEX_HTML = path.join(DIST_DIR, 'index.html');

function readBudget() {
  const packageJson = JSON.parse(readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf8'));
  const budget = packageJson.bundleBudget;
  if (!budget || typeof budget.initialJsBytes !== 'number' || typeof budget.initialCssBytes !== 'number') {
    throw new Error('package.json 의 bundleBudget.initialJsBytes / initialCssBytes 를 찾을 수 없습니다.');
  }
  return budget;
}

function readIndexHtml() {
  try {
    return readFileSync(INDEX_HTML, 'utf8');
  } catch {
    // 빌드 산출물이 없을 때 조용히 통과하면 "게이트 통과 ≠ 검사가 돌았다"가 된다(§3.9).
    throw new Error(`${path.relative(ROOT_DIR, INDEX_HTML)} 가 없습니다. \`npm run build\` 를 먼저 실행하세요.`);
  }
}

function collectEagerAssets(html) {
  // entry 는 `<script type="module">`, entry 가 정적 import 하는 청크는
  // `<link rel="modulepreload">` 로 나온다 — 둘 다 첫 화면 실행 전에 내려받는다.
  // modulepreload 를 빼면 vendor 를 청크로 쪼개는 것만으로 예산이 줄어 보인다.
  const scripts = [
    ...[...html.matchAll(/<script[^>]+type="module"[^>]+src="\/([^"]+)"/g)].map((match) => match[1]),
    ...[...html.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="\/([^"]+)"/g)].map(
      (match) => match[1]
    )
  ];
  const styles = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="\/([^"]+)"/g)].map(
    (match) => match[1]
  );
  return { scripts, styles };
}

function sumBytes(assetPaths) {
  const rows = assetPaths.map((assetPath) => ({
    assetPath,
    bytes: statSync(path.join(DIST_DIR, assetPath)).size
  }));
  return { rows, total: rows.reduce((sum, row) => sum + row.bytes, 0) };
}

function formatKb(bytes) {
  return `${(bytes / 1000).toFixed(2)} kB`;
}

function main() {
  const budget = readBudget();
  const { scripts, styles } = collectEagerAssets(readIndexHtml());

  if (scripts.length === 0) {
    throw new Error('index.html 에서 초기 module script 를 찾지 못했습니다. 빌드 산출물이 예상과 다릅니다.');
  }

  const js = sumBytes(scripts);
  const css = sumBytes(styles);

  console.log('초기 페이로드(dist/index.html 직접 참조):');
  for (const row of [...js.rows, ...css.rows]) {
    console.log(`  ${formatKb(row.bytes).padStart(11)}  ${row.assetPath}`);
  }
  console.log(`  JS  합계 ${formatKb(js.total)} / 예산 ${formatKb(budget.initialJsBytes)}`);
  console.log(`  CSS 합계 ${formatKb(css.total)} / 예산 ${formatKb(budget.initialCssBytes)}`);

  const failures = [];
  if (js.total > budget.initialJsBytes) {
    failures.push(
      `초기 JS ${formatKb(js.total)} > 예산 ${formatKb(budget.initialJsBytes)} (+${formatKb(js.total - budget.initialJsBytes)})`
    );
  }
  if (css.total > budget.initialCssBytes) {
    failures.push(
      `초기 CSS ${formatKb(css.total)} > 예산 ${formatKb(budget.initialCssBytes)} (+${formatKb(css.total - budget.initialCssBytes)})`
    );
  }

  if (failures.length > 0) {
    console.error('Bundle budget check failed.');
    for (const failure of failures) {
      console.error(`  - ${failure}`);
    }
    console.error(
      '  첫 화면에 필요 없는 코드가 초기 청크로 들어왔는지 먼저 확인하세요(정적 import 추가, 지연 화면의 eager import).'
    );
    console.error('  의도한 증가라면 package.json 의 bundleBudget 을 올리고 근거를 PR 에 남기세요.');
    process.exit(1);
  }

  console.log('Bundle budget check passed.');
}

try {
  main();
} catch (error) {
  console.error('Bundle budget check failed.');
  console.error(`  - ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
