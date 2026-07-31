import { defaultInstitutionExposureMode } from '../model/institution-codes-types';
import type {
  InstitutionCode,
  InstitutionExposureMode,
  InstitutionExposureModeRow
} from '../model/institution-codes-types';

/**
 * 기관 코드 mock 시드(Supabase 미구성/e2e 경로). 마이그레이션 dev 시드와 정렬.
 *
 * ⚠️ **배열 순서는 e2e 의 암묵 계약이다.** `tests/e2e/institution-question-exposure.spec.ts` 와
 * `institution-invitations.spec.ts` 가 `tbody tr.ant-table-row` 의 `.first()` 로 A부스 행을 집고
 * 그 행 기준으로 카운터 문자열을 정확 매칭한다. 새 시드는 **배열 끝에만** 추가한다.
 */
export const mockInstitutionCodes: InstitutionCode[] = [
  {
    code: 'EXPO2026-BOOTH-A',
    label: '2026 한국어교육 박람회 · A부스',
    kind: '박람회',
    status: '활성',
    note: '현장 QR 가입 · A부스',
    memberCount: 0,
    createdAt: '2026-06-19',
    updatedAt: '2026-06-19'
  },
  {
    code: 'EXPO2026-BOOTH-B',
    label: '2026 한국어교육 박람회 · B부스',
    kind: '박람회',
    status: '활성',
    note: '현장 QR 가입 · B부스',
    memberCount: 0,
    createdAt: '2026-06-19',
    updatedAt: '2026-06-19'
  },
  {
    // 모드 전환 차단 가드(배정 0건 + 회원 있음) 검증용. 배열 끝에 둔다 — 위 주석 참조.
    code: 'CONVENTION-VN',
    label: '베트남 박람회 · 현장 유입',
    kind: '박람회',
    status: '활성',
    note: '배정 0건 + 소속 회원 있음 — 배정분만 전환 차단 케이스',
    memberCount: 130,
    createdAt: '2026-07-09',
    updatedAt: '2026-07-09'
  }
];

/**
 * 기관별 노출 모드 mock 원장. admin_list_institution_exposure_modes 와 같은 의미다 —
 * institution_codes 기준이라 **모든 코드가 한 행씩** 나오고, 배정 건수는 실제 값이다.
 * `assignedQuestionCount` 는 mock-institution-questions.ts 의 `mockExposureByCode` 와 일치시켜야 한다.
 * - `EXPO2026-BOOTH-A`: `배정분만`(원장 행 없음) + 배정 1건 → 기존 e2e 화면 유지
 * - `EXPO2026-BOOTH-B`: `제한 없음` + 배정 2건 → `제한 없음` 분기와 "배정 보존" 표기 검증
 * - `CONVENTION-VN`: `제한 없음` + 배정 0건 + 회원 130명 → `배정분만` 전환 차단 검증
 */
export const mockInstitutionExposureModes: InstitutionExposureModeRow[] = [
  {
    // 원장 행이 없는 실제 상태를 모사한다 — 실효 모드는 기본값이고 배정 건수는 실제 값이다
    // (RPC 가 institution_codes 좌결합이라 행 없는 코드도 실제 건수를 돌려준다).
    code: 'EXPO2026-BOOTH-A',
    exposureMode: '배정분만',
    assignedQuestionCount: 1,
    reason: '',
    updatedAt: ''
  },
  {
    code: 'EXPO2026-BOOTH-B',
    exposureMode: '제한 없음',
    assignedQuestionCount: 2,
    reason: 'mock 시드',
    updatedAt: '2026-08-01'
  },
  {
    code: 'CONVENTION-VN',
    exposureMode: '제한 없음',
    assignedQuestionCount: 0,
    reason: 'mock 시드',
    updatedAt: '2026-08-01'
  }
];

/**
 * mock 경로의 모드 전환. **`assignedQuestionCount` 는 건드리지 않는다** — 모드 전환이 배정을
 * 지우지 않는다는 계약이 mock 에서도 성립해야 e2e 로 왕복 보존을 증명할 수 있다.
 */
export function patchMockInstitutionExposureMode(
  code: string,
  exposureMode: InstitutionExposureMode,
  reason: string
): void {
  const existing = mockInstitutionExposureModes.find((row) => row.code === code);
  if (existing) {
    existing.exposureMode = exposureMode;
    existing.reason = reason;
    return;
  }
  mockInstitutionExposureModes.push({
    code,
    exposureMode,
    assignedQuestionCount: 0,
    reason,
    updatedAt: '2026-08-01'
  });
}

/** 원장에 행이 없으면 현행 동작으로 해석한다. 화면·mock 공통 규칙. */
export function resolveMockExposureMode(code: string): InstitutionExposureMode {
  return (
    mockInstitutionExposureModes.find((row) => row.code === code)?.exposureMode
    ?? defaultInstitutionExposureMode
  );
}
