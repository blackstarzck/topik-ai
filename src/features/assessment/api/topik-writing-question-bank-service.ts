import { supabaseClient } from '../../../shared/api/supabase-client';
import type {
  AssessmentQuestionContent,
  AssessmentQuestionDetail,
  AssessmentQuestionNumber,
  AssessmentQuestionSummary,
  AssessmentServiceStatus,
  BulkServiceStatusResult,
  TopikWritingQuestionTagRow,
  TopikWritingTagMasterCatalogRow,
  TopikWritingTagMasterRow,
  TopikWritingTopicMasterCatalogRow,
  TopikWritingTopicMasterRow,
  WritingQuestionInstitutionRow
} from '../model/assessment-question-bank-types';

/**
 * 신규 스키마 어댑터 (인바운드 모델 — 결정 기록 §0): 목록은
 * `topik_writing_question_recommendation_view`(16컬럼) 1회 조회, 상세는
 * question_id의 번호로 라우팅한 번호별 테이블 조회. 쓰기는 노출 통제
 * (`service_status`) 단일이며 `admin_update_topik_question` RPC 경로다
 * (D-8 — 직접 write는 RLS 차단, 개방은 P4).
 */

const TABLE_BY_NUMBER: Record<AssessmentQuestionNumber, string> = {
  '51': 'topik_writing_51_questions',
  '52': 'topik_writing_52_questions',
  '53': 'topik_writing_53_questions',
  '54': 'topik_writing_54_questions'
};

const VIEW_COLUMNS =
  'question_id, item_number, target_level, difficulty_level, topic_main, topic_detail, ' +
  'speech_act, scenario_type, recommendation_keys, avoid_repeat_keys, ' +
  'service_status, situation_summary, question_type_name, content_team_memo, ' +
  'created_at, updated_at';

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
  service_status: string;
  situation_summary: string;
  question_type_name: string;
  content_team_memo: string | null;
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

/** 태그 값 사전 — 태그 편집 UI 옵션 축(schema-rule §2, '서비스_노출상태' 그룹은 시드 제외·D-6). */
export async function loadTopikWritingTagMaster(
  signal?: AbortSignal
): Promise<TopikWritingTagMasterRow[]> {
  const client = requireClient();
  const { data, error } = await client
    .from('topik_writing_tag_master')
    .select('tag_code, tag_name_ko, tag_group, description, usage_rule, is_active')
    .eq('is_active', true)
    .order('tag_group')
    .order('tag_code');
  if (signal?.aborted) {
    throw new DOMException('Request aborted', 'AbortError');
  }
  if (error) {
    throw new Error(error.message);
  }
  return (
    (data ?? []) as {
      tag_code: string;
      tag_name_ko: string;
      tag_group: string;
      description: string;
      usage_rule: string | null;
      is_active: boolean;
    }[]
  ).map((row) => ({
    tagCode: row.tag_code,
    tagNameKo: row.tag_name_ko,
    tagGroup: row.tag_group,
    description: row.description,
    usageRule: row.usage_rule ?? '',
    isActive: row.is_active
  }));
}

/**
 * 주제 마스터 전수(비활성 포함) — /system/metadata 마스터 카탈로그 조회 전용
 * (P5-1). 문항 필터 축용 `loadTopikWritingTopicMaster`와 달리 is_active 필터가
 * 없으며, 마스터 행 자체(출처·메모·활성 여부)를 표시한다.
 */
export async function loadTopikWritingTopicMasterCatalog(
  signal?: AbortSignal
): Promise<TopikWritingTopicMasterCatalogRow[]> {
  const client = requireClient();
  const { data, error } = await client
    .from('topik_writing_topic_master')
    .select('topic_id, topic_main, topic_detail, source_name, is_active, sort_order, memo')
    .order('sort_order', { ascending: true, nullsFirst: false })
    .order('topic_detail');
  if (signal?.aborted) {
    throw new DOMException('Request aborted', 'AbortError');
  }
  if (error) {
    throw new Error(error.message);
  }
  return (
    (data ?? []) as {
      topic_id: number;
      topic_main: string;
      topic_detail: string;
      source_name: string;
      is_active: boolean;
      sort_order: number | null;
      memo: string | null;
    }[]
  ).map((row) => ({
    topicId: row.topic_id,
    topicMain: row.topic_main,
    topicDetail: row.topic_detail,
    sourceName: row.source_name,
    isActive: row.is_active,
    sortOrder: row.sort_order,
    memo: row.memo
  }));
}

/**
 * 태그 마스터 전수(비활성·전 그룹 포함) — /system/metadata 마스터 카탈로그
 * 조회 전용(P5-1). 태그 편집 옵션용 `loadTopikWritingTagMaster`와 달리
 * is_active·그룹 필터가 없다(부여 차단은 facade·RPC가 유지 — D-6).
 */
export async function loadTopikWritingTagMasterCatalog(
  signal?: AbortSignal
): Promise<TopikWritingTagMasterCatalogRow[]> {
  const client = requireClient();
  const { data, error } = await client
    .from('topik_writing_tag_master')
    .select(
      'tag_code, tag_name_ko, tag_group, description, usage_rule, example_question_id, is_active, created_at, updated_at'
    )
    .order('tag_group')
    .order('tag_code');
  if (signal?.aborted) {
    throw new DOMException('Request aborted', 'AbortError');
  }
  if (error) {
    throw new Error(error.message);
  }
  return (
    (data ?? []) as {
      tag_code: string;
      tag_name_ko: string;
      tag_group: string;
      description: string;
      usage_rule: string | null;
      example_question_id: string | null;
      is_active: boolean;
      created_at: string | null;
      updated_at: string | null;
    }[]
  ).map((row) => ({
    tagCode: row.tag_code,
    tagNameKo: row.tag_name_ko,
    tagGroup: row.tag_group,
    description: row.description,
    usageRule: row.usage_rule ?? '',
    exampleQuestionId: row.example_question_id,
    isActive: row.is_active,
    updatedAt: toDateTime(row.updated_at ?? row.created_at)
  }));
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
// 노출 통제 쓰기 — admin_update_topik_question (D-6/D-8 개정: service_status
// 단일 화이트리스트). '__note'는 컬럼이 아니라 감사 payload.note로만 기록되는
// 예약 키다. facade의 P4 게이트가 열리기 전까지 호출되지 않는다.
// ---------------------------------------------------------------------------

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

export async function setTopikWritingServiceStatus(
  questionId: string,
  nextStatus: AssessmentServiceStatus,
  reason: string
): Promise<void> {
  await callUpdateRpc(questionId, { service_status: nextStatus, __note: reason });
}

// ---------------------------------------------------------------------------
// 운영 조치 일괄 처리 — admin_bulk_set_writing_question_service_status (0005).
// 선택 문항 N건을 한 번의 RPC 왕복으로 변경. 문항별 격리·멱등·노출 게이트·감사
// (batch_id 묶음)는 전부 RPC 내장. 결과 jsonb를 camelCase 모델로 매핑한다.
// ---------------------------------------------------------------------------

function mapBulkResult(data: unknown): BulkServiceStatusResult {
  const row = (data ?? {}) as Record<string, unknown>;
  const rawDetails = Array.isArray(row.details) ? row.details : [];
  return {
    total: Number(row.total ?? 0),
    changed: Number(row.changed ?? 0),
    unchanged: Number(row.unchanged ?? 0),
    blocked: Number(row.blocked ?? 0),
    failed: Number(row.failed ?? 0),
    batchId: typeof row.batch_id === 'string' ? row.batch_id : '',
    details: rawDetails.map((entry) => {
      const detail = (entry ?? {}) as Record<string, unknown>;
      return {
        questionId: typeof detail.question_id === 'string' ? detail.question_id : '',
        kind: detail.kind === 'blocked' ? 'blocked' : 'failed',
        message: typeof detail.message === 'string' ? detail.message : ''
      };
    })
  };
}

export async function setTopikWritingServiceStatusBulk(
  questionIds: string[],
  nextStatus: AssessmentServiceStatus,
  reason: string
): Promise<BulkServiceStatusResult> {
  const client = requireClient();
  const { data, error } = await client.rpc(
    'admin_bulk_set_writing_question_service_status',
    {
      p_question_ids: questionIds,
      p_next_status: nextStatus,
      p_reason: reason
    }
  );
  if (error) {
    throw new Error(error.message);
  }
  return mapBulkResult(data);
}

// ---------------------------------------------------------------------------
// 태그 부여/제거 — admin_assign/remove_question_tag (P4 관리 포인트, D-8).
// 사전 존재·활성, '서비스_노출상태' 그룹 차단(D-6), (question_id, item_number)
// 합성 참조 검증, 중복 활성 부여 차단 가드는 전부 RPC에 내장돼 있다.
// 감사: tag_assigned / tag_removed + 사유는 question_tags.memo·payload.tag_memo.
// ---------------------------------------------------------------------------

export async function assignTopikWritingQuestionTag(
  questionId: string,
  tagCode: string,
  memo: string
): Promise<void> {
  const client = requireClient();
  const kind = itemNumberOfQuestionId(questionId);
  if (!kind) {
    throw new Error('문항 대상을 찾을 수 없습니다.');
  }
  const { error } = await client.rpc('admin_assign_question_tag', {
    p_question_id: questionId,
    p_item_number: Number(kind),
    p_tag_code: tagCode,
    p_memo: memo
  });
  if (error) {
    throw new Error(error.message);
  }
}

export async function removeTopikWritingQuestionTag(
  tagAssignmentId: number,
  memo: string
): Promise<void> {
  const client = requireClient();
  const { error } = await client.rpc('admin_remove_question_tag', {
    p_tag_assignment_id: tagAssignmentId,
    p_memo: memo
  });
  if (error) {
    throw new Error(error.message);
  }
}

// ---------------------------------------------------------------------------
// 태그 마스터 활성/비활성 — admin_update_tag_master_status (P5-3, 0014).
// 가드는 전부 RPC 내장: platform_admin(문항 RPC의 content_admin보다 상위),
// 사유 필수, 미존재·무변경 토글 거부. 감사: tag_master_status_changed +
// target_table='AssessmentTagMaster', target_id=tag_code, payload.note.
// ---------------------------------------------------------------------------

export async function setTopikWritingTagMasterStatus(
  tagCode: string,
  nextActive: boolean,
  note: string
): Promise<void> {
  const client = requireClient();
  const { error } = await client.rpc('admin_update_tag_master_status', {
    p_tag_code: tagCode,
    p_next_active: nextActive,
    p_note: note
  });
  if (error) {
    throw new Error(error.message);
  }
}

// ---------------------------------------------------------------------------
// 기관별 노출 매핑 — admin_set/clear/list_writing_question_institutions.
// 공개 기본 + 기관 한정: 매핑 행이 있는 문항은 해당 기관 회원에게만 노출된다.
// set 은 set-semantics(전달 코드 집합 = 그 문항의 최종 허용 집합), 문항별 격리·멱등·
// self-verify·감사(batch_id 묶음)는 RPC 내장. 결과 jsonb 는 mapBulkResult 재사용 매핑.
// ---------------------------------------------------------------------------

type QuestionInstitutionRpcRow = {
  question_id: string;
  item_number: number;
  institution_code: string;
  institution_label: string | null;
  institution_status: string | null;
  reason: string | null;
  created_at: string | null;
};

export async function loadTopikWritingQuestionInstitutions(
  questionId?: string,
  signal?: AbortSignal
): Promise<WritingQuestionInstitutionRow[]> {
  const client = requireClient();
  const { data, error } = await client.rpc('admin_list_writing_question_institutions', {
    p_question_id: questionId ?? null
  });
  if (signal?.aborted) {
    throw new DOMException('Request aborted', 'AbortError');
  }
  if (error) {
    throw new Error(error.message);
  }
  return ((data ?? []) as QuestionInstitutionRpcRow[]).map((row) => ({
    questionId: row.question_id,
    itemNumber: row.item_number,
    institutionCode: row.institution_code,
    institutionLabel: row.institution_label ?? row.institution_code,
    institutionStatus: row.institution_status ?? '',
    reason: row.reason ?? '',
    createdAt: toDateTime(row.created_at)
  }));
}

export async function setTopikWritingQuestionInstitutions(
  questionIds: string[],
  institutionCodes: string[],
  reason: string
): Promise<BulkServiceStatusResult> {
  const client = requireClient();
  const { data, error } = await client.rpc('admin_set_writing_question_institutions', {
    p_question_ids: questionIds,
    p_institution_codes: institutionCodes,
    p_reason: reason
  });
  if (error) {
    throw new Error(error.message);
  }
  return mapBulkResult(data);
}

export async function clearTopikWritingQuestionInstitutions(
  questionIds: string[],
  reason: string
): Promise<BulkServiceStatusResult> {
  const client = requireClient();
  const { data, error } = await client.rpc('admin_clear_writing_question_institutions', {
    p_question_ids: questionIds,
    p_reason: reason
  });
  if (error) {
    throw new Error(error.message);
  }
  return mapBulkResult(data);
}
