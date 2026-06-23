import { describe, expect, it } from 'vitest';

import {
  AUTH_EMAIL_TYPE_LABELS,
  AUTH_EMAIL_TYPE_ORDER,
  AUTH_EMAIL_VARIABLES,
  validateAuthEmailTemplate
} from '../../src/features/message/model/auth-email-types';
import type { AuthEmailType } from '../../src/features/message/model/auth-email-types';

const CONFIRM_BODY = '<p>아래로 인증하세요 <a href="{{ .ConfirmationURL }}">인증</a></p>';

describe('AUTH_EMAIL_TYPE_ORDER / labels', () => {
  it('covers exactly the 6 GoTrue auth email types with labels and variables', () => {
    expect(AUTH_EMAIL_TYPE_ORDER).toEqual([
      'confirmation',
      'magic_link',
      'recovery',
      'email_change',
      'invite',
      'reauthentication'
    ]);
    for (const authType of AUTH_EMAIL_TYPE_ORDER) {
      expect(AUTH_EMAIL_TYPE_LABELS[authType]).toBeTruthy();
      expect(AUTH_EMAIL_VARIABLES[authType].length).toBeGreaterThan(0);
    }
  });

  it('exposes NewEmail only for email_change and omits ConfirmationURL for reauthentication', () => {
    const tokensOf = (authType: AuthEmailType): string[] =>
      AUTH_EMAIL_VARIABLES[authType].map((variable) => variable.token);

    expect(tokensOf('email_change').some((token) => token.includes('.NewEmail'))).toBe(true);
    expect(tokensOf('confirmation').some((token) => token.includes('.NewEmail'))).toBe(false);
    expect(tokensOf('reauthentication').some((token) => token.includes('.ConfirmationURL'))).toBe(false);
    expect(tokensOf('reauthentication').some((token) => token.includes('.Token'))).toBe(true);
  });
});

describe('validateAuthEmailTemplate', () => {
  it('flags empty subject and body', () => {
    const issues = validateAuthEmailTemplate('confirmation', '', '');
    expect(issues).toContain('메일 제목을 입력하세요.');
    expect(issues).toContain('본문을 입력하세요.');
  });

  it('requires an auth variable when body is present but missing one', () => {
    const issues = validateAuthEmailTemplate('confirmation', '제목', '<p>변수 없음</p>');
    expect(issues.some((issue) => issue.includes('인증 변수'))).toBe(true);
  });

  it('passes a valid confirmation template with ConfirmationURL', () => {
    expect(validateAuthEmailTemplate('confirmation', '이메일 인증', CONFIRM_BODY)).toEqual([]);
  });

  it('accepts Token/TokenHash for reauthentication (no ConfirmationURL needed)', () => {
    expect(
      validateAuthEmailTemplate('reauthentication', 'OTP', '<p>코드: {{ .Token }}</p>')
    ).toEqual([]);
  });

  it('rejects javascript: links', () => {
    const issues = validateAuthEmailTemplate(
      'confirmation',
      '제목',
      '<a href="javascript:alert(1)">{{ .ConfirmationURL }}</a>'
    );
    expect(issues.some((issue) => issue.includes('javascript:'))).toBe(true);
  });
});
