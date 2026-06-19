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
