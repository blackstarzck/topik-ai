import { supabaseClient } from '../../../shared/api/supabase-client';
import type {
  AssessmentQuestion,
  AssessmentQuestionContent,
  AssessmentQuestionDifficulty,
  AssessmentQuestionDomain,
  AssessmentQuestionNumber,
  AssessmentQuestionReviewStatus,
  AssessmentQuestionTypeLabel
} from '../model/assessment-question-bank-types';

/**
 * Phase C (read-first) — read the v13 writing question bank (problems, question_no
 * 51-54) as topik-ai AssessmentQuestion rows. content_admin reads `problems`
 * directly under RLS (no RPC). v13 is the schema SoT; topik-ai reconciles TO it.
 *
 * The topik-ai AssessmentQuestion is a RICHER object than v13 problems, so many
 * fields have NO v13 source and are filled with HONEST sentinels (not fabricated):
 *   domain mapped from topic_category_code via the owner-ratified code set (D-B,
 *   2026-06-08); '미분류' when the code is null/unknown. questionTypeLabel
 *   derived from the question number (TOPIK form is fixed by number), difficultyLevel
 *   '미상' for null, operationStatus '미지정' (lifecycle_status not applied yet),
 *   validationStatus '미검증', sourceType '미상', usage counts 0, generation/review
 *   metadata empty. Writes are NOT done here (review/publish = later via admin_update_problem).
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

const REVIEW_STATUS_MAP: Record<string, AssessmentQuestionReviewStatus> = {
  pending: '검수 대기',
  approved: '검수 완료',
  rejected: '수정 필요'
};

// PROPOSED ASCII workflow enum (D-C) -> topik-ai progress labels, used when set.
const WORKFLOW_STATUS_MAP: Record<string, AssessmentQuestionReviewStatus> = {
  not_started: '검수 대기',
  in_progress: '검수 중',
  on_hold: '보류',
  done: '검수 완료',
  revision_requested: '수정 필요'
};

// TOPIK 쓰기 question form is fixed by the question number (deterministic, not fabricated).
const TYPE_LABEL_BY_NUMBER: Record<AssessmentQuestionNumber, AssessmentQuestionTypeLabel> = {
  '51': '빈칸 완성',
  '52': '연결 표현',
  '53': '자료 설명',
  '54': '의견 서술'
};

function mapReview(reviewStatus: string | null, workflowStatus: string | null): AssessmentQuestionReviewStatus {
  if (workflowStatus && WORKFLOW_STATUS_MAP[workflowStatus]) {
    return WORKFLOW_STATUS_MAP[workflowStatus];
  }
  return REVIEW_STATUS_MAP[reviewStatus ?? ''] ?? '검수 대기';
}

function mapDifficulty(d: number | null): AssessmentQuestionDifficulty {
  if (d == null) return '미상';
  if (d >= 4) return '상';   // 4-5 high
  if (d === 3) return '중';  // 3 mid
  return '하';               // 1-2 low (D-G display bands)
}

// D-B: v13 problems.topic_category_code (SUBJECT axis, owner-ratified 2026-06-08) ->
// topik-ai domain label. 'uncategorized'/null/unknown -> '미분류' (honest fallback,
// not fabricated). This is the SUBJECT category, distinct from problems.domain (the
// skill area: reading/listening/writing).
const TOPIC_CATEGORY_LABEL: Record<string, AssessmentQuestionDomain> = {
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

function mapDomain(code: string | null): AssessmentQuestionDomain {
  return (code && TOPIC_CATEGORY_LABEL[code]) || '미분류';
}

function toDateTime(ts: string | null): string {
  return ts ? ts.slice(0, 16).replace('T', ' ') : '';
}

function buildContent(kind: AssessmentQuestionNumber, learnerPrompt: string): AssessmentQuestionContent {
  switch (kind) {
    case '53':
      return { kind: '53', learnerPrompt, reviewPoints: [], chartTitle: '', sourceSummary: '', keyFigures: [], answerGuide: '' };
    case '54':
      return { kind: '54', learnerPrompt, reviewPoints: [], topicPrompt: '', conditionLines: [], outlineGuide: '' };
    case '52':
      return { kind: '52', learnerPrompt, reviewPoints: [], instruction: '', choices: [], answer: '' };
    case '51':
    default:
      return { kind: '51', learnerPrompt, reviewPoints: [], instruction: '', choices: [], answer: '' };
  }
}

function modelAnswerOf(answerKey: unknown): string {
  if (answerKey && typeof answerKey === 'object' && !Array.isArray(answerKey)) {
    const text = (answerKey as Record<string, unknown>).text;
    if (typeof text === 'string') return text;
  }
  return typeof answerKey === 'string' ? answerKey : '';
}

function scoringOf(rubric: unknown): string[] {
  return Array.isArray(rubric) ? rubric.map((item) => String(item)) : [];
}

function mapRow(row: ProblemRow): AssessmentQuestion {
  const kind = String(row.question_no) as AssessmentQuestionNumber;
  const prompt = row.prompt ?? '';
  return {
    questionId: row.id,
    questionNumber: kind,
    topic: row.title ?? '',
    questionText: prompt,
    domain: mapDomain(row.topic_category_code),
    questionTypeLabel: TYPE_LABEL_BY_NUMBER[kind] ?? '빈칸 완성',
    difficultyLevel: mapDifficulty(row.difficulty),
    sourceType: '미상',
    generationBatchId: '',
    promptVersion: '',
    generationModel: '',
    reviewStatus: mapReview(row.review_status, row.review_workflow_status),
    operationStatus: '미지정',
    validationStatus: '미검증',
    validationSignals: [],
    usageCount: 0,
    linkedExamCount: 0,
    reviewMemo: '',
    managementNote: row.explanation ?? '',
    coreMeaning: '',
    keyIssue: '',
    modelAnswer: modelAnswerOf(row.answer_key),
    scoringCriteria: scoringOf(row.rubric),
    revisionHistory: [],
    generatedAt: toDateTime(row.created_at),
    updatedAt: toDateTime(row.updated_at),
    updatedBy: '',
    reviewerName: '',
    content: buildContent(kind, prompt)
  };
}

const PROBLEM_COLUMNS =
  'id, question_no, title, prompt, difficulty, review_status, review_workflow_status, ' +
  'topic_category_code, explanation, answer_key, rubric, created_at, updated_at';

export async function loadAssessmentQuestionsFromSupabase(signal?: AbortSignal): Promise<AssessmentQuestion[]> {
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
  return ((data ?? []) as unknown as ProblemRow[]).map(mapRow);
}

/**
 * Phase C (write slice) — re-read a single question after a write, so the page
 * reflects the LIVE v13 row (proves the write landed). content_admin SELECTs
 * `problems` by id directly under RLS (same path as the bulk read, no RPC).
 */
export async function loadAssessmentQuestionFromSupabase(
  questionId: string,
  signal?: AbortSignal
): Promise<AssessmentQuestion> {
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
  return mapRow(data as unknown as ProblemRow);
}

// ---------------------------------------------------------------------
// Phase C (write slice) — review status writes via the audited admin_update_problem
// RPC (content_admin only). v13 records the real auth.uid() actor + a column diff in
// admin_audit_logs; there are NO direct table writes and unknown patch keys are
// ignored server-side. topik-ai's flat 5-state review workflow maps to v13's
// review_status (FINAL curation result) + review_workflow_status (in-progress stage)
// per D-C — no 5->3 collapse. PROPOSED ASCII codes (R2) until the owner ratifies.
// ---------------------------------------------------------------------

type ProblemReviewPatch = {
  review_status?: string;
  review_workflow_status: string;
};

// topik-ai review action -> v13 patch (D-C). '보류' moves ONLY the workflow stage and
// preserves review_status (the final result) per the D-C separation; '검수 완료'/'수정
// 필요' also set the final review_status. (검수 대기/검수 중 are not actionable from the
// review page today but are mapped for completeness.)
const REVIEW_STATUS_WRITE_MAP: Record<AssessmentQuestionReviewStatus, ProblemReviewPatch> = {
  '검수 대기': { review_workflow_status: 'not_started' },
  '검수 중': { review_workflow_status: 'in_progress' },
  보류: { review_workflow_status: 'on_hold' },
  '검수 완료': { review_status: 'approved', review_workflow_status: 'done' },
  '수정 필요': { review_status: 'rejected', review_workflow_status: 'revision_requested' }
};

export async function setReviewStatusViaRpc(
  questionId: string,
  nextStatus: AssessmentQuestionReviewStatus
): Promise<void> {
  if (!supabaseClient) {
    throw new Error('Supabase client not configured');
  }
  const patch = REVIEW_STATUS_WRITE_MAP[nextStatus];
  if (!patch) {
    throw new Error(`지원하지 않는 검수 상태입니다: ${nextStatus}`);
  }
  const { error } = await supabaseClient.rpc('admin_update_problem', {
    problem_id: questionId,
    patch
  });
  if (error) {
    throw new Error(error.message);
  }
}
