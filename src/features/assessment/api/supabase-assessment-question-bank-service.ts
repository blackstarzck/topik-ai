import { supabaseClient } from '../../../shared/api/supabase-client';
import type {
  AssessmentQuestion,
  AssessmentQuestionContent,
  AssessmentQuestionDifficulty,
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
 *   domain '미분류' (topic_category_code unset — D-B owner-ratify), questionTypeLabel
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
    domain: '미분류',
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
    content: buildContent(kind, prompt),
    reviewDocument: null
  };
}

export async function loadAssessmentQuestionsFromSupabase(signal?: AbortSignal): Promise<AssessmentQuestion[]> {
  if (!supabaseClient) {
    throw new Error('Supabase client not configured');
  }
  const { data, error } = await supabaseClient
    .from('problems')
    .select(
      'id, question_no, title, prompt, difficulty, review_status, review_workflow_status, ' +
        'topic_category_code, explanation, answer_key, rubric, created_at, updated_at'
    )
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
