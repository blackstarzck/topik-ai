import { describe, expect, it } from 'vitest';

import { maskPhone } from '../../src/features/users/model/phone-mask';

// DB private.mask_phone(SQL)과 동일 규칙(TS 미러). dev DB 프로브에서 확인한
// SQL 출력과 케이스별로 1:1 일치해야 한다 — 규칙 변경 시 양쪽을 함께 바꾼다.
describe('maskPhone (SQL private.mask_phone 미러)', () => {
  it('한국 휴대전화(하이픈/무하이픈)를 앞3-****-뒤4 로 마스킹한다', () => {
    expect(maskPhone('010-1234-5678')).toBe('010-****-5678');
    expect(maskPhone('01012345678')).toBe('010-****-5678');
  });

  it('국제 형식(+국가코드·공백)도 숫자만 추출해 동일 규칙으로 마스킹한다', () => {
    expect(maskPhone('+84 912 345 678')).toBe('849-****-5678');
  });

  it('숫자 9자리 미만(비정상 값)은 부분 노출 없이 *** 처리한다', () => {
    expect(maskPhone('1234')).toBe('***');
    expect(maskPhone('02-123-456')).toBe('***');
  });

  it('빈 값/공백/undefined 는 빈 문자열을 반환한다', () => {
    expect(maskPhone('')).toBe('');
    expect(maskPhone('   ')).toBe('');
    expect(maskPhone(null)).toBe('');
    expect(maskPhone(undefined)).toBe('');
  });
});
