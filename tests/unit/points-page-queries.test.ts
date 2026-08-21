import { describe, expect, it } from 'vitest';

import {
  applyPlan,
  planExpirationQuery,
  planLedgerQuery,
  planPolicyQuery,
  toPageWindow,
  type PointsFilterBuilder
} from '../../src/features/commerce/api/supabase-points-page-queries';
import {
  defaultPointExpirationQuery,
  defaultPointLedgerQuery,
  defaultPointPolicyQuery
} from '../../src/features/commerce/model/point-schema';
import { POINT_SORT_RANKS } from '../../src/features/commerce/model/point-enum-codec';

/**
 * 서버 페이징 조건이 **화면 조건과 같은 것을 고르는지**를 라이브 DB 없이 검사한다.
 *
 * 유일한 방법이 "호출 조건을 기록하는 가짜 빌더"다 — 실제 조회 결과를 비교할 수 없으므로
 * 무엇을 어떤 값으로 걸었는지를 본다. 특히 열거형은 **한국어 라벨이 아니라 DB 코드**로,
 * 열거형 정렬은 **정렬키 컬럼**으로 나가야 한다(그러지 않으면 순서가 화면과 갈린다).
 */
type Call = { op: string; args: unknown[] };

class FakeBuilder implements PointsFilterBuilder<FakeBuilder> {
  readonly calls: Call[] = [];

  eq(column: string, value: unknown): FakeBuilder {
    this.calls.push({ op: 'eq', args: [column, value] });
    return this;
  }

  gte(column: string, value: unknown): FakeBuilder {
    this.calls.push({ op: 'gte', args: [column, value] });
    return this;
  }

  lt(column: string, value: unknown): FakeBuilder {
    this.calls.push({ op: 'lt', args: [column, value] });
    return this;
  }

  ilike(column: string, pattern: string): FakeBuilder {
    this.calls.push({ op: 'ilike', args: [column, pattern] });
    return this;
  }

  or(filters: string): FakeBuilder {
    this.calls.push({ op: 'or', args: [filters] });
    return this;
  }
}

function record(plan: Parameters<typeof applyPlan>[1]): Call[] {
  const builder = new FakeBuilder();
  applyPlan(builder, plan);
  return builder.calls;
}

describe('toPageWindow', () => {
  it('1페이지는 0부터 시작한다', () => {
    expect(toPageWindow(1, 20)).toEqual({ from: 0, to: 19 });
  });

  it('페이지가 넘어가면 창이 이동한다', () => {
    expect(toPageWindow(3, 20)).toEqual({ from: 40, to: 59 });
    expect(toPageWindow(2, 50)).toEqual({ from: 50, to: 99 });
  });

  it('비정상 입력에서도 음수 창을 만들지 않는다', () => {
    expect(toPageWindow(0, 20)).toEqual({ from: 0, to: 19 });
    expect(toPageWindow(-3, 20)).toEqual({ from: 0, to: 19 });
    expect(toPageWindow(1, 0)).toEqual({ from: 0, to: 0 });
  });
});

describe('정책 탭 조건', () => {
  it('기본 쿼리는 조건 없이 최종 수정 내림차순이다', () => {
    const plan = planPolicyQuery(defaultPointPolicyQuery);

    expect(record(plan)).toEqual([]);
    expect(plan.order).toEqual({ column: 'updated_at', ascending: false });
  });

  it('상태·유형 필터는 한국어 라벨이 아니라 DB 코드로 나간다', () => {
    const plan = planPolicyQuery({
      ...defaultPointPolicyQuery,
      status: '운영 중',
      type: '차감'
    });

    expect(record(plan)).toEqual([
      { op: 'eq', args: ['status', 'active'] },
      { op: 'eq', args: ['policy_type', 'debit'] }
    ]);
  });

  it('열거형 정렬은 정렬키 컬럼을 쓴다 — 코드 순서로 정렬하면 화면과 갈린다', () => {
    const byStatus = planPolicyQuery({
      ...defaultPointPolicyQuery,
      sortField: 'status',
      sortOrder: 'ascend'
    });
    const byType = planPolicyQuery({
      ...defaultPointPolicyQuery,
      sortField: 'policyType',
      sortOrder: 'descend'
    });

    expect(byStatus.order).toEqual({ column: 'status_sort_rank', ascending: true });
    expect(byType.order).toEqual({ column: 'policy_type_sort_rank', ascending: false });
  });

  it('열거형이 아닌 정렬은 원래 열을 쓴다', () => {
    const plan = planPolicyQuery({
      ...defaultPointPolicyQuery,
      sortField: 'name',
      sortOrder: 'ascend'
    });

    expect(plan.order).toEqual({ column: 'name', ascending: true });
  });

  it('검색은 선택한 필드 한 곳만 본다', () => {
    expect(
      record(planPolicyQuery({ ...defaultPointPolicyQuery, keyword: '적립', searchField: 'name' }))
    ).toEqual([{ op: 'ilike', args: ['name', '%적립%'] }]);
    expect(
      record(planPolicyQuery({ ...defaultPointPolicyQuery, keyword: 'PP-1', searchField: 'id' }))
    ).toEqual([{ op: 'ilike', args: ['id', '%PP-1%'] }]);
  });

  it('공백만 있는 검색어는 조건을 만들지 않는다', () => {
    expect(record(planPolicyQuery({ ...defaultPointPolicyQuery, keyword: '   ' }))).toEqual([]);
  });

  it('검색어의 쉼표·괄호를 이스케이프한다 — or 문법이 깨지면 조건이 뒤바뀐다', () => {
    const calls = record(
      planPolicyQuery({ ...defaultPointPolicyQuery, keyword: 'a,b(c)', searchField: 'name' })
    );

    expect(calls).toEqual([{ op: 'ilike', args: ['name', '%a\\,b\\(c\\)%'] }]);
  });
});

describe('원장 탭 조건', () => {
  it('세 열거형 필터가 모두 DB 코드로 나간다', () => {
    const plan = planLedgerQuery({
      ...defaultPointLedgerQuery,
      type: '회수',
      sourceType: '환불',
      status: '보류'
    });

    expect(record(plan)).toEqual([
      { op: 'eq', args: ['entry_type', 'revoke'] },
      { op: 'eq', args: ['source_type', 'refund'] },
      { op: 'eq', args: ['status', 'held'] }
    ]);
  });

  it('기간 필터는 종료일을 포함한다 — 날짜 비교로 그 날을 잘라내지 않는다', () => {
    const plan = planLedgerQuery({
      ...defaultPointLedgerQuery,
      startDate: '2026-08-01',
      endDate: '2026-08-31'
    });

    expect(record(plan)).toEqual([
      { op: 'gte', args: ['occurred_at', '2026-08-01'] },
      { op: 'lt', args: ['occurred_at', '2026-08-31T24:00:00'] }
    ]);
  });

  it('한쪽만 지정한 기간도 그 방향만 걸린다', () => {
    expect(
      record(planLedgerQuery({ ...defaultPointLedgerQuery, startDate: '2026-08-01' }))
    ).toEqual([{ op: 'gte', args: ['occurred_at', '2026-08-01'] }]);
    expect(record(planLedgerQuery({ ...defaultPointLedgerQuery, endDate: '2026-08-31' }))).toEqual([
      { op: 'lt', args: ['occurred_at', '2026-08-31T24:00:00'] }
    ]);
  });

  it('열거형 정렬 3종이 정렬키 컬럼을 쓴다', () => {
    for (const [field, column] of [
      ['ledgerType', 'entry_type_sort_rank'],
      ['sourceType', 'source_type_sort_rank'],
      ['status', 'status_sort_rank']
    ] as const) {
      const plan = planLedgerQuery({
        ...defaultPointLedgerQuery,
        sortField: field,
        sortOrder: 'ascend'
      });
      expect(plan.order.column, field).toBe(column);
    }
  });

  it('숫자·날짜 정렬은 원래 열을 쓴다', () => {
    expect(
      planLedgerQuery({ ...defaultPointLedgerQuery, sortField: 'pointDelta', sortOrder: 'ascend' })
        .order.column
    ).toBe('amount');
    expect(
      planLedgerQuery({ ...defaultPointLedgerQuery, sortField: 'occurredAt', sortOrder: 'ascend' })
        .order.column
    ).toBe('occurred_at');
  });
});

describe('소멸 예정 탭 조건', () => {
  it('상태 필터가 DB 코드로 나간다', () => {
    expect(
      record(planExpirationQuery({ ...defaultPointExpirationQuery, status: '예정' }))
    ).toEqual([{ op: 'eq', args: ['status', 'scheduled'] }]);
  });

  it('기간은 만료일 기준이다', () => {
    const plan = planExpirationQuery({
      ...defaultPointExpirationQuery,
      startDate: '2026-09-01'
    });

    expect(record(plan)).toEqual([{ op: 'gte', args: ['expire_at', '2026-09-01'] }]);
  });

  it('정렬 필드 5종이 모두 매핑돼 있다', () => {
    for (const [field, column] of [
      ['scheduledAt', 'expire_at'],
      ['sourceType', 'source_type_sort_rank'],
      ['expiringPoint', 'scheduled_amount'],
      ['availablePoint', 'available_amount'],
      ['status', 'status_sort_rank']
    ] as const) {
      const plan = planExpirationQuery({
        ...defaultPointExpirationQuery,
        sortField: field,
        sortOrder: 'ascend'
      });
      expect(plan.order.column, field).toBe(column);
    }
  });
});

describe('정렬키 컬럼과 마이그레이션 계약', () => {
  /**
   * 🚨 정렬에 쓰는 컬럼명이 마이그레이션이 만든 컬럼과 어긋나면 조회가 런타임에 실패한다
   * (PostgREST 가 알 수 없는 열로 400 을 낸다). 계약 표와 대조해 오타를 막는다.
   */
  it('정렬에 쓰는 정렬키 컬럼이 모두 계약에 존재한다', () => {
    const declared = new Set(
      Object.keys(POINT_SORT_RANKS).map((key) => key.split('.')[1])
    );

    const used = [
      planPolicyQuery({ ...defaultPointPolicyQuery, sortField: 'status', sortOrder: 'ascend' }),
      planPolicyQuery({ ...defaultPointPolicyQuery, sortField: 'policyType', sortOrder: 'ascend' }),
      planLedgerQuery({ ...defaultPointLedgerQuery, sortField: 'ledgerType', sortOrder: 'ascend' }),
      planLedgerQuery({ ...defaultPointLedgerQuery, sortField: 'sourceType', sortOrder: 'ascend' }),
      planLedgerQuery({ ...defaultPointLedgerQuery, sortField: 'status', sortOrder: 'ascend' }),
      planExpirationQuery({
        ...defaultPointExpirationQuery,
        sortField: 'sourceType',
        sortOrder: 'ascend'
      }),
      planExpirationQuery({
        ...defaultPointExpirationQuery,
        sortField: 'status',
        sortOrder: 'ascend'
      })
    ].map((plan) => plan.order.column);

    expect(used).toHaveLength(7);
    for (const column of used) {
      expect(declared.has(column), column).toBe(true);
    }
  });
});
