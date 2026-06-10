import { supabaseClient } from '../../../shared/api/supabase-client';
import type {
  AssessmentQuestionContent,
  AssessmentQuestionDetail,
  AssessmentQuestionNumber,
  AssessmentQuestionSummary,
  AssessmentReviewAction,
  AssessmentReviewStatus,
  AssessmentReviewWorkflowStatus
} from '../model/assessment-question-bank-types';

/**
 * LEGACY ADAPTER — 봉인된 롤백 경로 (실행계획안 §7.1·§12.2).
 *
 * P3 컷오버 전 기본 경로이자 컷오버 후 P4 종료까지 보존되는 구 어댑터다.
 * v13 `problems`(question_no 51-54)를 읽어 신규 모델(AssessmentQuestionSummary/
 * Detail)로 매핑한다. 구 스키마에 소스가 없는 필드는 정직한 sentinel('' / null /
 * 빈 배열)로 남긴다 — topic 축은 폐기 예정 8값 도메인 라벨을 topicMain에
 * 임시 표기하고 topicDetail은 비운다(17주제 재분류는 신규 스키마에만 존재).
 * serviceStatus는 null(미지정) — 구 스키마에 물리 노출 상태가 없다.
 *
 * 검수 쓰기는 구 `admin_update_problem` RPC 경로를 보존한다. 단, 이 RPC는
 * v13 admin island 제거(2026-06-09)로 라이브 DB에 존재하지 않으므로 호출은
 * 서버 오류로 표면화된다(알려진 현행 제약 — P3 컷오버가 해소 경로).
 */

type ProblemRow = {
  id: string;
  question_no: number | null;
  title: string | null;
  prompt: string | null;
  difficulty: number | null;
  review_status: string | null;
  review_workflow_status: string | null;
  topic_category_code: string | null;
  explanation: string | null;
  answer_key: unknown;
  rubric: unknown;
  created_at: string | null;
  updated_at: string | null;
};

// D-2 이관 사전: pending→needs_revision+not_started, approved→approved+done,
// rejected→needs_revision+revision_requested.
const LEGACY_REVIEW_STATUS_MAP: Record<string, AssessmentReviewStatus> = {
  pending: 'needs_revision',
  approved: 'approved',
  rejected: 'needs_revision'
};

const LEGACY_WORKFLOW_DERIVED: Record<string, AssessmentReviewWorkflowStatus> = {
  pending: 'not_started',
  approved: 'done',
  rejected: 'revision_requested'
};

const WORKFLOW_VALUES: AssessmentReviewWorkflowStatus[] = [
  'not_started',
  'in_progress',
  'on_hold',
  'done',
  'revision_requested'
];

const TYPE_NAME_BY_NUMBER: Record<AssessmentQuestionNumber, string> = {
  '51': '빈칸 완성',
  '52': '연결 표현',
  '53': '자료 설명',
  '54': '의견 서술'
};

// 폐기 예정 8값 SUBJECT 축 — 롤백 모드 표시용으로만 유지(신규 17주제 축과 별개).
const TOPIC_CATEGORY_LABEL: Record<string, string> = {
  life: '생활',
  study: '학습',
  society: '사회',
  culture: '문화',
  economy: '경제',
  education: '교육',
  environment: '환경',
  technology: '기술',
  uncategorized: '미분류'
};

function toDateTime(ts: string | null): string {
  return ts ? ts.slice(0, 16).replace('T', ' ') : '';
}

function modelAnswerOf(answerKey: unknown): string {
  if (answerKey && typeof answerKey === 'object' && !Array.isArray(answerKey)) {
    const text = (answerKey as Record<string, unknown>).text;
    if (typeof text === 'string') return text;
  }
  return typeof answerKey === 'string' ? answerKey : '';
}

function mapWorkflow(row: ProblemRow): AssessmentReviewWorkflowStatus {
  if (
    row.review_workflow_status &&
    WORKFLOW_VALUES.includes(row.review_workflow_status as AssessmentReviewWorkflowStatus)
  ) {
    return row.review_workflow_status as AssessmentReviewWorkflowStatus;
  }
  return LEGACY_WORKFLOW_DERIVED[row.review_status ?? ''] ?? 'not_started';
}

function mapSummary(row: ProblemRow): AssessmentQuestionSummary {
  const kind = String(row.question_no) as AssessmentQuestionNumber;
  return {
    questionId: row.id,
    questionNumber: kind,
    targetLevel: '',
    difficultyLevel: row.difficulty,
    topicMain: (row.topic_category_code && TOPIC_CATEGORY_LABEL[row.topic_category_code]) || '미분류',
    topicDetail: '',
    speechAct: '',
    scenarioType: '',
    situationSummary: row.title ?? '',
    questionTypeName: TYPE_NAME_BY_NUMBER[kind] ?? '빈칸 완성',
    recommendationKeys: [],
    avoidRepeatKeys: [],
    reviewStatus: LEGACY_REVIEW_STATUS_MAP[row.review_status ?? ''] ?? 'needs_revision',
    reviewWorkflowStatus: mapWorkflow(row),
    serviceStatus: null,
    contentTeamMemo: '',
    createdAt: toDateTime(row.created_at),
    updatedAt: toDateTime(row.updated_at)
  };
}

function emptyContent(kind: AssessmentQuestionNumber): AssessmentQuestionContent {
  switch (kind) {
    case '52':
      return {
        kind: '52',
        completionUnit: '',
        connectionFunction: '',
        requiredExpressionFunction: '',
        clueBeforeText: '',
        clueAfterText: '',
        answerScopeType: '',
        blank1CanonicalAnswer: '',
        blank2CanonicalAnswer: '',
        scoringNotes: ''
      };
    case '53':
      return {
        kind: '53',
        dataType: '',
        dataTopic: '',
        chartTitle: '',
        chartUnit: '',
        comparisonType: '',
        changeType: '',
        interpretationDifficulty: '',
        keyFindings: [],
        requiredStructure: [],
        wordCountMin: null,
        wordCountMax: null,
        sourceData: null,
        dataAssetUrl: '',
        scoringFocus: []
      };
    case '54':
      return {
        kind: '54',
        essayType: '',
        issueTopic: '',
        promptQuestions: [],
        stanceRequirement: '',
        requiredStructure: [],
        reasoningPattern: '',
        argumentKeywords: [],
        wordCountMin: null,
        wordCountMax: null,
        scoringFocus: [],
        prohibitedElements: []
      };
    case '51':
    default: {
      const emptyBlank = {
        position: '',
        role: '',
        blankFunction: '',
        answerType: '',
        canonicalAnswer: '',
        acceptedAnswers: [],
        targetNote: ''
      };
      return { kind: '51', blankCount: null, blank1: emptyBlank, blank2: { ...emptyBlank } };
    }
  }
}

function mapDetail(row: ProblemRow): AssessmentQuestionDetail {
  const kind = String(row.question_no) as AssessmentQuestionNumber;
  return {
    ...mapSummary(row),
    secondaryTopicMain: null,
    secondaryTopicDetail: null,
    textType: '',
    learningGoalSummary: '',
    promptText: row.prompt ?? '',
    resolvedText: '',
    modelAnswer: modelAnswerOf(row.answer_key),
    autoChecksPassed: null,
    reviewPassed: null,
    content: emptyContent(kind)
  };
}

const PROBLEM_COLUMNS =
  'id, question_no, title, prompt, difficulty, review_status, review_workflow_status, ' +
  'topic_category_code, explanation, answer_key, rubric, created_at, updated_at';

export async function loadLegacySummaries(
  signal?: AbortSignal
): Promise<AssessmentQuestionSummary[]> {
  if (!supabaseClient) {
    throw new Error('Supabase client not configured');
  }
  const { data, error } = await supabaseClient
    .from('problems')
    .select(PROBLEM_COLUMNS)
    .in('question_no', [51, 52, 53, 54])
    .order('created_at', { ascending: false });
  if (signal?.aborted) {
    throw new DOMException('Request aborted', 'AbortError');
  }
  if (error) {
    throw new Error(error.message);
  }
  return ((data ?? []) as unknown as ProblemRow[]).map(mapSummary);
}

export async function loadLegacyDetail(
  questionId: string,
  signal?: AbortSignal
): Promise<AssessmentQuestionDetail> {
  if (!supabaseClient) {
    throw new Error('Supabase client not configured');
  }
  const { data, error } = await supabaseClient
    .from('problems')
    .select(PROBLEM_COLUMNS)
    .eq('id', questionId)
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
  return mapDetail(data as unknown as ProblemRow);
}

// 구 RPC 경로 보존 — 신규 액션 의미를 v13 problems enum(pending/approved/rejected)
// 으로 역매핑한다. needs_revision의 구 대응값은 rejected다(D-2 이관 사전의 역방향).
const LEGACY_REVIEW_ACTION_PATCH: Record<AssessmentReviewAction, Record<string, string>> = {
  approved: { review_status: 'approved', review_workflow_status: 'done' },
  on_hold: { review_workflow_status: 'on_hold' },
  needs_revision: { review_status: 'rejected', review_workflow_status: 'revision_requested' }
};

export async function setLegacyReviewAction(
  questionId: string,
  action: AssessmentReviewAction
): Promise<void> {
  if (!supabaseClient) {
    throw new Error('Supabase client not configured');
  }
  const { error } = await supabaseClient.rpc('admin_update_problem', {
    problem_id: questionId,
    patch: LEGACY_REVIEW_ACTION_PATCH[action]
  });
  if (error) {
    throw new Error(error.message);
  }
}
