import type { TabsProps } from 'antd';

import type {
  AssessmentQuestionBankTab,
  AssessmentQuestionNumber,
  AssessmentQuestionOperationStatus,
  AssessmentQuestionReviewStatus,
  AssessmentQuestionValidationStatus
} from './assessment-question-bank-types';

export const assessmentQuestionBankTabItems: TabsProps['items'] = [
  { key: 'review', label: '검수 큐' },
  { key: 'manage', label: '문항 관리' }
];

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

export const assessmentQuestionReviewStatuses: AssessmentQuestionReviewStatus[] = [
  '검수 대기',
  '검수 중',
  '보류',
  '검수 완료',
  '수정 필요'
];

export const assessmentQuestionOperationStatuses: AssessmentQuestionOperationStatus[] = [
  '미지정',
  '노출 후보',
  '숨김 후보',
  '운영 제외'
];

export const assessmentQuestionValidationStatuses: AssessmentQuestionValidationStatus[] = [
  '정상',
  '주의',
  '재검토'
];

export const reviewSearchFieldOptions = [
  { label: '전체', value: 'all' },
  { label: '문항 ID', value: 'questionId' },
  { label: '배치 ID', value: 'generationBatchId' },
  { label: '토픽', value: 'topic' },
  { label: '프롬프트 버전', value: 'promptVersion' }
] as const;

export const manageSearchFieldOptions = [
  { label: '전체', value: 'all' },
  { label: '문항 ID', value: 'questionId' },
  { label: '토픽', value: 'topic' },
  { label: '수정자', value: 'updatedBy' },
  { label: '운영 메모', value: 'managementNote' }
] as const;

export function parseAssessmentQuestionBankTab(
  value: string | null
): AssessmentQuestionBankTab {
  return value === 'manage' ? 'manage' : 'review';
}

export function parseAssessmentQuestionNumber(
  value: string | null
): AssessmentQuestionNumber {
  if (value === '52' || value === '53' || value === '54') {
    return value;
  }

  return '51';
}

export function parseAssessmentQuestionReviewStatus(
  value: string | null
): AssessmentQuestionReviewStatus | null {
  return assessmentQuestionReviewStatuses.includes(
    value as AssessmentQuestionReviewStatus
  )
    ? (value as AssessmentQuestionReviewStatus)
    : null;
}

export function parseAssessmentQuestionOperationStatus(
  value: string | null
): AssessmentQuestionOperationStatus | null {
  return assessmentQuestionOperationStatuses.includes(
    value as AssessmentQuestionOperationStatus
  )
    ? (value as AssessmentQuestionOperationStatus)
    : null;
}

export function getReviewStatusColor(status: AssessmentQuestionReviewStatus): string {
  if (status === '검수 완료') {
    return 'green';
  }

  if (status === '보류') {
    return 'orange';
  }

  if (status === '수정 필요') {
    return 'volcano';
  }

  if (status === '검수 중') {
    return 'blue';
  }

  return 'gold';
}

export function getOperationStatusColor(
  status: AssessmentQuestionOperationStatus
): string {
  if (status === '노출 후보') {
    return 'green';
  }

  if (status === '숨김 후보') {
    return 'orange';
  }

  if (status === '운영 제외') {
    return 'volcano';
  }

  return 'default';
}

export function getValidationStatusColor(
  status: AssessmentQuestionValidationStatus
): string {
  if (status === '정상') {
    return 'green';
  }

  if (status === '주의') {
    return 'gold';
  }

  return 'volcano';
}
