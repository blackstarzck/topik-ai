export type AssessmentQuestionNumber = '51' | '52' | '53' | '54';

/**
 * P3 cutover model (실행계획안 §7.2): rows come from the topik_writing_* schema
 * (recommendation view for lists, per-number tables for detail). Statuses are the
 * DB ASCII codes from the §3.3 storage dictionary; Korean labels live in
 * assessment-question-bank-schema.ts. The sealed legacy `problems` adapter maps
 * its rows into this same model with honest sentinels ('' / null) where the old
 * schema has no source.
 */
export type AssessmentReviewStatus = 'approved' | 'needs_revision' | 'on_hold';

export type AssessmentReviewWorkflowStatus =
  | 'not_started'
  | 'in_progress'
  | 'on_hold'
  | 'done'
  | 'revision_requested';

export type AssessmentServiceStatus = 'available' | 'excluded' | 'internal_test';

/**
 * 목록 행 — `topik_writing_question_recommendation_view`의 18컬럼(§7.9 12 + E4 6)과
 * 1:1. serviceStatus가 null이면 소스가 없는 legacy 행이다('미지정' 표시).
 */
export type AssessmentQuestionSummary = {
  questionId: string;
  questionNumber: AssessmentQuestionNumber;
  targetLevel: string;
  difficultyLevel: number | null;
  topicMain: string;
  topicDetail: string;
  speechAct: string;
  scenarioType: string;
  situationSummary: string;
  questionTypeName: string;
  recommendationKeys: string[];
  avoidRepeatKeys: string[];
  reviewStatus: AssessmentReviewStatus;
  reviewWorkflowStatus: AssessmentReviewWorkflowStatus;
  serviceStatus: AssessmentServiceStatus | null;
  contentTeamMemo: string;
  createdAt: string;
  updatedAt: string;
};

export type AssessmentBlankMeta = {
  position: string;
  role: string;
  blankFunction: string;
  answerType: string;
  canonicalAnswer: string;
  acceptedAnswers: string[];
  targetNote: string;
};

export type AssessmentQuestionContent51 = {
  kind: '51';
  blankCount: number | null;
  blank1: AssessmentBlankMeta;
  blank2: AssessmentBlankMeta;
};

export type AssessmentQuestionContent52 = {
  kind: '52';
  completionUnit: string;
  connectionFunction: string;
  requiredExpressionFunction: string;
  clueBeforeText: string;
  clueAfterText: string;
  answerScopeType: string;
  blank1CanonicalAnswer: string;
  blank2CanonicalAnswer: string;
  scoringNotes: string;
};

export type AssessmentQuestionContent53 = {
  kind: '53';
  dataType: string;
  dataTopic: string;
  chartTitle: string;
  chartUnit: string;
  comparisonType: string;
  changeType: string;
  interpretationDifficulty: string;
  keyFindings: string[];
  requiredStructure: string[];
  wordCountMin: number | null;
  wordCountMax: number | null;
  /** D-13 1차: source_data JSONB 수치 그대로 (시각 자산 URL은 empty state 허용). */
  sourceData: unknown;
  dataAssetUrl: string;
  scoringFocus: string[];
};

export type AssessmentQuestionContent54 = {
  kind: '54';
  essayType: string;
  issueTopic: string;
  promptQuestions: string[];
  stanceRequirement: string;
  requiredStructure: string[];
  reasoningPattern: string;
  argumentKeywords: string[];
  wordCountMin: number | null;
  wordCountMax: number | null;
  scoringFocus: string[];
  prohibitedElements: string[];
};

export type AssessmentQuestionContent =
  | AssessmentQuestionContent51
  | AssessmentQuestionContent52
  | AssessmentQuestionContent53
  | AssessmentQuestionContent54;

/** 상세 행 — 번호별 테이블 전체 컬럼(공통 + 번호별 전용 content). */
export type AssessmentQuestionDetail = AssessmentQuestionSummary & {
  secondaryTopicMain: string | null;
  secondaryTopicDetail: string | null;
  textType: string;
  learningGoalSummary: string;
  promptText: string;
  resolvedText: string;
  modelAnswer: string;
  autoChecksPassed: boolean | null;
  reviewPassed: boolean | null;
  content: AssessmentQuestionContent;
};

export type TopikWritingTopicMasterRow = {
  topicMain: string;
  topicDetail: string;
  sortOrder: number | null;
};

export type TopikWritingTagMasterRow = {
  tagCode: string;
  tagNameKo: string;
  tagGroup: string;
  description: string;
  isActive: boolean;
};

export type TopikWritingQuestionTagRow = {
  tagAssignmentId: number;
  questionId: string;
  tagCode: string;
  tagValue: string | null;
  assignedAt: string;
  memo: string;
};

/** 검수 액션 → admin_update_topik_question patch 의미 (D-2/D-8). */
export type AssessmentReviewAction = 'approved' | 'on_hold' | 'needs_revision';

/** D-8 감사 액션 코드 (admin_audit_logs.action, target_table='AssessmentQuestion'). */
export type AssessmentQuestionAuditAction =
  | 'review_memo_saved'
  | 'review_completed'
  | 'review_on_hold'
  | 'review_revision_requested'
  | 'review_status_changed'
  | 'service_status_changed'
  | 'tag_assigned'
  | 'tag_removed';

export type AssessmentQuestionAuditEvent = {
  id: string;
  targetType: 'AssessmentQuestion';
  targetId: string;
  action: AssessmentQuestionAuditAction;
  reason: string;
  changedBy: string;
  createdAt: string;
};
