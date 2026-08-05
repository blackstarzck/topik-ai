/**
 * 기관 계약 기간과 운영 설정 화면 모델. DB 는 PR #76(`20260804100000`~`20260804100400`)에서
 * 만들었고, 이 파일은 그 RPC 반환 형태와 1:1 로 대응한다.
 *
 * 핵심 계약(DB 헤더와 같은 내용을 화면 쪽에도 남긴다 — 여기만 보고 UI 를 고치는 사람이 있다):
 * - 계약 행 하나 = 계약 한 건이고, 그 행들의 집합이 곧 히스토리다(별도 이력 테이블 없음).
 * - 같은 기관의 기간은 겹칠 수 없다(DB exclusion 제약). 겹침은 서버가 거부한다.
 * - `endsOn` 이 빈 문자열이면 무기한이다.
 * - 만료 판정은 **배정 데이터를 지우지 않는** lazy 방식이다. 계약을 연장하면 배정 행이
 *   그대로인 상태로 노출이 즉시 복구된다 — 화면에서 "복구 작업"을 안내하면 안 된다.
 * - **계약 행이 하나도 없는 기관은 유효로 본다**(만료할 계약이 없으므로). 따라서
 *   `만료 시 자동 비노출` 을 켜도 계약이 없으면 아무것도 가려지지 않는다.
 */

/** 계약 상태 — KST 오늘 기준 서버 lazy 계산값. 저장 컬럼이 아니다. */
export type InstitutionContractStatus = '예정' | '유효' | '만료';

/** admin_list_institution_contracts RPC 행. */
export type InstitutionContract = {
  contractId: string;
  code: string;
  /** YYYY-MM-DD. */
  startsOn: string;
  /** YYYY-MM-DD. 빈 문자열 = 무기한. */
  endsOn: string;
  status: InstitutionContractStatus;
  /** 계약 문서 링크. 빈 문자열 = 미입력. */
  docUrl: string;
  note: string;
  createdAt: string;
  updatedAt: string;
};

/**
 * admin_list_institution_contract_status RPC 행 — 목록·상세의 D-day 표시 데이터 소스.
 *
 * `hasActiveContract` 는 계약을 등재하지 않은 기관에서도 true 다(만료할 계약이 없다).
 * 그래서 "계약 있음"이 아니라 "지금 막힌 상태가 아님"으로 읽어야 한다 — 계약 등재 여부는
 * `contractCount` 로 판단한다.
 */
export type InstitutionContractStatusSummary = {
  code: string;
  hasActiveContract: boolean;
  /** 유효 계약의 시작일. 유효 계약이 없으면 빈 문자열. */
  activeStartsOn: string;
  /** 유효 계약의 종료일. 무기한이거나 유효 계약이 없으면 빈 문자열. */
  activeEndsOn: string;
  /** 종료일 − KST 오늘. 무기한/유효계약 없음이면 null. 음수는 서버가 만들지 않는다. */
  daysLeft: number | null;
  contractCount: number;
  autoHideOnExpiry: boolean;
  /** 옵션 ON + 계약 무효 → 지금 그 기관 학습자에게 쓰기 문항이 보이지 않는 상태. */
  writingHiddenNow: boolean;
};

/**
 * 노출 연동 옵션 2종 — admin_list_institution_exposure_options RPC 행(`20260805100000`).
 *
 * `autoAssignNewQuestions` 는 이 RPC 로만 읽을 수 있다. `20260804100100` 이 쓰기 RPC 만
 * 만들어 write-only 였고, 토글이 현재 상태를 그리려면 읽기 경로가 필요해 뒤늦게 보완했다.
 */
export type InstitutionExposureOptions = {
  code: string;
  autoHideOnExpiry: boolean;
  autoAssignNewQuestions: boolean;
};

/** admin_list_institution_settings RPC 행. 설정 행이 없는 기관도 기본값으로 반환된다. */
export type InstitutionSettings = {
  code: string;
  /** 정원. null = 무제한. */
  maxMembers: number | null;
  /** 기관별 초대 유효기간 기본값(일). null = 전역 기본 7일. */
  defaultInviteExpiryDays: number | null;
  /** 계약 만료 시 배정·초대 행정 차단. 노출을 가리는 옵션과 별개다. */
  blockIntakeOnExpiry: boolean;
  contactName: string;
  contactEmail: string;
  memberCount: number;
  /** 미만료 대기 초대 수. 만료 경과 초대는 좌석을 쓰지 않는다. */
  pendingInvitationCount: number;
  /** 소속 회원 + 미만료 대기 초대. 대기 초대도 자리를 선점한다. */
  seatsUsed: number;
  updatedAt: string;
};

/** 전역 초대 유효기간 기본값. 기관 설정이 비어 있을 때 화면이 보여줄 값(서버도 같은 값). */
export const GLOBAL_INVITE_EXPIRY_DAYS = 7;

/** 만료 임박 배지 임계값. D-7 이하 = 위험, D-30 이하 = 주의. */
export const CONTRACT_DDAY_DANGER_DAYS = 7;
export const CONTRACT_DDAY_WARNING_DAYS = 30;

export type InstitutionContractTone = 'danger' | 'warning' | 'normal' | 'muted';

/**
 * D-day 를 배지 톤으로 바꾼다. 목록 컬럼과 상세 탭이 같은 함수를 쓰게 해서 두 화면의
 * 색 기준이 갈라지지 않게 한다(구 노출 모드 라벨이 화면마다 달라 오진을 낳은 선례가 있다).
 */
export function resolveContractTone(
  summary: Pick<
    InstitutionContractStatusSummary,
    'hasActiveContract' | 'daysLeft' | 'contractCount'
  >
): InstitutionContractTone {
  if (summary.contractCount === 0) {
    return 'muted';
  }
  if (!summary.hasActiveContract) {
    return 'danger';
  }
  if (summary.daysLeft === null) {
    return 'normal';
  }
  if (summary.daysLeft <= CONTRACT_DDAY_DANGER_DAYS) {
    return 'danger';
  }
  if (summary.daysLeft <= CONTRACT_DDAY_WARNING_DAYS) {
    return 'warning';
  }
  return 'normal';
}

/**
 * 배지에 쓸 짧은 문구. `계약 없음` 과 `만료` 를 구분하는 게 중요하다 — 전자는 정상 상태이고
 * 후자는 조치가 필요한 상태다. 둘을 같은 문구로 묶으면 운영자가 계약 미등재 기관을
 * 만료로 오해해 불필요한 계약을 만든다.
 */
export function resolveContractDdayLabel(
  summary: Pick<
    InstitutionContractStatusSummary,
    'hasActiveContract' | 'daysLeft' | 'contractCount'
  >
): string {
  if (summary.contractCount === 0) {
    return '계약 없음';
  }
  if (!summary.hasActiveContract) {
    return '만료';
  }
  if (summary.daysLeft === null) {
    return '무기한';
  }
  if (summary.daysLeft === 0) {
    return 'D-day';
  }
  return `D-${summary.daysLeft}`;
}

/** 기간 표시 문자열. 무기한은 종료일 자리에 표시를 남겨 빈칸으로 보이지 않게 한다. */
export function formatContractPeriod(startsOn: string, endsOn: string): string {
  if (!startsOn) {
    return '-';
  }
  return `${startsOn} ~ ${endsOn || '무기한'}`;
}
