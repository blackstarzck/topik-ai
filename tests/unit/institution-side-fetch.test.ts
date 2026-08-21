import { describe, expect, it } from 'vitest';

import {
  isSideFetchActionable,
  isSideFetchFailed,
  resolveSideFetchOutcome
} from '../../src/features/users/model/institution-side-fetch';

/**
 * 부가 조회 해석의 핵심 불변식: **`failed` 와 `missing` 은 절대 같은 결과가 아니다.**
 *
 * 기관 코드 화면에서 "원장에 행이 없음"은 유효한 도메인 상태다(노출 모드 = `배정분만`,
 * 계약 = `계약 없음`). 이전 배선은 조회 실패를 그 상태로 접어 넣어 **틀린 값을 정상처럼**
 * 보여줬다. e2e 로는 mock 실패를 만들 수 없으므로 여기서 숫자로 고정한다.
 */
type Row = { code: string; value: number };

const ROW: Row = { code: 'EXPO2026-BOOTH-A', value: 7 };

describe('resolveSideFetchOutcome', () => {
  it('조회 실패는 failed 다 — 행이 없다고 해석하지 않는다', () => {
    expect(resolveSideFetchOutcome('error', undefined)).toEqual({ kind: 'failed' });
    // 🚨 실패 시 직전 데이터가 남아 있어도 failed 다(값을 신뢰할 수 없다).
    expect(resolveSideFetchOutcome('error', ROW)).toEqual({ kind: 'failed' });
  });

  it('조회 중은 pending 이다', () => {
    expect(resolveSideFetchOutcome('pending', undefined)).toEqual({ kind: 'pending' });
    expect(resolveSideFetchOutcome('idle', undefined)).toEqual({ kind: 'pending' });
  });

  it('조회 성공 + 행 없음은 missing 이다 — 이때만 도메인 기본값을 쓴다', () => {
    expect(resolveSideFetchOutcome('success', undefined)).toEqual({ kind: 'missing' });
    expect(resolveSideFetchOutcome('success', null)).toEqual({ kind: 'missing' });
    // 배열 조회가 빈 결과면 훅이 'empty' 로 매핑한다 — 그것도 "조회는 됐다"다.
    expect(resolveSideFetchOutcome('empty', undefined)).toEqual({ kind: 'missing' });
  });

  it('조회 성공 + 행 있음은 loaded 다', () => {
    expect(resolveSideFetchOutcome('success', ROW)).toEqual({ kind: 'loaded', row: ROW });
  });

  it('failed 와 missing 이 같은 결과로 접히지 않는다', () => {
    const failed = resolveSideFetchOutcome('error', undefined);
    const missing = resolveSideFetchOutcome('success', undefined);

    expect(failed).not.toEqual(missing);
    expect(isSideFetchFailed(failed)).toBe(true);
    expect(isSideFetchFailed(missing)).toBe(false);
  });
});

describe('isSideFetchActionable', () => {
  it('값을 아는 두 경우에만 조작을 허용한다', () => {
    expect(isSideFetchActionable({ kind: 'loaded', row: ROW })).toBe(true);
    expect(isSideFetchActionable({ kind: 'missing' })).toBe(true);
  });

  it('값을 모르는 상태에서는 조작을 막는다', () => {
    // 계약 만료 여부를 모르는데 회원을 배정하는 것 같은 일을 막는다.
    expect(isSideFetchActionable({ kind: 'failed' })).toBe(false);
    expect(isSideFetchActionable({ kind: 'pending' })).toBe(false);
  });
});
