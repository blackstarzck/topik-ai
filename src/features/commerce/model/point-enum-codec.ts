import type {
  PointExpirationStatus,
  PointLedgerSourceType,
  PointLedgerStatus,
  PointLedgerType,
  PointPolicyStatus,
  PointPolicyType
} from './point-types';

/**
 * 포인트 화면의 UI 값 ↔ DB 코드 변환.
 *
 * 지금까지 이 변환은 Supabase 어댑터 안에 **한 방향씩 흩어져** 있었다(정책은 양방향, 원장·소멸은
 * DB→UI 만). 그래서 필터를 서버로 옮기려면 없는 방향을 새로 만들어야 했고, 두 맵이 어긋나도
 * 아무 것도 막지 않았다.
 *
 * 여기서는 **쌍 목록 하나**를 원본으로 두고 양방향 맵을 파생시킨다 — 구조적으로 1:1 이 보장된다.
 *
 * 🔑 서버 필터가 클라이언트 필터와 동등한 근거: DB 에 check 제약이 있고 그 값 집합이 아래 쌍
 * 목록과 정확히 일치한다(`supabase/migrations-admin/20260617190000_commerce_points.sql`).
 * 제약이 닫혀 있으므로 맵에 없는 코드는 존재할 수 없고, 따라서 `.eq(dbCode)` 는 화면의
 * `=== uiValue` 와 같은 행 집합을 고른다. 이 일치는
 * `tests/unit/point-enum-codec.test.ts` 가 마이그레이션 SQL 을 읽어 고정한다.
 */
type Pair<TUi extends string> = readonly (readonly [dbCode: string, ui: TUi])[];

function toUiByDb<TUi extends string>(pairs: Pair<TUi>): Record<string, TUi> {
  return Object.fromEntries(pairs) as Record<string, TUi>;
}

function toDbByUi<TUi extends string>(pairs: Pair<TUi>): Record<TUi, string> {
  return Object.fromEntries(pairs.map(([dbCode, ui]) => [ui, dbCode])) as Record<TUi, string>;
}

export const POLICY_STATUS_PAIRS: Pair<PointPolicyStatus> = [
  ['draft', '초안'],
  ['active', '운영 중'],
  ['inactive', '중지']
] as const;

export const POLICY_TYPE_PAIRS: Pair<PointPolicyType> = [
  ['earn', '적립'],
  ['debit', '차감'],
  ['expire', '소멸']
] as const;

export const LEDGER_TYPE_PAIRS: Pair<PointLedgerType> = [
  ['earn', '적립'],
  ['debit', '차감'],
  ['revoke', '회수'],
  ['restore', '복구'],
  ['expire', '소멸']
] as const;

export const LEDGER_SOURCE_TYPE_PAIRS: Pair<PointLedgerSourceType> = [
  ['referral', '추천'],
  ['mission', '미션'],
  ['event', '이벤트'],
  ['payment', '결제'],
  ['refund', '환불'],
  ['admin', '관리자'],
  ['system', '시스템']
] as const;

export const LEDGER_STATUS_PAIRS: Pair<PointLedgerStatus> = [
  ['completed', '완료'],
  ['held', '보류'],
  ['cancelled', '취소']
] as const;

export const EXPIRATION_STATUS_PAIRS: Pair<PointExpirationStatus> = [
  ['scheduled', '예정'],
  ['held', '보류'],
  ['completed', '완료'],
  ['cancelled', '취소']
] as const;

export const UI_POLICY_STATUS_BY_DB = toUiByDb(POLICY_STATUS_PAIRS);
export const DB_POLICY_STATUS_BY_UI = toDbByUi(POLICY_STATUS_PAIRS);
export const UI_POLICY_TYPE_BY_DB = toUiByDb(POLICY_TYPE_PAIRS);
export const DB_POLICY_TYPE_BY_UI = toDbByUi(POLICY_TYPE_PAIRS);
export const UI_LEDGER_TYPE_BY_DB = toUiByDb(LEDGER_TYPE_PAIRS);
export const DB_LEDGER_TYPE_BY_UI = toDbByUi(LEDGER_TYPE_PAIRS);
export const UI_LEDGER_SOURCE_TYPE_BY_DB = toUiByDb(LEDGER_SOURCE_TYPE_PAIRS);
export const DB_LEDGER_SOURCE_TYPE_BY_UI = toDbByUi(LEDGER_SOURCE_TYPE_PAIRS);
export const UI_LEDGER_STATUS_BY_DB = toUiByDb(LEDGER_STATUS_PAIRS);
export const DB_LEDGER_STATUS_BY_UI = toDbByUi(LEDGER_STATUS_PAIRS);
export const UI_EXPIRATION_STATUS_BY_DB = toUiByDb(EXPIRATION_STATUS_PAIRS);
export const DB_EXPIRATION_STATUS_BY_UI = toDbByUi(EXPIRATION_STATUS_PAIRS);

/** 마이그레이션의 check 제약과 대조할 목록(테스트가 쓴다). */
export const POINT_ENUM_CONSTRAINTS = [
  {
    constraint: 'commerce_point_policies_status_check',
    pairs: POLICY_STATUS_PAIRS
  },
  {
    constraint: 'commerce_point_ledgers_entry_type_check',
    pairs: LEDGER_TYPE_PAIRS
  },
  {
    constraint: 'commerce_point_ledgers_source_type_check',
    pairs: LEDGER_SOURCE_TYPE_PAIRS
  },
  {
    constraint: 'commerce_point_ledgers_status_check',
    pairs: LEDGER_STATUS_PAIRS
  },
  {
    constraint: 'commerce_point_expirations_status_check',
    pairs: EXPIRATION_STATUS_PAIRS
  },
  {
    constraint: 'commerce_point_expirations_source_type_check',
    pairs: LEDGER_SOURCE_TYPE_PAIRS
  }
] as const;

/**
 * 한국어 라벨 오름차순을 숫자 순위로 고정한 표.
 *
 * 🚨 이 순위는 **SQL 에도 박혀 있다**(`supabase/migrations-admin/20260821020000_commerce_points_sort_keys.sql`
 * 의 생성 컬럼 CASE). 두 곳이 어긋나면 서버 정렬이 화면 정렬과 조용히 갈리므로,
 * `tests/unit/point-enum-codec.test.ts` 가 SQL 을 읽어 이 표와 대조한다.
 *
 * 값의 근거: 화면 비교자 `localeCompare(v, 'ko-KR', { numeric: true, sensitivity: 'base' })`
 * 실측 결과다. 라벨을 바꾸면 순서가 바뀔 수 있으니 **라벨 변경 시 이 표와 SQL 을 같이** 고친다.
 */
export const POINT_SORT_RANKS = {
  'commerce_point_policies.policy_type_sort_rank': {
    expire: 1,
    earn: 2,
    debit: 3
  },
  'commerce_point_policies.status_sort_rank': {
    active: 1,
    inactive: 2,
    draft: 3
  },
  'commerce_point_ledgers.entry_type_sort_rank': {
    restore: 1,
    expire: 2,
    earn: 3,
    debit: 4,
    revoke: 5
  },
  'commerce_point_ledgers.source_type_sort_rank': {
    payment: 1,
    admin: 2,
    mission: 3,
    system: 4,
    event: 5,
    referral: 6,
    refund: 7
  },
  'commerce_point_ledgers.status_sort_rank': {
    held: 1,
    completed: 2,
    cancelled: 3
  },
  'commerce_point_expirations.source_type_sort_rank': {
    payment: 1,
    admin: 2,
    mission: 3,
    system: 4,
    event: 5,
    referral: 6,
    refund: 7
  },
  'commerce_point_expirations.status_sort_rank': {
    held: 1,
    scheduled: 2,
    completed: 3,
    cancelled: 4
  }
} as const satisfies Record<string, Record<string, number>>;
