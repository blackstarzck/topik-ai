export type AssessmentQuestionBankTab = 'review' | 'manage';

export type AssessmentQuestionNumber = '51' | '52' | '53' | '54';

export type AssessmentQuestionReviewStatus =
  | '검수 대기'
  | '검수 중'
  | '보류'
  | '검수 완료'
  | '수정 필요';

export type AssessmentQuestionOperationStatus =
  | '미지정'
  | '노출 후보'
  | '숨김 후보'
  | '운영 제외';

export type AssessmentQuestionValidationStatus = '정상' | '주의' | '재검토';

export type AssessmentQuestionSourceType = 'AI 자동 생성';
export type AssessmentQuestionDomain =
  | '생활'
  | '학습'
  | '사회'
  | '문화';
export type AssessmentQuestionTypeLabel =
  | '빈칸 완성'
  | '연결 표현'
  | '자료 설명'
  | '의견 서술';
export type AssessmentQuestionDifficulty = '상' | '중' | '하';

export type AssessmentQuestionRevisionHistoryItem = {
  id: string;
  changedAt: string;
  changedBy: string;
  summary: string;
};

type AssessmentQuestionBaseContent = {
  learnerPrompt: string;
  reviewPoints: string[];
};

export type AssessmentQuestionContent51 = AssessmentQuestionBaseContent & {
  kind: '51';
  instruction: string;
  choices: string[];
  answer: string;
};

export type AssessmentQuestionContent52 = AssessmentQuestionBaseContent & {
  kind: '52';
  instruction: string;
  choices: string[];
  answer: string;
};

export type AssessmentQuestionContent53 = AssessmentQuestionBaseContent & {
  kind: '53';
  chartTitle: string;
  sourceSummary: string;
  keyFigures: string[];
  answerGuide: string;
};

export type AssessmentQuestionContent54 = AssessmentQuestionBaseContent & {
  kind: '54';
  topicPrompt: string;
  conditionLines: string[];
  outlineGuide: string;
};

export type AssessmentQuestionContent =
  | AssessmentQuestionContent51
  | AssessmentQuestionContent52
  | AssessmentQuestionContent53
  | AssessmentQuestionContent54;

export type AssessmentQuestion = {
  questionId: string;
  questionNumber: AssessmentQuestionNumber;
  topic: string;
  domain: AssessmentQuestionDomain;
  questionTypeLabel: AssessmentQuestionTypeLabel;
  difficultyLevel: AssessmentQuestionDifficulty;
  sourceType: AssessmentQuestionSourceType;
  generationBatchId: string;
  promptVersion: string;
  generationModel: string;
  reviewStatus: AssessmentQuestionReviewStatus;
  operationStatus: AssessmentQuestionOperationStatus;
  validationStatus: AssessmentQuestionValidationStatus;
  validationSignals: string[];
  usageCount: number;
  linkedExamCount: number;
  reviewMemo: string;
  managementNote: string;
  coreMeaning: string;
  keyIssue: string;
  modelAnswer: string;
  scoringCriteria: string[];
  revisionHistory: AssessmentQuestionRevisionHistoryItem[];
  generatedAt: string;
  updatedAt: string;
  updatedBy: string;
  reviewerName: string;
  content: AssessmentQuestionContent;
};

export type AssessmentQuestionAuditAction =
  | 'review_memo_saved'
  | 'review_completed'
  | 'review_on_hold'
  | 'review_revision_requested'
  | 'operation_candidate_exposed'
  | 'operation_candidate_hidden'
  | 'operation_excluded';

export type AssessmentQuestionAuditEvent = {
  id: string;
  targetType: 'AssessmentQuestion';
  targetId: string;
  action: AssessmentQuestionAuditAction;
  reason: string;
  changedBy: string;
  createdAt: string;
};
