import { describe, expect, it } from 'vitest';

import {
  CONTRACT_DDAY_DANGER_DAYS,
  CONTRACT_DDAY_WARNING_DAYS,
  formatContractPeriod,
  resolveContractDdayLabel,
  resolveContractTone
} from '../../src/features/users/model/institution-contracts-types';

/**
 * D-day 배지의 톤·문구 결정은 목록 컬럼·상세 헤더·계약 탭이 공유하는 순수 함수다.
 * 여기서 고정하는 것은 색이 아니라 **구분**이다 — 특히 `계약 없음`(정상)과 `만료`(조치 필요)가
 * 섞이면 운영자가 계약 미등재 기관에 불필요한 계약을 만든다.
 */

function summary(over: {
  hasActiveContract?: boolean;
  daysLeft?: number | null;
  contractCount?: number;
}) {
  return {
    hasActiveContract: over.hasActiveContract ?? true,
    daysLeft: over.daysLeft ?? null,
    contractCount: over.contractCount ?? 1
  };
}

describe('resolveContractTone', () => {
  it('계약이 없으면 흐린 톤이다 — 만료와 같은 위험 톤으로 묶지 않는다', () => {
    const noContract = summary({ contractCount: 0, hasActiveContract: true });
    expect(resolveContractTone(noContract)).toBe('muted');
    // 계약 0건인데 서버가 hasActiveContract=false 를 준 경우에도 계약 수가 먼저다.
    expect(resolveContractTone(summary({ contractCount: 0, hasActiveContract: false }))).toBe(
      'muted'
    );
  });

  it('계약이 있는데 유효하지 않으면 위험 톤이다', () => {
    expect(resolveContractTone(summary({ hasActiveContract: false }))).toBe('danger');
  });

  it('무기한 계약은 기본 톤이다(남은 일수가 없다)', () => {
    expect(resolveContractTone(summary({ daysLeft: null }))).toBe('normal');
  });

  it('임계값 경계를 포함해 판정한다', () => {
    expect(resolveContractTone(summary({ daysLeft: CONTRACT_DDAY_DANGER_DAYS }))).toBe('danger');
    expect(resolveContractTone(summary({ daysLeft: CONTRACT_DDAY_DANGER_DAYS + 1 }))).toBe(
      'warning'
    );
    expect(resolveContractTone(summary({ daysLeft: CONTRACT_DDAY_WARNING_DAYS }))).toBe(
      'warning'
    );
    expect(resolveContractTone(summary({ daysLeft: CONTRACT_DDAY_WARNING_DAYS + 1 }))).toBe(
      'normal'
    );
    expect(resolveContractTone(summary({ daysLeft: 0 }))).toBe('danger');
  });
});

describe('resolveContractDdayLabel', () => {
  it('계약 없음과 만료를 다른 문구로 구분한다', () => {
    expect(resolveContractDdayLabel(summary({ contractCount: 0 }))).toBe('계약 없음');
    expect(resolveContractDdayLabel(summary({ hasActiveContract: false }))).toBe('만료');
  });

  it('무기한·당일·잔여일을 각각 표기한다', () => {
    expect(resolveContractDdayLabel(summary({ daysLeft: null }))).toBe('무기한');
    expect(resolveContractDdayLabel(summary({ daysLeft: 0 }))).toBe('D-day');
    expect(resolveContractDdayLabel(summary({ daysLeft: 12 }))).toBe('D-12');
  });
});

describe('formatContractPeriod', () => {
  it('종료일이 없으면 무기한으로 표기한다', () => {
    expect(formatContractPeriod('2026-08-01', '')).toBe('2026-08-01 ~ 무기한');
    expect(formatContractPeriod('2026-08-01', '2026-09-01')).toBe('2026-08-01 ~ 2026-09-01');
  });

  it('시작일이 없으면(유효 계약 없음) 하이픈만 돌려준다', () => {
    // 배지는 이 값을 화면에 붙이지 않는다 — `- 만료` 가 되어 잡음이 되기 때문이다.
    expect(formatContractPeriod('', '')).toBe('-');
  });
});
