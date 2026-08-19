import {
  SERVICE_STATUS_LABELS,
  assessmentServiceStatuses
} from './assessment-question-bank-schema';
import type {
  AssessmentQuestionVersionEntry,
  AssessmentServiceStatus
} from './assessment-question-bank-types';
import type { AsyncState } from '@/shared/model/async-state';

// 문항 관리 페이지의 조치 카피·상태 상수 — Phase 4 분해로 페이지 본문에서 이동(값 동일).
export const EMPTY_VERSION_HISTORY_STATE: AsyncState<AssessmentQuestionVersionEntry[]> = {
  status: 'idle',
  data: [],
  errorMessage: null,
  errorCode: null
};

/**
 * P4 관리 포인트 개방 (실행계획안 §8, 2026-06-11): 노출 통제(service_status)와
 * 태그 부여/제거가 admin의 유일한 문항 write 표면이다. 모든 write는 RPC 경유
 * (admin_update_topik_question / admin_assign·remove_question_tag)로 감사 로그에
 * 남고, 사유 입력이 필수다. POL-018 화면 가드: ② 운영주의 태그 활성 문항의
 * available 전환 경고(+사유 필수) ③ 반복방지 태그 활성 과다 시 excluded 권고.
 */

export const serviceStatusLabels = assessmentServiceStatuses.map(
  (status) => SERVICE_STATUS_LABELS[status]
);

export type OperationActionState = {
  questionId: string;
  nextStatus: AssessmentServiceStatus;
} | null;

export type OperationActionCopy = {
  label: string;
  title: string;
  description: string;
  confirmText: string;
  successMessage: string;
  reasonPlaceholder: string;
};

// D-6: 노출 가능(available) / 노출 제외(excluded). '운영 제외'는 excluded +
// 운영주의 태그 '운영 제외' 부여로 구분한다(태그 편집은 P4 — 버튼만 자리 확보).
export const OPERATION_ACTIONS: { nextStatus: AssessmentServiceStatus; copy: OperationActionCopy }[] = [
  {
    nextStatus: 'available',
    copy: {
      label: '노출 가능',
      title: '노출 가능 전환',
      description:
        '이 문항을 노출 가능(available)으로 전환합니다. 운영주의 태그 활성 문항은 전환 사유가 필수이며(POL-018), 변경 사유는 감사 로그로 남습니다.',
      confirmText: '노출 가능',
      successMessage: '노출 가능으로 변경했습니다.',
      reasonPlaceholder: '노출 가능 전환 사유를 입력해 주세요.'
    }
  },
  {
    nextStatus: 'excluded',
    copy: {
      label: '노출 제외',
      title: '노출 제외 전환',
      description:
        '이 문항을 노출 제외(excluded)로 전환합니다. 변경 사유는 감사 로그로 남습니다.',
      confirmText: '노출 제외',
      successMessage: '노출 제외로 변경했습니다.',
      reasonPlaceholder: '노출 제외 사유를 입력해 주세요.'
    }
  },
  {
    nextStatus: 'internal_test',
    copy: {
      label: '내부 테스트',
      title: '내부 테스트 전환',
      description:
        '이 문항을 내부 테스트(internal_test)로 되돌립니다. 사용자 노출이 차단되며, 변경 사유는 감사 로그로 남습니다.',
      confirmText: '내부 테스트',
      successMessage: '내부 테스트로 변경했습니다.',
      reasonPlaceholder: '내부 테스트 전환 사유를 입력해 주세요.'
    }
  }
];
