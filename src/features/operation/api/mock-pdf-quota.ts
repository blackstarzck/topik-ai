import type {
  PdfQuotaPolicy,
  PdfQuotaPolicyHistoryEntry,
  PdfQuotaReset
} from '../model/pdf-quota-types';

// 결정적 mock seed. v13 기본 정책(월 3회, Asia/Seoul)과 동일한 값으로 시작한다.
export const mockPdfQuotaPolicies: PdfQuotaPolicy[] = [
  {
    id: 'PDFQ-POLICY-001',
    subjectScope: 'user',
    resourceScope: 'problem',
    periodUnit: 'month',
    periodTimezone: 'Asia/Seoul',
    limitCount: 3,
    priority: 100,
    isActive: true,
    createdAt: '2026-07-07 12:00',
    updatedAt: '2026-07-07 12:00',
    updatedAtIso: '2026-07-07T12:00:00+00:00'
  }
];

// 이력 seed: 첫 행은 신형(3필드 from→to 상시 기록), 둘째 행은 구형(변경 키만
// 기록돼 from/to가 비어 있는) 감사 행 — fallback 렌더링 경로를 유지 검증한다.
export const mockPdfQuotaPolicyHistory: PdfQuotaPolicyHistoryEntry[] = [
  {
    id: 'PDFQ-AUDIT-001',
    createdAt: '2026-07-07 12:00',
    actorName: '운영 관리자',
    actorEmail: 'ops-admin@talkpik.dev',
    reason: '기본 정책(3회/월) 확정',
    limitFrom: 5,
    limitTo: 3,
    periodUnitFrom: 'week',
    periodUnitTo: 'month',
    periodTimezoneFrom: 'Asia/Seoul',
    periodTimezoneTo: 'Asia/Seoul',
    resultLimit: 3,
    resultPeriodUnit: 'month'
  },
  {
    id: 'PDFQ-AUDIT-002',
    createdAt: '2026-07-06 18:00',
    actorName: '운영 관리자',
    actorEmail: 'ops-admin@talkpik.dev',
    reason: '박람회 기간 한시 상향(구형 기록)',
    limitFrom: null,
    limitTo: null,
    periodUnitFrom: null,
    periodUnitTo: null,
    periodTimezoneFrom: null,
    periodTimezoneTo: null,
    resultLimit: 5,
    resultPeriodUnit: 'week'
  }
];

export const mockPdfQuotaResets: PdfQuotaReset[] = [
  {
    id: 'PDFQ-RESET-001',
    scope: 'user',
    problemId: null,
    reason: '학습자 문의(중복 결제)로 이번 달 내보내기 횟수 복구',
    actorEmail: 'ops-admin@talkpik.dev',
    actorName: '운영 관리자',
    targetCount: 1,
    createdAt: '2026-07-07 13:00'
  },
  {
    id: 'PDFQ-RESET-002',
    scope: 'group',
    problemId: null,
    reason: '2026 박람회 현장 시연 후 기관 단위 초기화',
    actorEmail: 'ops-admin@talkpik.dev',
    actorName: '운영 관리자',
    targetCount: 24,
    createdAt: '2026-07-06 18:30'
  }
];
