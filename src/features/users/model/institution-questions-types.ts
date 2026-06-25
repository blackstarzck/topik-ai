/**
 * 기관 중심 노출 문항 관리 모델 (회원 > 기관 코드 > 노출 문항 모달).
 *
 * 문항 중심(assessment 도메인)과 같은 매핑 테이블
 * (topik_writing_question_institution_exposure)을 기관 기준으로 본다. 순환 의존을
 * 피하려고 users 도메인 자체 타입/어댑터로 두며, assessment 타입을 import하지 않는다.
 * admin_list_institution_writing_questions RPC(전체 문항 + is_exposed)와 1:1.
 */
export type InstitutionExposableQuestion = {
  questionId: string;
  itemNumber: number;
  topicMain: string;
  situationSummary: string;
  questionTypeName: string;
  serviceStatus: string;
  /** 이 기관에 전용 노출 중인지(false=추가 후보). */
  isExposed: boolean;
};

/**
 * add/remove RPC(jsonb) 결과 — 변경/무변경/실패 집계. batchId는 같은 일괄 작업의
 * 감사 행을 묶는 추적 키(문항 중심 BulkServiceStatusResult와 동형이되 users 자체 정의).
 */
export type InstitutionQuestionMutationResult = {
  total: number;
  changed: number;
  unchanged: number;
  failed: number;
  batchId: string;
  details: { questionId: string; message: string }[];
};

export type InstitutionQuestionMutationPayload = {
  institutionCode: string;
  questionIds: string[];
  reason: string;
};
