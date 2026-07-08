export const pdfQuotaPeriodUnitValues = ['day', 'week', 'month'] as const;

export type PdfQuotaPeriodUnit = (typeof pdfQuotaPeriodUnitValues)[number];

export const pdfQuotaPeriodUnitLabels: Record<PdfQuotaPeriodUnit, string> = {
  day: '일',
  week: '주',
  month: '월'
};

export type PdfQuotaPolicy = {
  id: string;
  subjectScope: string;
  resourceScope: string;
  periodUnit: PdfQuotaPeriodUnit;
  periodTimezone: string;
  limitCount: number;
  priority: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  // 동시 편집 감지(p_expected_updated_at)용 원본 timestamptz 문자열.
  updatedAtIso: string | null;
};

export type PdfQuotaPolicyHistoryEntry = {
  id: string;
  createdAt: string;
  actorName: string;
  actorEmail: string;
  reason: string;
  limitFrom: number | null;
  limitTo: number | null;
  periodUnitFrom: PdfQuotaPeriodUnit | null;
  periodUnitTo: PdfQuotaPeriodUnit | null;
  periodTimezoneFrom: string | null;
  periodTimezoneTo: string | null;
  // 구형 감사 행(diff 부분 기록) fallback용 결과값.
  resultLimit: number | null;
  resultPeriodUnit: PdfQuotaPeriodUnit | null;
};

export type PdfQuotaPolicyHistoryPage = {
  items: PdfQuotaPolicyHistoryEntry[];
  totalCount: number;
};

export const pdfQuotaResetScopeValues = ['user', 'group', 'global'] as const;

export type PdfQuotaResetScope = (typeof pdfQuotaResetScopeValues)[number];

export const pdfQuotaResetScopeLabels: Record<PdfQuotaResetScope, string> = {
  user: '개인',
  group: '기관 코드',
  global: '전체'
};

export type PdfQuotaReset = {
  id: string;
  scope: PdfQuotaResetScope;
  problemId: string | null;
  reason: string;
  actorEmail: string;
  actorName: string;
  targetCount: number;
  createdAt: string;
};

export type PdfQuotaResetPage = {
  items: PdfQuotaReset[];
  totalCount: number;
};
