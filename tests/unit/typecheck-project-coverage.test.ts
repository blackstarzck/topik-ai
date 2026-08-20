import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';
import { describe, expect, it } from 'vitest';

/**
 * `npm run typecheck` 가 **무엇을 검사하는지**를 고정한다.
 *
 * 이 저장소는 solution-style tsconfig(`files: []` + references)를 쓴다. 그래서 참조가
 * 빠진 코드는 아무 소리 없이 검사 대상에서 사라진다 — 실제로 그렇게 `tests/**` 가
 * 전부 빠져 있었고, 그 전에는 루트에 참조가 없어 typecheck 가 통째로 빈 통과였다
 * (PR #75). 게이트가 도는지는 위반 주입으로 확인해야 하고, 대상이 유지되는지는
 * 이 테스트가 지킨다.
 *
 * 🚨 tsconfig 는 JSONC 다(주석 허용). 여기서는 **줄 전체가 주석인 줄만** 걷어내므로
 * 설정 파일에 줄 끝 주석을 쓰면 안 된다.
 */
function readTsconfig(relative: string): Record<string, unknown> {
  const raw = readFileSync(join(cwd(), relative), 'utf8');
  const withoutComments = raw
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');

  return JSON.parse(withoutComments) as Record<string, unknown>;
}

const ROOT_PROJECTS = [
  './tsconfig.app.json',
  './tsconfig.node.json',
  './tsconfig.tests.json'
];

describe('typecheck 대상 프로젝트', () => {
  it('루트 solution 이 앱·노드·테스트 세 프로젝트를 모두 참조한다', () => {
    const root = readTsconfig('tsconfig.json');
    const references = root.references as { path: string }[];

    expect(references.map((reference) => reference.path).sort()).toEqual(
      [...ROOT_PROJECTS].sort()
    );
  });

  it('참조된 프로젝트 파일이 실제로 존재한다', () => {
    for (const project of ROOT_PROJECTS) {
      expect(existsSync(join(cwd(), project)), project).toBe(true);
    }
  });

  it('테스트 프로젝트가 tests 전체를 검사 대상으로 둔다', () => {
    const tests = readTsconfig('tsconfig.tests.json');

    expect(tests.include).toContain('tests');
  });

  it('테스트 프로젝트는 테스트가 import 하는 소스를 함께 포함한다', () => {
    // references 로 app/node 를 가리킬 수 없다 — 두 프로젝트가 noEmit 이라 TS6310.
    // 그래서 import 대상 소스를 include 에 함께 넣어야 TS6307 이 나지 않는다.
    const tests = readTsconfig('tsconfig.tests.json');
    const include = tests.include as string[];

    expect(include).toContain('src');
    expect(include).toContain('api');
    expect(include).toContain('vite.config.ts');
  });

  it('테스트 프로젝트는 브라우저·노드·vite 타입을 함께 본다', () => {
    // 테스트는 src(브라우저)와 api(서버)를 동시에 import 하고,
    // src 의 import.meta.env 접근 때문에 vite/client 가 필요하다.
    const tests = readTsconfig('tsconfig.tests.json');
    const options = tests.compilerOptions as Record<string, unknown>;

    expect(options.types).toEqual(['node', 'vite/client']);
    expect(options.strict).toBe(true);
    expect(options.composite).toBe(true);
    expect(options.noEmit).toBe(true);
  });

  it('typecheck 스크립트가 build 모드로 돌아 참조를 따라간다', () => {
    const packageJson = JSON.parse(
      readFileSync(join(cwd(), 'package.json'), 'utf8')
    ) as { scripts: Record<string, string> };

    // `tsc --noEmit` 이면 루트의 files: [] 만 보고 빈 통과한다. `-b` 여야 참조를 탄다.
    expect(packageJson.scripts.typecheck).toContain('-b');
  });
});
