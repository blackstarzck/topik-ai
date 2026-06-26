import type {
  RegistrationStatus,
  TermsConsentStatus,
  UserSummary
} from './types';

export type UserMembershipStatus =
  | '인증 대기'
  | '약관 대기'
  | '정상'
  | '정지'
  | '탈퇴';

export type TermsConsentDisplayStatus = TermsConsentStatus | '동의 불가';

type RegistrationStatusSource = Pick<
  UserSummary,
  'status' | 'emailVerificationStatus' | 'termsConsentStatus' | 'registrationStatus'
>;

const membershipStatusByRegistrationStatus: Record<RegistrationStatus, UserMembershipStatus> = {
  active: '정상',
  blocked: '정지',
  deleted: '탈퇴',
  pending_email_verification: '인증 대기',
  pending_required_consent: '약관 대기'
};

export function getUserMembershipStatus(user: RegistrationStatusSource): UserMembershipStatus {
  if (user.registrationStatus) {
    return membershipStatusByRegistrationStatus[user.registrationStatus];
  }
  if (user.status === '정지' || user.status === '탈퇴') {
    return user.status;
  }
  if (user.emailVerificationStatus === '미인증') {
    return '인증 대기';
  }
  if (user.termsConsentStatus !== '동의 완료') {
    return '약관 대기';
  }
  return '정상';
}

export function getTermsConsentDisplayStatus(
  user: Pick<UserSummary, 'emailVerificationStatus' | 'termsConsentStatus'>
): TermsConsentDisplayStatus {
  return user.emailVerificationStatus === '미인증' ? '동의 불가' : user.termsConsentStatus;
}
