import {
  DB_EXPIRATION_STATUS_BY_UI,
  DB_LEDGER_SOURCE_TYPE_BY_UI,
  DB_LEDGER_STATUS_BY_UI,
  DB_LEDGER_TYPE_BY_UI,
  DB_POLICY_STATUS_BY_UI,
  DB_POLICY_TYPE_BY_UI
} from '../model/point-enum-codec';
import type {
  PointExpirationQuery,
  PointExpirationSortField,
  PointLedgerQuery,
  PointLedgerSortField,
  PointPolicyQuery,
  PointPolicySortField,
  PointSortOrder
} from '../model/point-types';

/**
 * 화면 쿼리를 PostgREST 조건으로 옮긴다.
 *
 * 🔑 필터가 동등한 근거: UI 라벨 ↔ DB 코드 변환이 1:1 이고, DB CHECK 제약의 값 집합이 그
 * 변환과 정확히 일치한다(`tests/unit/point-enum-codec.test.ts` 가 마이그레이션 SQL 을 읽어
 * 고정). 제약이 닫혀 있으니 변환에 없는 코드는 존재할 수 없고, 따라서 `.eq(코드)` 는 화면의
 * `=== 라벨` 과 같은 행 집합을 고른다.
 *
 * 🔑 정렬이 동등한 근거: 열거형 열은 화면이 **한국어 라벨**로 정렬하는데 열에는 영어 코드가
 * 들어 있어 그대로는 순서가 다르다. 그래서 마이그레이션
 * `20260821020000_commerce_points_sort_keys.sql` 이 한국어 오름차순을 숫자로 고정한 생성
 * 컬럼 7개를 제공하고, 여기서는 그 컬럼으로 정렬한다.
 */

/** 정렬 방향. antd 의 `null` 은 "정렬 없음"이다. */
function isAscending(order: PointSortOrder): boolean {
  return order !== 'descend';
}

/** 화면 검색 필드 → 검색 대상 DB 열. */
type SearchColumns = Record<string, readonly string[]>;

/**
 * 이 모듈이 쓰는 PostgREST 연산만 구조적으로 요구한다.
 *
 * 라이브러리의 `PostgrestFilterBuilder` 제네릭(타입 인자 4~7개)에 묶이면 시그니처가 버전에
 * 따라 흔들리고, 무엇보다 **가짜 빌더로 호출 조건을 검사할 수 없다**. 라이브 DB 없이
 * 동등성을 확인할 유일한 방법이 그 검사이므로 최소 인터페이스로 받는다.
 */
export type PointsFilterBuilder<TSelf> = {
  eq(column: string, value: unknown): TSelf;
  gte(column: string, value: unknown): TSelf;
  lt(column: string, value: unknown): TSelf;
  ilike(column: string, pattern: string): TSelf;
  or(filters: string): TSelf;
};

/** 조회 결과의 최소 모양(행·전체 건수·오류). */
export type PointsQueryResponse = {
  data: unknown[] | null;
  count: number | null;
  error: { message: string } | null;
};

/**
 * 필터 + 정렬 + 페이지 창까지 이어지는 조회 체인.
 *
 * 🚨 PostgREST 빌더 타입을 제네릭으로 통과시키면 `TS2589: Type instantiation is excessively
 * deep` 가 난다(라이브러리 제네릭이 타입 인자 7개로 재귀한다). 그래서 **경계에서 한 번만**
 * 이 인터페이스로 단언하고, 이후 체인은 전부 우리 타입으로 다룬다.
 */
// 🚨 type alias 로 쓰면 자기 참조가 즉시 해석돼 TS2456 이 난다 — interface 는 지연 해석된다.
export interface PointsQueryChain extends PointsFilterBuilder<PointsQueryChain> {
  order(column: string, options: { ascending: boolean }): PointsQueryChain;
  range(from: number, to: number): PromiseLike<PointsQueryResponse>;
}

function applyKeyword<TBuilder extends PointsFilterBuilder<TBuilder>>(
  builder: TBuilder,
  keyword: string,
  searchField: string,
  columns: SearchColumns
): TBuilder {
  const trimmed = keyword.trim();
  if (!trimmed) {
    return builder;
  }

  const targets = columns[searchField];
  if (!targets || targets.length === 0) {
    throw new Error(`포인트 검색 필드에 대응하는 열이 없습니다: ${searchField}`);
  }

  // PostgREST 의 `or` 는 쉼표로 조건을 나누므로 값 안의 쉼표·괄호를 이스케이프해야 한다.
  const escaped = trimmed.replace(/[(),]/g, (match) => `\\${match}`);
  if (targets.length === 1) {
    return builder.ilike(targets[0], `%${escaped}%`);
  }
  return builder.or(
    targets.map((column) => `${column}.ilike.%${escaped}%`).join(',')
  );
}

function applyDateRange<TBuilder extends PointsFilterBuilder<TBuilder>>(
  builder: TBuilder,
  column: string,
  startDate: string,
  endDate: string
): TBuilder {
  let next = builder;
  if (startDate) {
    next = next.gte(column, startDate);
  }
  if (endDate) {
    // 화면의 기간 필터는 종료일을 **포함**한다(`matchesSearchDateRange`). 날짜 문자열로
    // 비교하면 그 날 00:00 이후가 빠지므로 다음 날 0시 미만으로 잡는다.
    next = next.lt(column, `${endDate}T24:00:00`);
  }
  return next;
}

/**
 * 🚨 이 화면의 검색 필드에는 `all` 이 없다 — 파서가 단일 필드로 좁힌다
 * (`PointPolicySearchField = 'name' | 'id'` 등). 그래서 or 묶음 분기는 두지 않는다.
 * 여기 없는 필드가 들어오면 조용히 넘기지 않고 즉시 드러나야 한다.
 */
const POLICY_SEARCH_COLUMNS: SearchColumns = {
  name: ['name'],
  id: ['id']
};

const LEDGER_SEARCH_COLUMNS: SearchColumns = {
  userId: ['user_id'],
  userName: ['user_name'],
  id: ['id']
};

const EXPIRATION_SEARCH_COLUMNS: SearchColumns = {
  userId: ['user_id'],
  userName: ['user_name'],
  id: ['id']
};

/** 화면 정렬 필드 → DB 열. 열거형은 정렬키 생성 컬럼을 쓴다. */
const POLICY_SORT_COLUMNS: Record<PointPolicySortField, string> = {
  name: 'name',
  policyType: 'policy_type_sort_rank',
  status: 'status_sort_rank',
  updatedAt: 'updated_at'
};

const LEDGER_SORT_COLUMNS: Record<PointLedgerSortField, string> = {
  occurredAt: 'occurred_at',
  ledgerType: 'entry_type_sort_rank',
  sourceType: 'source_type_sort_rank',
  pointDelta: 'amount',
  expirationAt: 'expiration_at',
  status: 'status_sort_rank'
};

const EXPIRATION_SORT_COLUMNS: Record<PointExpirationSortField, string> = {
  scheduledAt: 'expire_at',
  sourceType: 'source_type_sort_rank',
  expiringPoint: 'scheduled_amount',
  availablePoint: 'available_amount',
  status: 'status_sort_rank'
};

/** 정렬이 지정되지 않았을 때의 기본 순서(기존 전량 조회와 같다). */
const DEFAULT_ORDER = {
  policy: { column: 'updated_at', ascending: false },
  ledger: { column: 'occurred_at', ascending: false },
  expiration: { column: 'expire_at', ascending: true }
} as const;

export type PageWindow = { from: number; to: number };

export function toPageWindow(page: number, pageSize: number): PageWindow {
  const safePage = Math.max(1, Math.floor(page));
  const safeSize = Math.max(1, Math.floor(pageSize));
  const from = (safePage - 1) * safeSize;
  return { from, to: from + safeSize - 1 };
}

export type PolicyQueryPlan = {
  eq: Record<string, string>;
  keyword: { field: string; value: string; columns: SearchColumns };
  order: { column: string; ascending: boolean };
  window: PageWindow;
};

/**
 * 정책 탭 조건. 순수 함수로 두어 **호출 조건을 테스트로 검사**할 수 있게 한다
 * (라이브 DB 없이 동등성을 확인하는 유일한 방법이다).
 */
export function planPolicyQuery(query: PointPolicyQuery): PolicyQueryPlan {
  const eq: Record<string, string> = {};
  if (query.status !== 'all') {
    eq.status = DB_POLICY_STATUS_BY_UI[query.status];
  }
  if (query.type !== 'all') {
    eq.policy_type = DB_POLICY_TYPE_BY_UI[query.type];
  }

  const order =
    query.sortField && query.sortOrder
      ? {
          column: POLICY_SORT_COLUMNS[query.sortField],
          ascending: isAscending(query.sortOrder)
        }
      : { ...DEFAULT_ORDER.policy };

  return {
    eq,
    keyword: { field: query.searchField, value: query.keyword, columns: POLICY_SEARCH_COLUMNS },
    order,
    window: toPageWindow(query.page, query.pageSize)
  };
}

export type LedgerQueryPlan = PolicyQueryPlan & {
  dateRange: { column: string; startDate: string; endDate: string };
};

export function planLedgerQuery(query: PointLedgerQuery): LedgerQueryPlan {
  const eq: Record<string, string> = {};
  if (query.type !== 'all') {
    eq.entry_type = DB_LEDGER_TYPE_BY_UI[query.type];
  }
  if (query.sourceType !== 'all') {
    eq.source_type = DB_LEDGER_SOURCE_TYPE_BY_UI[query.sourceType];
  }
  if (query.status !== 'all') {
    eq.status = DB_LEDGER_STATUS_BY_UI[query.status];
  }

  const order =
    query.sortField && query.sortOrder
      ? {
          column: LEDGER_SORT_COLUMNS[query.sortField],
          ascending: isAscending(query.sortOrder)
        }
      : { ...DEFAULT_ORDER.ledger };

  return {
    eq,
    keyword: { field: query.searchField, value: query.keyword, columns: LEDGER_SEARCH_COLUMNS },
    dateRange: {
      column: 'occurred_at',
      startDate: query.startDate,
      endDate: query.endDate
    },
    order,
    window: toPageWindow(query.page, query.pageSize)
  };
}

export function planExpirationQuery(query: PointExpirationQuery): LedgerQueryPlan {
  const eq: Record<string, string> = {};
  if (query.status !== 'all') {
    eq.status = DB_EXPIRATION_STATUS_BY_UI[query.status];
  }

  const order =
    query.sortField && query.sortOrder
      ? {
          column: EXPIRATION_SORT_COLUMNS[query.sortField],
          ascending: isAscending(query.sortOrder)
        }
      : { ...DEFAULT_ORDER.expiration };

  return {
    eq,
    keyword: {
      field: query.searchField,
      value: query.keyword,
      columns: EXPIRATION_SEARCH_COLUMNS
    },
    dateRange: {
      column: 'expire_at',
      startDate: query.startDate,
      endDate: query.endDate
    },
    order,
    window: toPageWindow(query.page, query.pageSize)
  };
}

/** 계획을 실제 PostgREST 빌더에 적용한다. */
export function applyPlan<TBuilder extends PointsFilterBuilder<TBuilder>>(
  builder: TBuilder,
  plan: PolicyQueryPlan | LedgerQueryPlan
): TBuilder {
  let next = builder;
  for (const [column, value] of Object.entries(plan.eq)) {
    next = next.eq(column, value);
  }
  if ('dateRange' in plan) {
    next = applyDateRange(
      next,
      plan.dateRange.column,
      plan.dateRange.startDate,
      plan.dateRange.endDate
    );
  }
  next = applyKeyword(next, plan.keyword.value, plan.keyword.field, plan.keyword.columns);
  return next;
}
