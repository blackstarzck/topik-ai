import { supabaseClient } from '../../../shared/api/supabase-client';
import type {
  AssessmentQuestionContent,
  AssessmentQuestionDetail,
  AssessmentQuestionNumber,
  AssessmentQuestionSummary,
  AssessmentReviewAction,
  AssessmentReviewStatus,
  AssessmentReviewWorkflowStatus,
  AssessmentServiceStatus,
  TopikWritingQuestionTagRow,
  TopikWritingTopicMasterRow
} from '../model/assessment-question-bank-types';

/**
 * P3 신규 스키마 어댑터 (실행계획안 §7.2): 목록은
 * `topik_writing_question_recommendation_view`(E4 확장 18컬럼) 1회 조회,
 * 상세는 question_id의 번호로 라우팅한 번호별 테이블 조회, 검수 쓰기는
 * `admin_update_topik_question` RPC 단일 경로(D-8 — 직접 write는 RLS 차단)다.
 */

const TABLE_BY_NUMBER: Record<AssessmentQuestionNumber, string> = {
  '51': 'topik_writing_51_questions',
  '52': 'topik_writing_52_questions',
  '53': 'topik_writing_53_questions',
  '54': 'topik_writing_54_questions'
};

const VIEW_COLUMNS =
  'question_id, item_number, target_level, difficulty_level, topic_main, topic_detail, ' +
  'speech_act, scenario_type, recommendation_keys, avoid_repeat_keys, review_status, ' +
  'service_status, situation_summary, question_type_name, content_team_memo, ' +
  'review_workflow_status, created_at, updated_at';

type ViewRow = {
  question_id: string;
  item_number: number;
  target_level: string | null;
  difficulty_level: number | null;
  topic_main: string;
  topic_detail: string;
  speech_act: string | null;
  scenario_type: string;
  recommendation_keys: unknown;
  avoid_repeat_keys: unknown;
  review_status: string;
  service_status: string;
  situation_summary: string;
  question_type_name: string;
  content_team_memo: string | null;
  review_workflow_status: string;
  created_at: string | null;
  updated_at: string | null;
};

function requireClient() {
  if (!supabaseClient) {
    throw new Error('Supabase client not configured');
  }
  return supabaseClient;
}

function toDateTime(ts: string | null | undefined): string {
  return ts ? ts.slice(0, 16).replace('T', ' ') : '';
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

function toText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function toNullableNumber(value: unknown): number | null {
  return typeof value === 'number' ? value : null;
}

export function itemNumberOfQuestionId(
  questionId: string
): AssessmentQuestionNumber | null {
  const match = /^topik-writing-(51|52|53|54)-/.exec(questionId);
  return match ? (match[1] as AssessmentQuestionNumber) : null;
}

function mapSummary(row: ViewRow): AssessmentQuestionSummary {
  return {
    questionId: row.question_id,
    questionNumber: String(row.item_number) as AssessmentQuestionNumber,
    targetLevel: row.target_level ?? '',
    difficultyLevel: row.difficulty_level,
    topicMain: row.topic_main,
    topicDetail: row.topic_detail,
    speechAct: row.speech_act ?? '',
    scenarioType: row.scenario_type,
    situationSummary: row.situation_summary,
    questionTypeName: row.question_type_name,
    recommendationKeys: toStringArray(row.recommendation_keys),
    avoidRepeatKeys: toStringArray(row.avoid_repeat_keys),
    reviewStatus: row.review_status as AssessmentReviewStatus,
    reviewWorkflowStatus: row.review_workflow_status as AssessmentReviewWorkflowStatus,
    serviceStatus: row.service_status as AssessmentServiceStatus,
    contentTeamMemo: row.content_team_memo ?? '',
    createdAt: toDateTime(row.created_at),
    updatedAt: toDateTime(row.updated_at)
  };
}

type TableRow = Record<string, unknown>;

function mapBlank(row: TableRow, n: 1 | 2) {
  return {
    position: toText(row[`blank_${n}_position`]),
    role: toText(row[`blank_${n}_role`]),
    blankFunction: toText(row[`blank_${n}_function`]),
    answerType: toText(row[`blank_${n}_answer_type`]),
    canonicalAnswer: toText(row[`blank_${n}_canonical_answer`]),
    acceptedAnswers: toStringArray(row[`blank_${n}_accepted_answers`]),
    targetNote: toText(row[`blank_${n}_target_note`])
  };
}

function mapContent(
  kind: AssessmentQuestionNumber,
  row: TableRow
): AssessmentQuestionContent {
  switch (kind) {
    case '52':
      return {
        kind: '52',
        completionUnit: toText(row.completion_unit),
        connectionFunction: toText(row.connection_function),
        requiredExpressionFunction: toText(row.required_expression_function),
        clueBeforeText: toText(row.clue_before_text),
        clueAfterText: toText(row.clue_after_text),
        answerScopeType: toText(row.answer_scope_type),
        blank1CanonicalAnswer: toText(row.blank_1_canonical_answer),
        blank2CanonicalAnswer: toText(row.blank_2_canonical_answer),
        scoringNotes: toText(row.scoring_notes)
      };
    case '53':
      return {
        kind: '53',
        dataType: toText(row.data_type),
        dataTopic: toText(row.data_topic),
        chartTitle: toText(row.chart_title),
        chartUnit: toText(row.chart_unit),
        comparisonType: toText(row.comparison_type),
        changeType: toText(row.change_type),
        interpretationDifficulty: toText(row.interpretation_difficulty),
        keyFindings: toStringArray(row.key_findings),
        requiredStructure: toStringArray(row.required_structure),
        wordCountMin: toNullableNumber(row.word_count_min),
        wordCountMax: toNullableNumber(row.word_count_max),
        sourceData: row.source_data ?? null,
        dataAssetUrl: toText(row.data_asset_url),
        scoringFocus: toStringArray(row.scoring_focus)
      };
    case '54':
      return {
        kind: '54',
        essayType: toText(row.essay_type),
        issueTopic: toText(row.issue_topic),
        promptQuestions: toStringArray(row.prompt_questions),
        stanceRequirement: toText(row.stance_requirement),
        requiredStructure: toStringArray(row.required_structure),
        reasoningPattern: toText(row.reasoning_pattern),
        argumentKeywords: toStringArray(row.argument_keywords),
        wordCountMin: toNullableNumber(row.word_count_min),
        wordCountMax: toNullableNumber(row.word_count_max),
        scoringFocus: toStringArray(row.scoring_focus),
        prohibitedElements: toStringArray(row.prohibited_elements)
      };
    case '51':
    default:
      return {
        kind: '51',
        blankCount: toNullableNumber(row.blank_count),
        blank1: mapBlank(row, 1),
        blank2: mapBlank(row, 2)
      };
  }
}

function mapDetail(kind: AssessmentQuestionNumber, row: TableRow): AssessmentQuestionDetail {
  return {
    questionId: toText(row.question_id),
    questionNumber: kind,
    targetLevel: toText(row.target_level),
    difficultyLevel: toNullableNumber(row.difficulty_level),
    topicMain: toText(row.topic_main),
    topicDetail: toText(row.topic_detail),
    speechAct: toText(row.speech_act),
    scenarioType: toText(row.scenario_type),
    situationSummary: toText(row.situation_summary),
    questionTypeName: toText(row.question_type_name),
    recommendationKeys: toStringArray(row.recommendation_keys),
    avoidRepeatKeys: toStringArray(row.avoid_repeat_keys),
    reviewStatus: row.review_status as AssessmentReviewStatus,
    reviewWorkflowStatus: row.review_workflow_status as AssessmentReviewWorkflowStatus,
    serviceStatus: row.service_status as AssessmentServiceStatus,
    contentTeamMemo: toText(row.content_team_memo),
    createdAt: toDateTime(row.created_at as string | null),
    updatedAt: toDateTime(row.updated_at as string | null),
    secondaryTopicMain: (row.secondary_topic_main as string | null) ?? null,
    secondaryTopicDetail: (row.secondary_topic_detail as string | null) ?? null,
    textType: toText(row.text_type),
    learningGoalSummary: toText(row.learning_goal_summary),
    promptText: toText(row.prompt_text),
    resolvedText: toText(row.resolved_text),
    modelAnswer: toText(row.model_answer),
    autoChecksPassed: typeof row.auto_checks_passed === 'boolean' ? row.auto_checks_passed : null,
    reviewPassed: typeof row.review_passed === 'boolean' ? row.review_passed : null,
    content: mapContent(kind, row)
  };
}

export async function loadTopikWritingSummaries(
  signal?: AbortSignal
): Promise<AssessmentQuestionSummary[]> {
  const client = requireClient();
  const { data, error } = await client
    .from('topik_writing_question_recommendation_view')
    .select(VIEW_COLUMNS)
    .order('question_id');
  if (signal?.aborted) {
    throw new DOMException('Request aborted', 'AbortError');
  }
  if (error) {
    throw new Error(error.message);
  }
  return ((data ?? []) as unknown as ViewRow[]).map(mapSummary);
}

export async function loadTopikWritingDetail(
  questionId: string,
  signal?: AbortSignal
): Promise<AssessmentQuestionDetail> {
  const client = requireClient();
  const kind = itemNumberOfQuestionId(questionId);
  if (!kind) {
    throw new Error('문항 대상을 찾을 수 없습니다.');
  }
  const { data, error } = await client
    .from(TABLE_BY_NUMBER[kind])
    .select('*')
    .eq('question_id', questionId)
    .maybeSingle();
  if (signal?.aborted) {
    throw new DOMException('Request aborted', 'AbortError');
  }
  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    throw new Error('문항 대상을 찾을 수 없습니다.');
  }
  return mapDetail(kind, data as TableRow);
}

export async function loadTopikWritingTopicMaster(
  signal?: AbortSignal
): Promise<TopikWritingTopicMasterRow[]> {
  const client = requireClient();
  const { data, error } = await client
    .from('topik_writing_topic_master')
    .select('topic_main, topic_detail, sort_order')
    .eq('is_active', true)
    .order('sort_order', { ascending: true, nullsFirst: false })
    .order('topic_detail');
  if (signal?.aborted) {
    throw new DOMException('Request aborted', 'AbortError');
  }
  if (error) {
    throw new Error(error.message);
  }
  return ((data ?? []) as { topic_main: string; topic_detail: string; sort_order: number | null }[]).map(
    (row) => ({
      topicMain: row.topic_main,
      topicDetail: row.topic_detail,
      sortOrder: row.sort_order
    })
  );
}

/** 활성 태그 전수 — 목록 화면 태그 수 표시용(§7.2 manage 사용 현황 대체, P4 편집 전 단계). */
export async function loadTopikWritingActiveQuestionTags(
  signal?: AbortSignal
): Promise<TopikWritingQuestionTagRow[]> {
  const client = requireClient();
  const { data, error } = await client
    .from('topik_writing_question_tags')
    .select('tag_assignment_id, question_id, tag_code, tag_value, assigned_at, memo')
    .eq('is_active', true);
  if (signal?.aborted) {
    throw new DOMException('Request aborted', 'AbortError');
  }
  if (error) {
    throw new Error(error.message);
  }
  return (
    (data ?? []) as {
      tag_assignment_id: number;
      question_id: string;
      tag_code: string;
      tag_value: string | null;
      assigned_at: string;
      memo: string | null;
    }[]
  ).map((row) => ({
    tagAssignmentId: row.tag_assignment_id,
    questionId: row.question_id,
    tagCode: row.tag_code,
    tagValue: row.tag_value,
    assignedAt: toDateTime(row.assigned_at),
    memo: row.memo ?? ''
  }));
}

// ---------------------------------------------------------------------------
// 검수 쓰기 — admin_update_topik_question (D-2 사전 + D-7 메모 영속 + D-8 감사).
// '__note'는 컬럼이 아니라 감사 payload.review_note로만 기록되는 예약 키다.
// ---------------------------------------------------------------------------

const REVIEW_ACTION_PATCH: Record<
  AssessmentReviewAction,
  { review_status: AssessmentReviewStatus; review_workflow_status: AssessmentReviewWorkflowStatus }
> = {
  approved: { review_status: 'approved', review_workflow_status: 'done' },
  on_hold: { review_status: 'on_hold', review_workflow_status: 'on_hold' },
  needs_revision: {
    review_status: 'needs_revision',
    review_workflow_status: 'revision_requested'
  }
};

async function callUpdateRpc(
  questionId: string,
  patch: Record<string, unknown>
): Promise<void> {
  const client = requireClient();
  const kind = itemNumberOfQuestionId(questionId);
  if (!kind) {
    throw new Error('문항 대상을 찾을 수 없습니다.');
  }
  const { error } = await client.rpc('admin_update_topik_question', {
    p_question_id: questionId,
    p_item_number: Number(kind),
    p_patch: patch
  });
  if (error) {
    throw new Error(error.message);
  }
}

export async function setTopikWritingReviewAction(
  questionId: string,
  action: AssessmentReviewAction,
  reason: string
): Promise<void> {
  await callUpdateRpc(questionId, { ...REVIEW_ACTION_PATCH[action], __note: reason });
}

export async function saveTopikWritingReviewMemo(
  questionId: string,
  memo: string
): Promise<void> {
  await callUpdateRpc(questionId, { content_team_memo: memo, __note: memo });
}
