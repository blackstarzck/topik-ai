import {
  pdfQuotaPeriodUnitLabels,
  type PdfQuotaPeriodUnit,
  type PdfQuotaResetScope,
  type PdfQuotaResetUserOption
} from './pdf-quota-types';

// PDF 내보내기 제한 화면의 순수 스키마 — Phase 4 분해로 페이지 본문에서 이동(동작 동일).
// 조회 상태·폼 인스턴스·저장/초기화 핸들러는 페이지가 소유하고, 여기는 상수·타입·표시 헬퍼만 둔다.

export const PDF_QUOTA_RESET_PAGE_SIZE = 20;
export const PDF_QUOTA_HISTORY_PAGE_SIZE = 10;
export const PDF_QUOTA_RESET_USER_OPTION_PAGE_SIZE = 20;
export const PDF_QUOTA_RESET_USER_SEARCH_DEBOUNCE_MS = 250;
export const PDF_QUOTA_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// 기준 시간대는 free text 대신 운영에서 실제로 쓰는 후보만 노출한다.
// 현재 정책 값이 목록에 없으면 옵션에 동적으로 추가해 표시가 깨지지 않게 한다.
export const PDF_QUOTA_TIMEZONE_OPTIONS = [
  'Asia/Seoul',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Taipei',
  'Asia/Ho_Chi_Minh',
  'Asia/Bangkok',
  'Asia/Jakarta',
  'Asia/Manila',
  'Asia/Kuala_Lumpur',
  'Asia/Ulaanbaatar',
  'UTC'
];

export type PdfQuotaActiveTab = 'policies' | 'resets';

export type PdfQuotaPolicyFormValues = {
  limitCount: number;
  periodUnit: PdfQuotaPeriodUnit;
  periodTimezone: string;
  reason: string;
};

export type PdfQuotaResetFormValues = {
  scope: PdfQuotaResetScope;
  userId?: string;
  groupCode?: string;
  problemId?: string;
  reason: string;
};

export function parsePdfQuotaActiveTab(value: string | null): PdfQuotaActiveTab {
  return value === 'resets' ? 'resets' : 'policies';
}

export function formatPdfQuotaLimitLabel(limit: number | null): string {
  if (limit === null) return '-';
  return limit === 0 ? '0회(중단)' : `${limit}회`;
}

export function formatPdfQuotaUnitLabel(unit: PdfQuotaPeriodUnit | null): string {
  return unit ? pdfQuotaPeriodUnitLabels[unit] : '-';
}

export function formatPdfQuotaResetUserOptionLabel(
  user: PdfQuotaResetUserOption
): string {
  const primary = user.nickname || user.displayName || '-';
  const secondary = user.email || user.id;
  return `${primary} (${secondary})`;
}

export function mergePdfQuotaResetUserOptions(
  current: PdfQuotaResetUserOption[],
  next: PdfQuotaResetUserOption[]
): PdfQuotaResetUserOption[] {
  const seen = new Set(current.map((user) => user.id));
  return [...current, ...next.filter((user) => !seen.has(user.id))];
}

// 구형 감사 행(변경 키만 기록)은 from/to가 비어 있으므로 결과값으로 fallback한다.
export function renderPdfQuotaTransition(
  from: string,
  to: string,
  hasDiff: boolean,
  fallback: string
): string {
  if (!hasDiff) {
    return fallback === '-' ? '기록 없음' : `${fallback} (결과값)`;
  }
  if (from === to) {
    return to;
  }
  return `${from} → ${to}`;
}
