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
  | '문화'
  | '경제'
  | '교육'
  | '환경'
  | '기술';
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

export type AssessmentQuestionReviewDocumentWorkflowStage = {
  status: string;
  approval_source: string;
  artifact_id: string;
};

export type AssessmentQuestionReviewDocument = {
  id: string;
  created_at: string;
  meta: {
    domain: string;
    topic_type: string;
    question_type: string;
    narrative_slots: string[];
    difficulty: number;
    inference_gap: boolean;
    link_keywords: string[];
  };
  review_workflow: {
    stage_order: string[];
    topic_logic: AssessmentQuestionReviewDocumentWorkflowStage;
    graph_logic: AssessmentQuestionReviewDocumentWorkflowStage;
    rubric: AssessmentQuestionReviewDocumentWorkflowStage;
    final_question: AssessmentQuestionReviewDocumentWorkflowStage;
  };
  approved_topic_seed: {
    shortlist_id: string;
    topic_seed_title: string;
    shared_context: string;
    expected_question_type: string;
    expected_cross_chart_bridge: string;
    why_exam_worthy: string;
  };
  approved_graph_logic: {
    graph_logic_id: string;
    scenario_title: string;
    logic_chain: string[];
    chart_a_focus: string;
    chart_b_focus: string;
    cross_chart_bridge: string;
    writing_reason: string;
  };
  approved_rubric: {
    rubric_id: string;
    content: string;
    language: string;
    structure: string;
    rubric_focus_summary: string;
  };
  chart_roles: {
    chart_a_role: string;
    chart_b_role: string;
  };
  scenario_logic: {
    scenario_title: string;
    shared_context: string;
    logic_chain: string[];
    chart_a_focus: string;
    chart_b_focus: string;
    cross_chart_bridge: string;
    writing_reason: string;
  };
  relation: {
    cause_label: string;
    effect_label: string;
    description: string;
  };
  chart_a: {
    chart_type: string;
    title: string;
    unit: string;
    survey_org: string;
    year_range: string[];
    series: Array<Record<string, unknown>>;
  };
  chart_b: {
    chart_type: string;
    title: string;
    unit: string;
    survey_org: string;
    year_range: string[];
    series: Array<Record<string, unknown>>;
  };
  context_notes: {
    display_label: string;
    row1_label: string;
    row1_value: string;
    row2_label: string;
    row2_value: string;
    cause: string;
    status: string;
  };
  narrative: {
    summary_trend: string;
    detail_feature: string;
    rank_flip_sentence: string;
    cause_keywords: string[];
    cause_sentence: string;
    plan_keywords: string[];
    forecast_sentence: string;
    problem_sentence: string;
    solution_keywords: string[];
    solution_sentence: string;
  };
  prompt_text: string;
  model_answer: string;
  rubric: {
    content: string;
    structure: string;
    language: string;
  };
  review_memo: string;
  edit_history: Array<{
    edited_at: string;
    edited_by: string;
    edit_type: string;
    source: string;
    changed_fields: string[];
    summary: string;
    review_snapshot: string;
  }>;
  review_passed: boolean;
};

export type AssessmentQuestionSeed = AssessmentQuestionReviewDocument;

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
  questionText: string;
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
  reviewDocument: AssessmentQuestionReviewDocument | null;
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
