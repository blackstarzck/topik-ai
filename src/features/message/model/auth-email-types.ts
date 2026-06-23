// 인증(Supabase Auth) 메일 6종 — /messages/mail 인증 메일 탭 모델.
// 브로드캐스트(notification_*)와 분리: 발송 그룹/자동 조건 없음. GoTrue가 발송하며,
// 본 템플릿은 Management API로 Supabase Auth 내장 템플릿에 동기화된다.
// 참고: docs/plans/auth-email-template-management-plan.md

export type AuthEmailType =
  | 'confirmation'
  | 'magic_link'
  | 'recovery'
  | 'email_change'
  | 'invite'
  | 'reauthentication';

export type AuthEmailStatus = 'draft' | 'ready' | 'published' | 'archived';

export type AuthEmailSyncStatus = 'draft' | 'synced' | 'error' | 'drift' | 'conflict';

export type AuthEmailTemplate = {
  id: string;
  authType: AuthEmailType;
  subject: string;
  bodyHtml: string;
  status: AuthEmailStatus;
  syncStatus: AuthEmailSyncStatus;
  syncedAt?: string;
  syncError?: string;
  lastLiveCheckedAt?: string;
  updatedAt?: string;
};

export const AUTH_EMAIL_TYPE_ORDER: readonly AuthEmailType[] = [
  'confirmation',
  'magic_link',
  'recovery',
  'email_change',
  'invite',
  'reauthentication'
];

export const AUTH_EMAIL_TYPE_LABELS: Record<AuthEmailType, string> = {
  confirmation: '가입 인증',
  magic_link: '매직링크 로그인',
  recovery: '비밀번호 재설정',
  email_change: '이메일 변경 확인',
  invite: '초대',
  reauthentication: '재인증'
};

export const AUTH_EMAIL_TYPE_DESCRIPTIONS: Record<AuthEmailType, string> = {
  confirmation: '회원가입 시 이메일 인증 확인 메일',
  magic_link: '비밀번호 없이 링크/OTP로 로그인하는 메일',
  recovery: '비밀번호 재설정 링크 메일',
  email_change: '이메일 주소 변경 확인 메일',
  invite: '관리자 초대 가입 메일',
  reauthentication: '민감 작업 전 재인증 OTP 메일'
};

export const AUTH_EMAIL_STATUS_LABELS: Record<AuthEmailStatus, string> = {
  draft: '초안',
  ready: '준비',
  published: '게시',
  archived: '보관'
};

export const AUTH_EMAIL_SYNC_STATUS_LABELS: Record<AuthEmailSyncStatus, string> = {
  draft: '미동기화',
  synced: '동기화됨',
  error: '오류',
  drift: '드리프트',
  conflict: '충돌'
};

// antd Tag color
export const AUTH_EMAIL_SYNC_STATUS_COLORS: Record<AuthEmailSyncStatus, string> = {
  draft: 'default',
  synced: 'green',
  error: 'red',
  drift: 'orange',
  conflict: 'volcano'
};

// GoTrue Go-template 변수 (유형별). 브로드캐스트 mustache 변수와 다름.
// https://supabase.com/docs/guides/auth/auth-email-templates
export type AuthEmailVariable = { label: string; token: string };

const COMMON_VARS: AuthEmailVariable[] = [
  { label: '확인 링크', token: '{{ .ConfirmationURL }}' },
  { label: 'OTP 토큰', token: '{{ .Token }}' },
  { label: '토큰 해시', token: '{{ .TokenHash }}' },
  { label: '사이트 URL', token: '{{ .SiteURL }}' },
  { label: '리디렉트 경로', token: '{{ .RedirectTo }}' },
  { label: '이메일', token: '{{ .Email }}' }
];

export const AUTH_EMAIL_VARIABLES: Record<AuthEmailType, AuthEmailVariable[]> = {
  confirmation: COMMON_VARS,
  magic_link: COMMON_VARS,
  recovery: COMMON_VARS,
  invite: COMMON_VARS,
  reauthentication: [
    { label: 'OTP 토큰', token: '{{ .Token }}' },
    { label: '토큰 해시', token: '{{ .TokenHash }}' },
    { label: '사이트 URL', token: '{{ .SiteURL }}' },
    { label: '이메일', token: '{{ .Email }}' }
  ],
  email_change: [...COMMON_VARS, { label: '새 이메일', token: '{{ .NewEmail }}' }]
};

// 검증: 각 유형이 본문에 반드시 포함해야 하는 인증 변수(하나 이상).
const REQUIRED_ONE_OF: Record<AuthEmailType, string[]> = {
  confirmation: ['.ConfirmationURL', '.TokenHash', '.Token'],
  magic_link: ['.ConfirmationURL', '.TokenHash', '.Token'],
  recovery: ['.ConfirmationURL', '.TokenHash', '.Token'],
  invite: ['.ConfirmationURL', '.TokenHash', '.Token'],
  email_change: ['.ConfirmationURL', '.TokenHash', '.Token'],
  reauthentication: ['.Token', '.TokenHash']
};

export function validateAuthEmailTemplate(
  authType: AuthEmailType,
  subject: string,
  bodyHtml: string
): string[] {
  const issues: string[] = [];
  if (!subject.trim()) {
    issues.push('메일 제목을 입력하세요.');
  }
  if (!bodyHtml.trim()) {
    issues.push('본문을 입력하세요.');
  }
  const required = REQUIRED_ONE_OF[authType];
  const hasOne = required.some((token) => bodyHtml.includes(token));
  if (bodyHtml.trim() && !hasOne) {
    issues.push(`본문에 인증 변수(${required.join(' 또는 ')}) 중 하나가 필요합니다.`);
  }
  if (/javascript:/i.test(bodyHtml)) {
    issues.push('javascript: 링크는 사용할 수 없습니다.');
  }
  return issues;
}
