import type { TabsProps } from 'antd';

import type {
  AssessmentQuestionNumber,
  AssessmentReviewStatus,
  AssessmentReviewWorkflowStatus,
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
// §3.3 저장값 사전 — DB에는 ASCII 코드를 저장하고 admin은 한국어 라벨로 표시한다.
// ---------------------------------------------------------------------------

export const assessmentReviewStatuses: AssessmentReviewStatus[] = [
  'approved',
  'needs_revision',
  'on_hold'
];

export const REVIEW_STATUS_LABELS: Record<AssessmentReviewStatus, string> = {
  approved: '검수 완료',
  needs_revision: '검수 필요',
  on_hold: '사용 보류'
};

export const assessmentReviewWorkflowStatuses: AssessmentReviewWorkflowStatus[] = [
  'not_started',
  'in_progress',
  'on_hold',
  'done',
  'revision_requested'
];

export const REVIEW_WORKFLOW_STATUS_LABELS: Record<
  AssessmentReviewWorkflowStatus,
  string
> = {
  not_started: '시작 전',
  in_progress: '진행 중',
  on_hold: '보류',
  done: '완료',
  revision_requested: '수정 요청'
};

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

export function getReviewStatusLabel(status: AssessmentReviewStatus): string {
  return REVIEW_STATUS_LABELS[status];
}

export function getReviewWorkflowStatusLabel(
  status: AssessmentReviewWorkflowStatus
): string {
  return REVIEW_WORKFLOW_STATUS_LABELS[status];
}

export function getServiceStatusLabel(
  status: AssessmentServiceStatus | null
): string {
  return status ? SERVICE_STATUS_LABELS[status] : SERVICE_STATUS_UNSET_LABEL;
}

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

export function parseAssessmentReviewStatus(
  value: string | null
): AssessmentReviewStatus | null {
  return assessmentReviewStatuses.includes(value as AssessmentReviewStatus)
    ? (value as AssessmentReviewStatus)
    : null;
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

export function getReviewStatusColor(status: AssessmentReviewStatus): string {
  if (status === 'approved') {
    return 'green';
  }

  if (status === 'on_hold') {
    return 'orange';
  }

  return 'volcano';
}

export function getReviewWorkflowStatusColor(
  status: AssessmentReviewWorkflowStatus
): string {
  if (status === 'done') {
    return 'green';
  }

  if (status === 'in_progress') {
    return 'blue';
  }

  if (status === 'on_hold') {
    return 'orange';
  }

  if (status === 'revision_requested') {
    return 'volcano';
  }

  return 'default';
}

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
