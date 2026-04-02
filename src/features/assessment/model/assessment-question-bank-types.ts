export type AssessmentQuestionReviewWorkflowStageName =
  | 'topic_logic'
  | 'graph_logic'
  | 'rubric'
  | 'final_question';

export type AssessmentQuestionReviewWorkflowStage = {
  status: string;
  approval_source: string;
  artifact_id: string;
};

export type AssessmentQuestionEditHistoryItem = {
  edited_at: string;
  edited_by: string;
  edit_type: string;
  source: string;
  changed_fields: string[];
  summary: string;
  review_snapshot: string;
};

export type AssessmentQuestionChart = {
  chart_type: string;
  title: string;
  unit: string;
  survey_org: string;
  year_range: string[];
  series: Array<Record<string, unknown>>;
};

export type AssessmentQuestion = {
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
    stage_order: AssessmentQuestionReviewWorkflowStageName[];
    topic_logic: AssessmentQuestionReviewWorkflowStage;
    graph_logic: AssessmentQuestionReviewWorkflowStage;
    rubric: AssessmentQuestionReviewWorkflowStage;
    final_question: AssessmentQuestionReviewWorkflowStage;
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
  chart_a: AssessmentQuestionChart;
  chart_b: AssessmentQuestionChart;
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
  edit_history: AssessmentQuestionEditHistoryItem[];
  review_passed: boolean;
};

export type AssessmentQuestionReviewDocument = AssessmentQuestion;

export type AssessmentQuestionAuditAction =
  | 'review_memo_saved'
  | 'review_passed_marked'
  | 'review_passed_unmarked';

export type AssessmentQuestionAuditEvent = {
  id: string;
  targetType: 'AssessmentQuestion';
  targetId: string;
  action: AssessmentQuestionAuditAction;
  reason: string;
  changedBy: string;
  createdAt: string;
};
