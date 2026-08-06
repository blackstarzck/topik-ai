import { describe, expect, it } from 'vitest';

import { mergeInstitutionSettingsPatch } from '../../src/features/users/api/institution-contracts-service';
import type { InstitutionSettings } from '../../src/features/users/model/institution-contracts-types';

/**
 * 기관 설정 저장의 **병합 계약**을 고정한다.
 *
 * 서버 RPC(`admin_update_institution_settings`)는 정원·초대 기본값·유입 차단·담당자를
 * **전량** 받는 upsert 다. 그래서 화면이 한 필드만 고치려 해도 나머지를 그대로 실어 보내야
 * 하고, 그 pass-through 를 화면마다 손으로 하다가 **담당자 저장이 정원을 지우는** 결함이
 * 실제로 있었다(설정 미로드 상태에서 `settings?.maxMembers ?? null` 로 흘려보냈다).
 *
 * 그 병합을 한 함수로 모았으므로 여기서 두 가지를 못 박는다:
 *   1. **생략한 키는 현재 값을 유지한다**(`undefined` = 안 바꿈)
 *   2. **`null` 은 "값을 비운다"** 이고 `undefined` 와 구분된다(정원 무제한 등)
 *
 * 이 구분이 무너지면(예: `!== undefined` 를 `??` 로 바꾸면) "정원을 무제한으로 되돌리기"가
 * 조용히 무시된다. e2e 는 이 경로를 지나가지 않으므로 여기서 잡아야 한다.
 */

const CURRENT: InstitutionSettings = {
  code: 'PATCH-CONTRACT-TEST',
  maxMembers: 50,
  defaultInviteExpiryDays: 14,
  blockIntakeOnExpiry: true,
  contactName: '김담당',
  contactEmail: 'owner@example.com',
  memberCount: 10,
  pendingInvitationCount: 2,
  seatsUsed: 12,
  updatedAt: '2026-08-01 09:00:00'
};

describe('mergeInstitutionSettingsPatch', () => {
  it('담당자만 바꿔도 정원·초대 기본값·유입 차단이 살아남는다', () => {
    const payload = mergeInstitutionSettingsPatch(
      CURRENT,
      { contactName: '박담당', contactEmail: 'new@example.com' },
      '담당자만 변경'
    );

    expect(payload.contactName).toBe('박담당');
    expect(payload.contactEmail).toBe('new@example.com');
    // ↓ 이 세 줄이 원래 결함이 지우던 값들이다.
    expect(payload.maxMembers).toBe(50);
    expect(payload.defaultInviteExpiryDays).toBe(14);
    expect(payload.blockIntakeOnExpiry).toBe(true);
  });

  it('반대 방향도 성립한다 — 정원만 바꿔도 담당자가 살아남는다', () => {
    const payload = mergeInstitutionSettingsPatch(CURRENT, { maxMembers: 80 }, '정원만 변경');

    expect(payload.maxMembers).toBe(80);
    expect(payload.contactName).toBe('김담당');
    expect(payload.contactEmail).toBe('owner@example.com');
    expect(payload.defaultInviteExpiryDays).toBe(14);
    expect(payload.blockIntakeOnExpiry).toBe(true);
  });

  it('null 은 "비운다" 이고 undefined(안 바꿈)와 구분된다 — 정원 무제한 되돌리기', () => {
    const payload = mergeInstitutionSettingsPatch(CURRENT, { maxMembers: null }, '정원 무제한');

    // `??` 병합이었다면 여기서 50 이 되살아난다 — 그게 이 케이스가 잡는 회귀다.
    expect(payload.maxMembers).toBeNull();
    // 같은 호출에서 생략한 키는 그대로여야 한다.
    expect(payload.defaultInviteExpiryDays).toBe(14);
    expect(payload.contactName).toBe('김담당');
  });

  it('초대 유효기간 기본값도 null 로 비울 수 있다(전역 기본으로 되돌리기)', () => {
    const payload = mergeInstitutionSettingsPatch(
      CURRENT,
      { defaultInviteExpiryDays: null },
      '전역 기본으로'
    );

    expect(payload.defaultInviteExpiryDays).toBeNull();
    expect(payload.maxMembers).toBe(50);
  });

  it('boolean 을 false 로 끄는 것이 "안 바꿈" 으로 오해되지 않는다', () => {
    const payload = mergeInstitutionSettingsPatch(
      CURRENT,
      { blockIntakeOnExpiry: false },
      '유입 차단 해제'
    );

    // `||` 나 `??` 계열 병합이었다면 true 가 남는다.
    expect(payload.blockIntakeOnExpiry).toBe(false);
  });

  it('담당자를 빈 문자열로 지우는 것도 "안 바꿈" 과 구분된다', () => {
    const payload = mergeInstitutionSettingsPatch(
      CURRENT,
      { contactName: '', contactEmail: '' },
      '담당자 해제'
    );

    expect(payload.contactName).toBe('');
    expect(payload.contactEmail).toBe('');
    expect(payload.maxMembers).toBe(50);
  });

  it('빈 patch 는 현재 값을 그대로 돌려준다', () => {
    const payload = mergeInstitutionSettingsPatch(CURRENT, {}, '변경 없음');

    expect(payload.code).toBe(CURRENT.code);
    expect(payload.maxMembers).toBe(CURRENT.maxMembers);
    expect(payload.defaultInviteExpiryDays).toBe(CURRENT.defaultInviteExpiryDays);
    expect(payload.blockIntakeOnExpiry).toBe(CURRENT.blockIntakeOnExpiry);
    expect(payload.contactName).toBe(CURRENT.contactName);
    expect(payload.contactEmail).toBe(CURRENT.contactEmail);
  });

  it('code 는 현재 값에서 오고 사유는 그대로 실린다 — patch 가 code 를 바꿀 수 없다', () => {
    const payload = mergeInstitutionSettingsPatch(CURRENT, { maxMembers: 1 }, '사유 전달 확인');

    expect(payload.code).toBe('PATCH-CONTRACT-TEST');
    expect(payload.reason).toBe('사유 전달 확인');
  });
});
