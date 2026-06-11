export type AssessmentQuestionNumber = '51' | '52' | '53' | '54';

/**
 * 인바운드 모델 (2026-06-11 결정 기록 §0): 문항은 외부(공급) API에서 완성 상태로
 * 수신·적재되며, admin은 조회 + 관리 포인트(태그) + 노출 통제(service_status)만
 * 수행한다. 검수 개념은 전면 삭제됐다. rows come from the topik_writing_* schema
 * (recommendation view for lists, per-number tables for detail). Statuses are the
 * DB ASCII codes; Korean labels live in assessment-question-bank-schema.ts. The
 * sealed legacy `problems` adapter maps its rows into this same model with honest
 * sentinels ('' / null) where the old schema has no source.
 */
export type AssessmentServiceStatus = 'available' | 'excluded' | 'internal_test';

/**
 * 목록 행 — `topik_writing_question_recommendation_view`의 16컬럼과 1:1.
 * serviceStatus가 null이면 소스가 없는 legacy 행이다('미지정' 표시).
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
  /** 수신·적재 자동 정합 검사 표식(검수 아님 — 결정 기록 §0-3). */
  autoChecksPassed: boolean | null;
  content: AssessmentQuestionContent;
};

export type TopikWritingTopicMasterRow = {
  topicMain: string;
  topicDetail: string;
  sortOrder: number | null;
};

/** 주제 마스터 전수 행 — /system/metadata 마스터 카탈로그 조회용(P5-1, 비활성 포함). */
export type TopikWritingTopicMasterCatalogRow = {
  topicId: number;
  topicMain: string;
  topicDetail: string;
  sourceName: string;
  isActive: boolean;
  sortOrder: number | null;
  memo: string | null;
};

/** 태그 마스터 전수 행 — /system/metadata 마스터 카탈로그 조회용(P5-1, 비활성·전 그룹 포함). */
export type TopikWritingTagMasterCatalogRow = {
  tagCode: string;
  tagNameKo: string;
  tagGroup: string;
  description: string;
  usageRule: string;
  exampleQuestionId: string | null;
  isActive: boolean;
  updatedAt: string;
};

export type TopikWritingTagMasterRow = {
  tagCode: string;
  tagNameKo: string;
  tagGroup: string;
  description: string;
  /** D-6 노출 제외 기준 등 태그별 운영 가이드(시드 usage_rule). */
  usageRule: string;
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

/**
 * D-8 감사 액션 코드 (admin_audit_logs.action, target_table='AssessmentQuestion').
 * 2026-06-11 개정: 검수 액션 4종·question_published 폐기, question_received는
 * 외부 공급 API 수신 연동(P6)에서 추가.
 */
export type AssessmentQuestionAuditAction =
  | 'service_status_changed'
  | 'tag_assigned'
  | 'tag_removed'
  | 'question_received';

export type AssessmentQuestionAuditEvent = {
  id: string;
  targetType: 'AssessmentQuestion';
  targetId: string;
  action: AssessmentQuestionAuditAction;
  reason: string;
  changedBy: string;
  createdAt: string;
};
