import { supabaseClient } from '../../../shared/api/supabase-client';
import type {
  AssessmentQuestionContent,
  AssessmentQuestionDetail,
  AssessmentQuestionNumber,
  AssessmentQuestionSummary
} from '../model/assessment-question-bank-types';

/**
 * LEGACY ADAPTER — 봉인된 롤백 경로 (실행계획안 2026-06-11 개정 §7.1·§12.2).
 *
 * P3 컷오버(2026-06-11) 후 P4 종료까지 보존되는 구 읽기 어댑터다.
 * v13 `problems`(question_no 51-54)를 읽어 신규 모델(AssessmentQuestionSummary/
 * Detail)로 매핑한다. 구 스키마에 소스가 없는 필드는 정직한 sentinel('' / null /
 * 빈 배열)로 남긴다 — topic 축은 폐기 예정 8값 도메인 라벨을 topicMain에
 * 임시 표기하고 topicDetail은 비운다(17주제 축은 신규 스키마에만 존재).
 * serviceStatus는 null(미지정) — 구 스키마에 물리 노출 상태가 없다.
 *
 * 검수 개념은 2026-06-11 인바운드 전환(결정 기록 §0)으로 admin에서 삭제됐다 —
 * 구 검수 쓰기 경로(admin_update_problem)는 본 어댑터에서도 제거됐다(해당
 * RPC는 v13 admin island 제거로 라이브 DB에 이미 부재). 읽기 전용 롤백 경로.
 */

type ProblemRow = {
  id: string;
  question_no: number | null;
  title: string | null;
  prompt: string | null;
  difficulty: number | null;
  topic_category_code: string | null;
  explanation: string | null;
  answer_key: unknown;
  rubric: unknown;
  created_at: string | null;
  updated_at: string | null;
};

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
    content: emptyContent(kind)
  };
}

const PROBLEM_COLUMNS =
  'id, question_no, title, prompt, difficulty, ' +
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
