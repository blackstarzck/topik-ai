import type {
  InstitutionContract,
  InstitutionContractStatus,
  InstitutionContractStatusSummary,
  InstitutionExposureOptions,
  InstitutionSettings
} from '../model/institution-contracts-types';

/**
 * 기관 계약·설정 mock 원장(Supabase 미구성/e2e 경로).
 *
 * 이 파일의 목적은 "화면이 뭔가 그린다"가 아니라 **DB 계약을 mock 에서도 성립시키는 것**이다.
 * 그래야 e2e 가 실제 규칙(겹침 거부·만료 시 비노출·연장 시 즉시 복구·lazy 판정)을 증명한다.
 * 다음 4가지를 DB 와 같은 방향으로 구현한다:
 *
 * 1. 같은 기관의 계약 기간은 **겹칠 수 없다**(DB exclusion 제약과 같은 판정).
 * 2. 만료 판정은 lazy 다 — 계약을 고치면 배정 데이터는 건드리지 않고 판정만 바뀐다.
 * 3. **계약 행이 하나도 없는 기관은 유효**로 본다(만료할 계약이 없다).
 * 4. 코드를 지우면 계약·설정·옵션도 함께 사라진다(재생성 시 부활 금지).
 *
 * 날짜는 절대값이 아니라 오늘 기준 상대값으로 시드한다. 절대값을 박아두면 시간이 지나
 * 시드가 전부 `만료` 로 바뀌어 D-day 배지 e2e 가 조용히 다른 것을 검증하게 된다.
 */

function shiftDays(days: number): string {
  const now = new Date();
  now.setDate(now.getDate() + days);
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function todayText(): string {
  return shiftDays(0);
}

/** 두 기간이 겹치는가(양끝 포함, 빈 종료일 = 무기한). DB daterange `[]` && 와 같은 판정. */
function periodsOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string
): boolean {
  const aEndValue = aEnd || '9999-12-31';
  const bEndValue = bEnd || '9999-12-31';
  return aStart <= bEndValue && bStart <= aEndValue;
}

function resolveStatus(startsOn: string, endsOn: string): InstitutionContractStatus {
  const today = todayText();
  if (startsOn > today) {
    return '예정';
  }
  if (endsOn && endsOn < today) {
    return '만료';
  }
  return '유효';
}

let nextContractSeq = 1;
function nextContractId(): string {
  nextContractSeq += 1;
  return `mock-contract-${nextContractSeq}`;
}

type MockContract = {
  contractId: string;
  code: string;
  startsOn: string;
  endsOn: string;
  docUrl: string;
  note: string;
};

/**
 * 시드는 세 코드가 서로 다른 배지 톤을 내도록 고른다 — 목록 계약 컬럼의 색 기준을 e2e 가
 * 한 화면에서 전부 확인할 수 있다.
 * - `EXPO2026-BOOTH-A`: 유효(넉넉) → 기본 톤
 * - `EXPO2026-BOOTH-B`: 만료 → 위험 톤
 * - `CONVENTION-VN`: 계약 없음 → 흐린 톤(정상 상태이며 `만료` 와 구분돼야 한다)
 */
export const mockInstitutionContracts: MockContract[] = [
  {
    contractId: 'mock-contract-1',
    code: 'EXPO2026-BOOTH-A',
    startsOn: shiftDays(-30),
    endsOn: shiftDays(40),
    docUrl: 'https://example.com/contract/booth-a.pdf',
    note: '박람회 A부스 운영 계약'
  },
  {
    contractId: 'mock-contract-0',
    code: 'EXPO2026-BOOTH-B',
    startsOn: shiftDays(-60),
    endsOn: shiftDays(-1),
    docUrl: '',
    note: '종료된 B부스 계약'
  }
];

type MockSettings = {
  code: string;
  maxMembers: number | null;
  defaultInviteExpiryDays: number | null;
  blockIntakeOnExpiry: boolean;
  contactName: string;
  contactEmail: string;
  updatedAt: string;
};

export const mockInstitutionSettings: MockSettings[] = [
  {
    code: 'EXPO2026-BOOTH-A',
    maxMembers: 50,
    defaultInviteExpiryDays: 14,
    blockIntakeOnExpiry: false,
    contactName: '김담당',
    contactEmail: 'booth-a@example.com',
    updatedAt: todayText()
  }
];

type MockExposureOptions = {
  code: string;
  autoHideOnExpiry: boolean;
  autoAssignNewQuestions: boolean;
};

export const mockInstitutionExposureOptions: MockExposureOptions[] = [];

/** 회원 수는 코드 원장이 들고 있다 — 좌석 계산에 쓰려고 주입받는다(순환 import 회피). */
export type MockSeatSource = (code: string) => number;

export function listMockContracts(code: string): InstitutionContract[] {
  return mockInstitutionContracts
    .filter((row) => row.code === code)
    .map((row) => ({
      contractId: row.contractId,
      code: row.code,
      startsOn: row.startsOn,
      endsOn: row.endsOn,
      status: resolveStatus(row.startsOn, row.endsOn),
      docUrl: row.docUrl,
      note: row.note,
      createdAt: row.startsOn,
      updatedAt: todayText()
    }))
    .sort((left, right) => right.startsOn.localeCompare(left.startsOn));
}

/** 계약 유효 판정. **계약 행이 없으면 true**(만료할 계약이 없다) — DB 헬퍼와 같은 폴백. */
export function isMockContractActive(code: string): boolean {
  const rows = mockInstitutionContracts.filter((row) => row.code === code);
  if (rows.length === 0) {
    return true;
  }
  const today = todayText();
  return rows.some((row) => row.startsOn <= today && (!row.endsOn || row.endsOn >= today));
}

export function resolveMockExposureOptions(code: string): InstitutionExposureOptions {
  const found = mockInstitutionExposureOptions.find((row) => row.code === code);
  return {
    code,
    autoHideOnExpiry: found?.autoHideOnExpiry ?? false,
    autoAssignNewQuestions: found?.autoAssignNewQuestions ?? false
  };
}

export function mockContractStatusFor(code: string): InstitutionContractStatusSummary {
  const rows = mockInstitutionContracts.filter((row) => row.code === code);
  const today = todayText();
  const active = rows
    .filter((row) => row.startsOn <= today && (!row.endsOn || row.endsOn >= today))
    .sort((left, right) => right.startsOn.localeCompare(left.startsOn))[0];
  const options = resolveMockExposureOptions(code);
  const hasActive = isMockContractActive(code);

  let daysLeft: number | null = null;
  if (active?.endsOn) {
    const end = new Date(`${active.endsOn}T00:00:00`);
    const start = new Date(`${today}T00:00:00`);
    daysLeft = Math.round((end.getTime() - start.getTime()) / 86_400_000);
  }

  return {
    code,
    hasActiveContract: hasActive,
    activeStartsOn: active?.startsOn ?? '',
    activeEndsOn: active?.endsOn ?? '',
    daysLeft,
    contractCount: rows.length,
    autoHideOnExpiry: options.autoHideOnExpiry,
    writingHiddenNow: options.autoHideOnExpiry && !hasActive
  };
}

export function mockSettingsFor(code: string, memberCount: number): InstitutionSettings {
  const found = mockInstitutionSettings.find((row) => row.code === code);
  // mock 경로에는 초대 원장이 없으므로 대기 초대는 0이다. 좌석은 회원 수와 같다.
  return {
    code,
    maxMembers: found?.maxMembers ?? null,
    defaultInviteExpiryDays: found?.defaultInviteExpiryDays ?? null,
    blockIntakeOnExpiry: found?.blockIntakeOnExpiry ?? false,
    contactName: found?.contactName ?? '',
    contactEmail: found?.contactEmail ?? '',
    memberCount,
    pendingInvitationCount: 0,
    seatsUsed: memberCount,
    updatedAt: found?.updatedAt ?? ''
  };
}

/** 겹침이면 서버와 같은 문구로 실패시킨다 — 화면의 오류 번역이 mock 에서도 같은 길을 탄다. */
function assertNoOverlap(
  code: string,
  startsOn: string,
  endsOn: string,
  ignoreContractId?: string
): void {
  const conflict = mockInstitutionContracts.find(
    (row) =>
      row.code === code
      && row.contractId !== ignoreContractId
      && periodsOverlap(row.startsOn, row.endsOn, startsOn, endsOn)
  );
  if (conflict) {
    throw new Error(
      `contract period overlaps an existing contract of ${code}: `
      + `${conflict.startsOn} ~ ${conflict.endsOn || '무기한'}`
    );
  }
}

export function addMockContract(input: {
  code: string;
  startsOn: string;
  endsOn: string;
  docUrl: string;
  note: string;
}): string {
  assertNoOverlap(input.code, input.startsOn, input.endsOn);
  const contractId = nextContractId();
  mockInstitutionContracts.push({
    contractId,
    code: input.code,
    startsOn: input.startsOn,
    endsOn: input.endsOn,
    docUrl: input.docUrl,
    note: input.note
  });
  return contractId;
}

export function updateMockContract(input: {
  contractId: string;
  startsOn: string;
  endsOn: string;
  docUrl: string;
  note: string;
}): string {
  const existing = mockInstitutionContracts.find(
    (row) => row.contractId === input.contractId
  );
  if (!existing) {
    throw new Error(`unknown contract: ${input.contractId}`);
  }
  assertNoOverlap(existing.code, input.startsOn, input.endsOn, input.contractId);
  existing.startsOn = input.startsOn;
  existing.endsOn = input.endsOn;
  existing.docUrl = input.docUrl;
  existing.note = input.note;
  return input.contractId;
}

export function removeMockContract(contractId: string): string {
  const index = mockInstitutionContracts.findIndex((row) => row.contractId === contractId);
  if (index >= 0) {
    mockInstitutionContracts.splice(index, 1);
  }
  return contractId;
}

export function patchMockInstitutionSettings(input: {
  code: string;
  maxMembers: number | null;
  defaultInviteExpiryDays: number | null;
  blockIntakeOnExpiry: boolean;
  contactName: string;
  contactEmail: string;
}): void {
  const existing = mockInstitutionSettings.find((row) => row.code === input.code);
  if (existing) {
    existing.maxMembers = input.maxMembers;
    existing.defaultInviteExpiryDays = input.defaultInviteExpiryDays;
    existing.blockIntakeOnExpiry = input.blockIntakeOnExpiry;
    existing.contactName = input.contactName;
    existing.contactEmail = input.contactEmail;
    existing.updatedAt = todayText();
    return;
  }
  mockInstitutionSettings.push({ ...input, updatedAt: todayText() });
}

export function patchMockExposureOption(
  code: string,
  field: 'autoHideOnExpiry' | 'autoAssignNewQuestions',
  enabled: boolean
): void {
  const existing = mockInstitutionExposureOptions.find((row) => row.code === code);
  if (existing) {
    existing[field] = enabled;
    return;
  }
  mockInstitutionExposureOptions.push({
    code,
    autoHideOnExpiry: field === 'autoHideOnExpiry' ? enabled : false,
    autoAssignNewQuestions: field === 'autoAssignNewQuestions' ? enabled : false
  });
}

/**
 * 코드 삭제 시 계약·설정·옵션을 함께 지운다. `admin_delete_institution_code` 가 같은 일을
 * 하므로, 같은 코드를 재생성했을 때 이전 계약 기간·정원·담당자가 되살아나면 안 된다.
 */
export function removeMockInstitutionContractData(code: string): void {
  for (let index = mockInstitutionContracts.length - 1; index >= 0; index -= 1) {
    if (mockInstitutionContracts[index].code === code) {
      mockInstitutionContracts.splice(index, 1);
    }
  }
  const settingsIndex = mockInstitutionSettings.findIndex((row) => row.code === code);
  if (settingsIndex >= 0) {
    mockInstitutionSettings.splice(settingsIndex, 1);
  }
  const optionsIndex = mockInstitutionExposureOptions.findIndex((row) => row.code === code);
  if (optionsIndex >= 0) {
    mockInstitutionExposureOptions.splice(optionsIndex, 1);
  }
}
