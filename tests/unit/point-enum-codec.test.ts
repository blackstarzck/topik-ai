import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';
import { describe, expect, it } from 'vitest';

import {
  EXPIRATION_STATUS_PAIRS,
  LEDGER_SOURCE_TYPE_PAIRS,
  LEDGER_STATUS_PAIRS,
  LEDGER_TYPE_PAIRS,
  POINT_SORT_RANKS,
  POLICY_STATUS_PAIRS,
  POLICY_TYPE_PAIRS,
  DB_LEDGER_STATUS_BY_UI,
  DB_POLICY_STATUS_BY_UI,
  POINT_ENUM_CONSTRAINTS,
  UI_LEDGER_STATUS_BY_DB,
  UI_POLICY_STATUS_BY_DB
} from '../../src/features/commerce/model/point-enum-codec';

/**
 * 포인트 화면의 필터를 **서버로 옮겨도 같은 행이 걸린다**는 근거를 고정한다.
 *
 * 화면 필터는 한국어 UI 값이고 DB 는 영어 코드다. 서버 필터(`.eq(dbCode)`)가 클라이언트
 * 필터(`=== uiValue`)와 같은 행 집합을 고르려면 두 조건이 필요하다:
 *
 * 1. 변환이 1:1 이어야 한다 → 쌍 목록 하나에서 양방향을 파생시켜 구조적으로 보장한다.
 * 2. DB 에 **그 값만** 들어갈 수 있어야 한다 → check 제약의 값 집합이 쌍 목록과 같아야 한다.
 *    같지 않으면 맵에 없는 코드가 존재할 수 있고, 그 행은 화면에서는 폴백 값으로 보이지만
 *    서버 필터에서는 빠진다(= 조용히 다른 결과).
 *
 * 🚨 그래서 이 테스트는 **마이그레이션 SQL 을 실제로 읽어** 제약과 대조한다. 제약이 나중에
 * 넓어지면(새 상태 추가) 여기서 먼저 깨진다.
 */
const MIGRATION = 'supabase/migrations-admin/20260617190000_commerce_points.sql';

function readConstraintValues(source: string, constraint: string): string[] {
  // `add constraint <name> check (<col> in ('a','b'))` 에서 값 목록만 뽑는다.
  const pattern = new RegExp(
    `add constraint ${constraint}\\s+check\\s*\\([^)]*?in\\s*\\(([^)]*)\\)`,
    'i'
  );
  const match = pattern.exec(source);
  if (!match) {
    throw new Error(`제약을 찾지 못했다: ${constraint}`);
  }
  return match[1]
    .split(',')
    .map((value) => value.trim().replace(/^'|'$/g, ''))
    .filter(Boolean);
}

describe('포인트 열거형 변환', () => {
  const source = readFileSync(join(cwd(), MIGRATION), 'utf8');

  it('양방향 맵이 1:1 이다', () => {
    for (const { constraint, pairs } of POINT_ENUM_CONSTRAINTS) {
      const dbCodes = pairs.map(([dbCode]) => dbCode);
      const uiValues = pairs.map(([, ui]) => ui);

      expect(new Set(dbCodes).size, `${constraint}: DB 코드 중복`).toBe(dbCodes.length);
      expect(new Set(uiValues).size, `${constraint}: UI 값 중복`).toBe(uiValues.length);
    }
  });

  it('DB check 제약의 값 집합이 변환 쌍과 정확히 같다', () => {
    for (const { constraint, pairs } of POINT_ENUM_CONSTRAINTS) {
      const constrained = readConstraintValues(source, constraint).sort();
      const mapped = pairs.map(([dbCode]) => dbCode).sort();

      expect(constrained, constraint).toEqual(mapped);
    }
  });

  it('제약이 닫혀 있으므로 매핑되지 않는 코드는 존재할 수 없다', () => {
    // 이 단정이 깨지면(제약이 넓어지면) 서버 필터와 화면 필터가 갈린다 —
    // 화면은 폴백 값으로 보여주고 서버는 그 행을 뺀다.
    for (const { constraint, pairs } of POINT_ENUM_CONSTRAINTS) {
      const constrained = readConstraintValues(source, constraint);
      const known = new Set(pairs.map(([dbCode]) => dbCode));
      const unmapped = constrained.filter((value) => !known.has(value));

      expect(unmapped, `${constraint}: 변환에 없는 코드`).toEqual([]);
    }
  });

  it('왕복 변환이 원값을 돌려준다', () => {
    expect(DB_POLICY_STATUS_BY_UI[UI_POLICY_STATUS_BY_DB.active]).toBe('active');
    expect(DB_LEDGER_STATUS_BY_UI[UI_LEDGER_STATUS_BY_DB.cancelled]).toBe('cancelled');
    expect(UI_POLICY_STATUS_BY_DB[DB_POLICY_STATUS_BY_UI['운영 중']]).toBe('운영 중');
  });
});

/**
 * 정렬 순위가 **SQL 과 TS 양쪽에 박혀 있다**. 어긋나면 서버 정렬이 화면 정렬과 조용히 갈리고,
 * 페이지 경계에서 행이 중복·누락된다. 그래서 세 축을 한 테스트에서 묶는다:
 *
 * 1. TS 순위 표가 화면 비교자(`localeCompare('ko-KR')`)의 실제 순서와 같은가
 * 2. SQL 생성 컬럼의 CASE 가 TS 순위 표와 같은가
 * 3. 순위가 붙은 코드 집합이 CHECK 제약과 같은가(미매핑 = 99 가 생길 수 없다)
 */
const SORT_KEY_MIGRATION =
  'supabase/migrations-admin/20260821020000_commerce_points_sort_keys.sql';

/**
 * 생성 컬럼 정의에서 `when '<코드>' then <순위>` 쌍을 뽑는다.
 *
 * 🚨 컬럼명만으로 찾으면 안 된다 — `status_sort_rank` 는 3개 테이블에,
 * `source_type_sort_rank` 는 2개 테이블에 있다. 첫 번째만 잡으면 다른 테이블의 순위와
 * 비교하게 된다(이 함수의 첫 판이 실제로 그 결함으로 실패했다). 테이블부터 스코프를 좁힌다.
 */
function readSqlSortRanks(
  source: string,
  table: string,
  column: string
): Record<string, number> {
  const anchor = `alter table public.${table}\n  add column ${column} smallint`;
  const columnStart = source.indexOf(anchor);
  if (columnStart < 0) {
    throw new Error(`생성 컬럼 정의를 찾지 못했다: ${table}.${column}`);
  }
  const columnEnd = source.indexOf('stored;', columnStart);
  const body = source.slice(columnStart, columnEnd);
  const ranks: Record<string, number> = {};
  for (const match of body.matchAll(/when\s+'([a-z_]+)'\s+then\s+(\d+)/gi)) {
    ranks[match[1]] = Number(match[2]);
  }
  return ranks;
}

/** 한국어 라벨 오름차순 → 1부터의 순위(화면 비교자 그대로). */
function expectedRanksFromLabels(pairs: readonly (readonly [string, string])[]) {
  const sorted = [...pairs].sort(([, leftUi], [, rightUi]) =>
    leftUi.localeCompare(rightUi, 'ko-KR', { numeric: true, sensitivity: 'base' })
  );
  return Object.fromEntries(sorted.map(([dbCode], index) => [dbCode, index + 1]));
}

const SORT_COLUMN_PAIRS = [
  ['commerce_point_policies.policy_type_sort_rank', POLICY_TYPE_PAIRS],
  ['commerce_point_policies.status_sort_rank', POLICY_STATUS_PAIRS],
  ['commerce_point_ledgers.entry_type_sort_rank', LEDGER_TYPE_PAIRS],
  ['commerce_point_ledgers.source_type_sort_rank', LEDGER_SOURCE_TYPE_PAIRS],
  ['commerce_point_ledgers.status_sort_rank', LEDGER_STATUS_PAIRS],
  ['commerce_point_expirations.source_type_sort_rank', LEDGER_SOURCE_TYPE_PAIRS],
  ['commerce_point_expirations.status_sort_rank', EXPIRATION_STATUS_PAIRS]
] as const;

describe('포인트 정렬 순위 계약', () => {
  const sql = readFileSync(join(cwd(), SORT_KEY_MIGRATION), 'utf8');

  it('TS 순위 표가 화면 비교자의 한국어 순서와 같다', () => {
    for (const [column, pairs] of SORT_COLUMN_PAIRS) {
      expect(POINT_SORT_RANKS[column], column).toEqual(expectedRanksFromLabels(pairs));
    }
  });

  it('SQL 생성 컬럼의 CASE 가 TS 순위 표와 같다', () => {
    for (const [column] of SORT_COLUMN_PAIRS) {
      const [table, shortName] = column.split('.');
      expect(readSqlSortRanks(sql, table, shortName), column).toEqual(
        POINT_SORT_RANKS[column]
      );
    }
  });

  it('순위가 붙은 코드 집합이 CHECK 제약과 같다 — 미매핑(99)이 생길 수 없다', () => {
    for (const [column, pairs] of SORT_COLUMN_PAIRS) {
      const ranked = Object.keys(POINT_SORT_RANKS[column]).sort();
      const mapped = pairs.map(([dbCode]) => dbCode).sort();
      expect(ranked, column).toEqual(mapped);
    }
  });

  it('7개 컬럼 전부가 계약에 들어 있다', () => {
    expect(SORT_COLUMN_PAIRS.length).toBe(7);
    expect(Object.keys(POINT_SORT_RANKS).length).toBe(7);
  });

  it('down 마이그레이션이 같은 컬럼을 모두 제거한다', () => {
    const down = readFileSync(
      join(cwd(), 'supabase/migrations-admin/down/20260821020000_commerce_points_sort_keys.sql'),
      'utf8'
    );
    for (const [column] of SORT_COLUMN_PAIRS) {
      expect(down, column).toContain(`drop column if exists ${column.split('.')[1]}`);
    }
  });
});
