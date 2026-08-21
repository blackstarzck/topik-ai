import type {
  PointExpirationQuery,
  PointLedgerQuery,
  PointPolicyQuery
} from './point-types';

/**
 * 포인트 화면 서버 페이징 계약.
 *
 * 이전에는 세 탭 전량을 한 번에 받아 화면에서 필터·정렬·페이징했다. 원장은 포인트 이벤트마다
 * 행이 늘어나는 표라 전량 조회는 커질 수밖에 없고, 요약·건수·정렬이 모두 클라이언트 계산이라
 * 서버로 옮길 때 무엇이 동등하고 무엇이 아닌지가 불분명했다(gap-register §3.18).
 *
 * 계약을 두 갈래로 나눈다:
 *
 * 1. **개요**(`PointsOverview`) — 쿼리와 무관한 수치. 탭 라벨의 전체 건수와 요약 카드의
 *    상태별 건수다. 요약 카드는 상태 **필터** 역할이므로 필터를 적용하면 자기 자신이 0 이
 *    되어 버린다 → 필터 무관 전체 기준으로 센다(지금 화면과 같은 의미).
 * 2. **페이지**(`PointsPageSlice`) — 활성 탭의 현재 페이지 행 + **필터 적용 후 전체 건수**.
 *    툴바의 `총 N건`, 페이지네이션 총량, 소멸 예정 내보내기 건수가 모두 이 값을 쓴다.
 */
export type PointsPageSlice<T> = {
  rows: T[];
  /** 필터 적용 후 전체 건수(현재 페이지 길이가 아니다). */
  total: number;
};

/** 상태 라벨(한국어) → 건수. `all` 은 탭 전체. */
export type PointsStatusCounts = Record<string, number>;

export type PointsOverview = {
  tabCounts: {
    policy: number;
    ledger: number;
    expiration: number;
  };
  policyStatusCounts: PointsStatusCounts;
  ledgerStatusCounts: PointsStatusCounts;
  expirationStatusCounts: PointsStatusCounts;
};

export function createEmptyPointsOverview(): PointsOverview {
  return {
    tabCounts: { policy: 0, ledger: 0, expiration: 0 },
    policyStatusCounts: {},
    ledgerStatusCounts: {},
    expirationStatusCounts: {}
  };
}

export function createEmptyPointsPageSlice<T>(): PointsPageSlice<T> {
  return { rows: [], total: 0 };
}

/**
 * 정렬 동률 처리 규칙.
 *
 * 🚨 서버 페이징에서 **동률의 상대 순서를 고정하지 않으면 페이지 경계에서 행이 중복·누락**된다
 * (같은 순위 행들이 페이지마다 다른 순서로 나올 수 있다). 열거형 정렬키는 값이 3~7종뿐이라
 * 동률이 흔하므로, 모든 정렬에 `id` 를 후속 키로 붙인다.
 */
export const POINTS_SORT_TIE_BREAKER = 'id' as const;

export type PointsQueryByTab = {
  policy: PointPolicyQuery;
  ledger: PointLedgerQuery;
  expiration: PointExpirationQuery;
};
