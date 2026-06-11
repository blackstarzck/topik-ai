import type { TabsProps } from 'antd';

import type {
  AssessmentQuestionNumber,
  AssessmentServiceStatus
} from './assessment-question-bank-types';

export const assessmentQuestionNumberTabItems: TabsProps['items'] = [
  { key: '51', label: '51번' },
  { key: '52', label: '52번' },
  { key: '53', label: '53번' },
  { key: '54', label: '54번' }
];

export const assessmentQuestionNumbers: AssessmentQuestionNumber[] = [
  '51',
  '52',
  '53',
  '54'
];

// ---------------------------------------------------------------------------
// 저장값 사전 — DB에는 ASCII 코드를 저장하고 admin은 한국어 라벨로 표시한다.
// (검수 상태 사전은 2026-06-11 인바운드 전환·검수 개념 삭제로 제거 — 결정 기록 §0)
// ---------------------------------------------------------------------------

export const assessmentServiceStatuses: AssessmentServiceStatus[] = [
  'available',
  'excluded',
  'internal_test'
];

export const SERVICE_STATUS_LABELS: Record<AssessmentServiceStatus, string> = {
  available: '노출 가능',
  excluded: '노출 제외',
  internal_test: '내부 테스트'
};

/** legacy 행처럼 service_status 소스 자체가 없는 경우의 표시 라벨. */
export const SERVICE_STATUS_UNSET_LABEL = '미지정';

export function getServiceStatusLabel(
  status: AssessmentServiceStatus | null
): string {
  return status ? SERVICE_STATUS_LABELS[status] : SERVICE_STATUS_UNSET_LABEL;
}

// ---------------------------------------------------------------------------
// 태그 그룹 사전 (schema-rule §2.2) — POL-018 화면 가드의 판정 축.
// '서비스_노출상태' 그룹은 시드 제외·RPC 부여 차단(D-6, facade에서도 필터).
// ---------------------------------------------------------------------------

export const TAG_GROUP_OPERATION_CAUTION = '운영주의';
export const TAG_GROUP_REPEAT_AVOID = '반복방지';

/**
 * POL-018 ③(D-6 노출 제외 기준): 반복방지 태그 활성이 이 수 이상이면
 * "반복 노출 회피 대상 과다"로 보고 노출 제외(excluded)를 권고한다.
 */
export const REPEAT_AVOID_EXCESS_THRESHOLD = 2;

// ---------------------------------------------------------------------------
// 유형·난이도 — 유형 명칭은 입력표가 덮어쓸 수 있으나 필터 축은 번호 파생 4값이다.
// 난이도는 1~6 정수(§3.3, 표준 교육과정 재산정)다.
// ---------------------------------------------------------------------------

export const assessmentQuestionTypeNames: string[] = [
  '빈칸 완성',
  '연결 표현',
  '자료 설명',
  '의견 서술'
];

export const assessmentDifficultyLevels: number[] = [1, 2, 3, 4, 5, 6];

// ---------------------------------------------------------------------------
// URL 파라미터 파서
// ---------------------------------------------------------------------------

export function parseAssessmentQuestionNumber(
  value: string | null
): AssessmentQuestionNumber {
  if (value === '52' || value === '53' || value === '54') {
    return value;
  }

  return '51';
}

export function parseAssessmentQuestionNumbers(
  values: string[]
): AssessmentQuestionNumber[] {
  const requestedNumbers = new Set(values);
  const normalizedNumbers = assessmentQuestionNumbers.filter((questionNumber) =>
    requestedNumbers.has(questionNumber)
  );

  return normalizedNumbers.length > 0
    ? normalizedNumbers
    : assessmentQuestionNumbers;
}

export function parseAssessmentServiceStatus(
  value: string | null
): AssessmentServiceStatus | null {
  return assessmentServiceStatuses.includes(value as AssessmentServiceStatus)
    ? (value as AssessmentServiceStatus)
    : null;
}

export function parseAssessmentQuestionTypeName(
  value: string | null
): string | null {
  return value && assessmentQuestionTypeNames.includes(value) ? value : null;
}

export function parseAssessmentDifficultyLevel(
  value: string | null
): number | null {
  const parsed = value == null ? NaN : Number(value);
  return assessmentDifficultyLevels.includes(parsed) ? parsed : null;
}

// ---------------------------------------------------------------------------
// 색상맵 (Ant Design Tag 색)
// ---------------------------------------------------------------------------

export function getServiceStatusColor(
  status: AssessmentServiceStatus | null
): string {
  if (status === 'available') {
    return 'green';
  }

  if (status === 'excluded') {
    return 'volcano';
  }

  if (status === 'internal_test') {
    return 'geekblue';
  }

  return 'default';
}
