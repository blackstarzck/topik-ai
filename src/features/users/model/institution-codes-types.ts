export type InstitutionCodeKind = '박람회' | '기관' | '캠페인' | '기타';
export type InstitutionCodeStatus = '활성' | '종료';

export const institutionCodeKinds: readonly InstitutionCodeKind[] = [
  '박람회',
  '기관',
  '캠페인',
  '기타'
];

export const institutionCodeStatuses: readonly InstitutionCodeStatus[] = [
  '활성',
  '종료'
];

/**
 * Users > 기관 코드(박람회/기관 유입 코드) 화면 모델. admin_list_institution_codes RPC와 1:1.
 * code 는 QR 주소에 실리는 문자열이고, v13 가입 시 profiles.affiliation_code 에 그대로 기록된다.
 */
export type InstitutionCode = {
  code: string;
  label: string;
  kind: InstitutionCodeKind;
  status: InstitutionCodeStatus;
  note: string;
  /** 이 코드를 달고 가입한 회원 수(profiles.affiliation_code 집계). v13 컬럼 적용 전에는 0. */
  memberCount: number;
  createdAt: string;
  updatedAt: string;
};

/**
 * 기관 코드 상세 > 소속 회원 행. admin_list_institution_code_members RPC와 1:1.
 * 관리자가 코드에 회원을 직접 배정/해제할 때 보여주는 최소 식별 정보.
 */
export type InstitutionCodeMember = {
  userId: string;
  realName: string;
  nickname: string;
  email: string;
  /** v13 profiles.status 를 한글로 표시(정상/정지/탈퇴). */
  status: string;
  /** 가입일(YYYY-MM-DD). */
  joinedAt: string;
};

export type InstitutionInvitationStatus = 'pending' | 'accepted' | 'declined' | 'canceled';

/** 초대 상태 한글 표시. */
export const INVITATION_STATUS_LABEL: Record<InstitutionInvitationStatus, string> = {
  pending: '대기중',
  accepted: '수락',
  declined: '거절',
  canceled: '취소'
};

/** 초대 이메일 발송 상태(notification_delivery_attempts.status 부분집합). null=attempt 없음. */
export type InvitationEmailStatus = 'pending' | 'sent' | 'failed' | 'skipped' | null;

/**
 * 기관 초대 행. admin_list_institution_invitations RPC와 1:1.
 * 관리자 '회원 추가/배정'은 즉시 배정이 아니라 pending 초대를 만들고,
 * 사용자가 v13 알림 모달에서 수락해야 profiles.affiliation_code 가 적용된다.
 * emailStatus 는 초대 안내 이메일의 발송 상태(SMTP 실패·정체를 화면에 노출).
 */
export type InstitutionInvitation = {
  invitationId: string;
  code: string;
  codeLabel: string;
  userId: string;
  email: string;
  realName: string;
  nickname: string;
  status: InstitutionInvitationStatus;
  reason: string;
  invitedByName: string;
  createdAt: string;
  respondedAt: string;
  emailStatus: InvitationEmailStatus;
  emailError: string;
  emailSentAt: string;
};

/**
 * 회원 목록 "기관 소속" 필터 센티넬. get_admin_users(affiliation) 서버 필터와 1:1.
 * '@' 는 institution_codes.code 정규식([A-Za-z0-9_-])에 들어갈 수 없어 코드 값과 충돌하지 않는다.
 * 그 외 값은 특정 코드 정확 일치로 해석된다(빈 문자열 = 전체).
 */
export const AFFILIATION_FILTER_ALL = '';
export const AFFILIATION_FILTER_AFFILIATED = '@affiliated';
export const AFFILIATION_FILTER_GENERAL = '@general';
