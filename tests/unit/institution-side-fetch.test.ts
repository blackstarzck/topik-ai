import { describe, expect, it } from 'vitest';

import {
  isSideFetchActionable,
  resolveIntakeBlockNotice,
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

/**
 * 신규 유입 차단 안내가 **3갈래**임을 고정한다.
 *
 * 🚨 강제는 서버가 한다(`admin_invite_institution_members_guarded` 가 계약을 다시 확인해
 * 예외를 던진다). 그래서 화면이 "모를 때 막는" 것은 틀린 조치다 — 서버가 허용할 초대를
 * 표시 조회 실패 때문에 막는 것이 된다. 반대로 조용히 "차단 아님"으로 읽는 것도 틀렸다
 * (이전 배선이 그랬다: `contractStatus?.hasActiveContract === false` → `undefined === false`).
 */
describe('resolveIntakeBlockNotice', () => {
  const active = { kind: 'loaded' as const, row: { hasActiveContract: true } };
  const expired = { kind: 'loaded' as const, row: { hasActiveContract: false } };

  it('옵션이 꺼져 있으면 계약 상태와 무관하게 안내가 없다', () => {
    expect(resolveIntakeBlockNotice(false, expired)).toBe('none');
    expect(resolveIntakeBlockNotice(false, { kind: 'failed' })).toBe('none');
    expect(resolveIntakeBlockNotice(false, { kind: 'pending' })).toBe('none');
  });

  it('옵션 ON + 계약 무효면 확실히 차단이다', () => {
    expect(resolveIntakeBlockNotice(true, expired)).toBe('blocked');
  });

  it('옵션 ON + 계약 유효면 차단이 아니다', () => {
    expect(resolveIntakeBlockNotice(true, active)).toBe('none');
  });

  it('옵션 ON + 계약 조회 실패는 "모름" 이다 — 조용히 차단 아님으로 읽지 않는다', () => {
    expect(resolveIntakeBlockNotice(true, { kind: 'failed' })).toBe('unknown');
  });

  it('옵션 ON + 조회 중도 "모름" 이다', () => {
    expect(resolveIntakeBlockNotice(true, { kind: 'pending' })).toBe('unknown');
  });

  it('계약 0건 기관은 유효로 본다 — 아니면 옵션만 켜도 전원 차단된다', () => {
    // 도메인 규칙(PR #76): 계약을 한 번도 넣지 않은 기관은 만료로 보지 않는다.
    expect(resolveIntakeBlockNotice(true, { kind: 'missing' })).toBe('none');
  });

  it('"모름" 은 "차단" 과 다르다 — 화면이 막는 근거로 쓰면 안 된다', () => {
    expect(resolveIntakeBlockNotice(true, { kind: 'failed' })).not.toBe('blocked');
    expect(resolveIntakeBlockNotice(true, { kind: 'failed' })).not.toBe('none');
  });
});
