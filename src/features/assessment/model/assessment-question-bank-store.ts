import { create } from 'zustand';

import {
  assessmentQuestionSeedEntries,
  getAssessmentQuestionPromptText,
  getAssessmentQuestionSeed
} from './assessment-question-prompt-fixture';
import type {
  AssessmentQuestion,
  AssessmentQuestionAuditAction,
  AssessmentQuestionAuditEvent,
  AssessmentQuestionContent,
  AssessmentQuestionDifficulty,
  AssessmentQuestionOperationStatus,
  AssessmentQuestionReviewDocument,
  AssessmentQuestionReviewStatus,
  AssessmentQuestionRevisionHistoryItem
} from './assessment-question-bank-types';

const CURRENT_ACTOR = 'admin_current';

type UpdateReviewStatusPayload = {
  questionId: string;
  nextStatus: AssessmentQuestionReviewStatus;
  reason: string;
};

type UpdateReviewMemoPayload = {
  questionId: string;
  reviewMemo: string;
};

type UpdateOperationStatusPayload = {
  questionId: string;
  nextStatus: AssessmentQuestionOperationStatus;
  reason: string;
};

type AssessmentQuestionBankStore = {
  questions: AssessmentQuestion[];
  audits: AssessmentQuestionAuditEvent[];
  updateReviewStatus: (
    payload: UpdateReviewStatusPayload
  ) => AssessmentQuestion | null;
  updateReviewMemo: (
    payload: UpdateReviewMemoPayload
  ) => AssessmentQuestion | null;
  updateOperationStatus: (
    payload: UpdateOperationStatusPayload
  ) => AssessmentQuestion | null;
};

type AssessmentQuestionMockDefinition = Omit<AssessmentQuestion, 'questionText'>;

type AssessmentQuestionSeedBackedFields = Pick<
  AssessmentQuestionMockDefinition,
  | 'topic'
  | 'domain'
  | 'difficultyLevel'
  | 'reviewMemo'
  | 'managementNote'
  | 'coreMeaning'
  | 'keyIssue'
  | 'modelAnswer'
  | 'scoringCriteria'
  | 'revisionHistory'
  | 'generatedAt'
  | 'updatedAt'
  | 'updatedBy'
  | 'reviewerName'
  | 'reviewDocument'
>;

function formatNow(date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');

  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

function createAuditId(audits: AssessmentQuestionAuditEvent[]): string {
  const nextSequence =
    audits
      .map((audit) => Number(audit.id.replace('ASQ-AUD-', '')))
      .reduce((max, value) => Math.max(max, value), 0) + 1;

  return `ASQ-AUD-${String(nextSequence).padStart(4, '0')}`;
}

function mapReviewAction(
  status: AssessmentQuestionReviewStatus
): AssessmentQuestionAuditAction {
  if (status === '검수 완료') {
    return 'review_completed';
  }

  if (status === '보류') {
    return 'review_on_hold';
  }

  return 'review_revision_requested';
}

function mapOperationAction(
  status: AssessmentQuestionOperationStatus
): AssessmentQuestionAuditAction {
  if (status === '노출 후보') {
    return 'operation_candidate_exposed';
  }

  if (status === '숨김 후보') {
    return 'operation_candidate_hidden';
  }

  return 'operation_excluded';
}

function formatReviewDocumentDateTime(value: string): string {
  return value.slice(0, 16).replace('T', ' ');
}

function mapReviewDocumentRevisionHistory(
  questionId: string,
  reviewDocument: AssessmentQuestionReviewDocument
): AssessmentQuestionRevisionHistoryItem[] {
  return reviewDocument.edit_history.map((item, index) => ({
    id: `${questionId}-REV-${String(index + 1).padStart(3, '0')}`,
    changedAt: item.edited_at,
    changedBy: item.edited_by,
    summary: item.summary
  }));
}

function getFallbackQuestionText(content: AssessmentQuestionContent): string {
  if (content.kind === '54') {
    return `${content.learnerPrompt} ${content.topicPrompt}`.trim();
  }

  return content.learnerPrompt;
}

function getTrimmedText(value: string | null | undefined): string {
  return value?.trim() ?? '';
}

function isNonEmptyText(value: string | null | undefined): value is string {
  return getTrimmedText(value).length > 0;
}

function mapSeedDifficulty(value: number | null | undefined): AssessmentQuestionDifficulty {
  if ((value ?? 0) >= 6) {
    return '상';
  }

  if ((value ?? 0) >= 4) {
    return '중';
  }

  return '하';
}

function buildSeedBackedFields(questionId: string): AssessmentQuestionSeedBackedFields {
  const seed = getAssessmentQuestionSeed(questionId);
  const latestEdit = seed?.edit_history.at(-1);

  return {
    topic: getTrimmedText(seed?.approved_topic_seed.topic_seed_title),
    domain: getTrimmedText(seed?.meta.domain) as AssessmentQuestionMockDefinition['domain'],
    difficultyLevel: mapSeedDifficulty(seed?.meta.difficulty),
    reviewMemo: getTrimmedText(seed?.review_memo),
    managementNote: getTrimmedText(seed?.approved_topic_seed.why_exam_worthy),
    coreMeaning: getTrimmedText(seed?.context_notes.row1_value),
    keyIssue: getTrimmedText(seed?.context_notes.row2_value),
    modelAnswer: getTrimmedText(seed?.model_answer),
    scoringCriteria: [
      seed?.rubric.content,
      seed?.rubric.language,
      seed?.rubric.structure
    ].filter(isNonEmptyText),
    revisionHistory: seed ? mapReviewDocumentRevisionHistory(questionId, seed) : [],
    generatedAt: seed ? formatReviewDocumentDateTime(seed.created_at) : '',
    updatedAt: getTrimmedText(
      latestEdit?.edited_at ??
        (seed ? formatReviewDocumentDateTime(seed.created_at) : '')
    ),
    updatedBy: getTrimmedText(latestEdit?.edited_by),
    reviewerName: '',
    reviewDocument: seed
  };
}

function buildGeneratedQuestionDefinition(
  questionId: string
): AssessmentQuestionMockDefinition {
  const seed = getAssessmentQuestionSeed(questionId);

  return {
    questionId,
    questionNumber: '53',
    ...buildSeedBackedFields(questionId),
    questionTypeLabel: '자료 설명',
    sourceType: 'AI 자동 생성',
    generationBatchId: '',
    promptVersion: '',
    generationModel: '',
    reviewStatus: seed?.review_passed ? '검수 완료' : '검수 대기',
    operationStatus: '미지정',
    validationStatus: seed?.meta.inference_gap ? '주의' : '정상',
    validationSignals: [],
    usageCount: 0,
    linkedExamCount: 0,
    content: {
      kind: '53',
      learnerPrompt: '',
      chartTitle: '',
      sourceSummary: '',
      keyFigures: [],
      answerGuide: '',
      reviewPoints: []
    }
  };
}

const reviewDocument54001 = getAssessmentQuestionSeed('AQ-54001');
const reviewDocument54002 = getAssessmentQuestionSeed('AQ-54002');

if (!reviewDocument54001 || !reviewDocument54002) {
  throw new Error('Assessment question seed fixture is missing required 54형 문항.');
}

const pinnedQuestionDefinitions: AssessmentQuestionMockDefinition[] = [
  {
    questionId: 'AQ-51001',
    questionNumber: '53',
    ...buildSeedBackedFields('AQ-51001'),
    questionTypeLabel: '빈칸 완성',
    sourceType: 'AI 자동 생성',
    generationBatchId: '',
    promptVersion: '',
    generationModel: '',
    reviewStatus: '검수 대기',
    operationStatus: '미지정',
    validationStatus: '정상',
    validationSignals: ['보기 수 4개 확인', '정답 1개 확인'],
    usageCount: 0,
    linkedExamCount: 0,
    content: {
      kind: '51',
      instruction: '',
      learnerPrompt: '',
      choices: [],
      answer: '',
      reviewPoints: []
    }
  },
  {
    questionId: 'AQ-51002',
    questionNumber: '53',
    ...buildSeedBackedFields('AQ-51002'),
    questionTypeLabel: '빈칸 완성',
    sourceType: 'AI 자동 생성',
    generationBatchId: '',
    promptVersion: '',
    generationModel: '',
    reviewStatus: '보류',
    operationStatus: '미지정',
    validationStatus: '주의',
    validationSignals: ['정답 표현과 오답 표현 간격이 좁음'],
    usageCount: 0,
    linkedExamCount: 0,
    content: {
      kind: '51',
      instruction: '',
      learnerPrompt: '',
      choices: [],
      answer: '',
      reviewPoints: []
    }
  },
  {
    questionId: 'AQ-52001',
    questionNumber: '53',
    ...buildSeedBackedFields('AQ-52001'),
    questionTypeLabel: '연결 표현',
    sourceType: 'AI 자동 생성',
    generationBatchId: '',
    promptVersion: '',
    generationModel: '',
    reviewStatus: '검수 중',
    operationStatus: '미지정',
    validationStatus: '정상',
    validationSignals: ['문장 길이 기준 적합', '정답 표현 빈도 기준 적합'],
    usageCount: 0,
    linkedExamCount: 0,
    content: {
      kind: '52',
      instruction: '',
      learnerPrompt: '',
      choices: [],
      answer: '',
      reviewPoints: []
    }
  },
  {
    questionId: 'AQ-52002',
    questionNumber: '53',
    ...buildSeedBackedFields('AQ-52002'),
    questionTypeLabel: '연결 표현',
    sourceType: 'AI 자동 생성',
    generationBatchId: '',
    promptVersion: '',
    generationModel: '',
    reviewStatus: '검수 완료',
    operationStatus: '노출 후보',
    validationStatus: '정상',
    validationSignals: ['정답 1개 확인', '문항 길이 기준 적합'],
    usageCount: 3,
    linkedExamCount: 1,
    content: {
      kind: '52',
      instruction: '',
      learnerPrompt: '',
      choices: [],
      answer: '',
      reviewPoints: []
    }
  },
  {
    questionId: 'AQ-53001',
    questionNumber: '53',
    ...buildSeedBackedFields('AQ-53001'),
    questionTypeLabel: '자료 설명',
    sourceType: 'AI 자동 생성',
    generationBatchId: '',
    promptVersion: '',
    generationModel: '',
    reviewStatus: '수정 필요',
    operationStatus: '미지정',
    validationStatus: '재검토',
    validationSignals: ['핵심 수치 1개 누락', '답안 가이드와 그래프 수치 불일치'],
    usageCount: 0,
    linkedExamCount: 0,
    content: {
      kind: '53',
      learnerPrompt: '',
      chartTitle: '',
      sourceSummary: '',
      keyFigures: [],
      answerGuide: '',
      reviewPoints: []
    }
  },
  {
    questionId: 'AQ-53002',
    questionNumber: '53',
    ...buildSeedBackedFields('AQ-53002'),
    questionTypeLabel: '자료 설명',
    sourceType: 'AI 자동 생성',
    generationBatchId: '',
    promptVersion: '',
    generationModel: '',
    reviewStatus: '검수 완료',
    operationStatus: '숨김 후보',
    validationStatus: '주의',
    validationSignals: ['지시문은 적합하나 비교 사례가 다소 단순함'],
    usageCount: 1,
    linkedExamCount: 1,
    content: {
      kind: '53',
      learnerPrompt: '',
      chartTitle: '',
      sourceSummary: '',
      keyFigures: [],
      answerGuide: '',
      reviewPoints: []
    }
  },
  {
    questionId: 'AQ-54001',
    questionNumber: '53',
    ...buildSeedBackedFields('AQ-54001'),
    questionTypeLabel: '의견 서술',
    sourceType: 'AI 자동 생성',
    generationBatchId: '',
    promptVersion: '',
    generationModel: '',
    reviewStatus: '검수 대기',
    operationStatus: '미지정',
    validationStatus: '정상',
    validationSignals: ['조건 수 3개 확인', '서술형 구조 확인'],
    usageCount: 0,
    linkedExamCount: 0,
    content: {
      kind: '54',
      learnerPrompt: getAssessmentQuestionPromptText('AQ-54001') ?? '',
      topicPrompt: reviewDocument54001.approved_topic_seed.topic_seed_title,
      conditionLines: [
        reviewDocument54001.scenario_logic.chart_a_focus,
        reviewDocument54001.scenario_logic.chart_b_focus,
        reviewDocument54001.scenario_logic.cross_chart_bridge
      ],
      outlineGuide: reviewDocument54001.scenario_logic.writing_reason,
      reviewPoints: [
        reviewDocument54001.context_notes.cause,
        reviewDocument54001.context_notes.status
      ]
    }
  },
  {
    questionId: 'AQ-54002',
    questionNumber: '53',
    ...buildSeedBackedFields('AQ-54002'),
    questionTypeLabel: '의견 서술',
    sourceType: 'AI 자동 생성',
    generationBatchId: '',
    promptVersion: '',
    generationModel: '',
    reviewStatus: '검수 완료',
    operationStatus: '운영 제외',
    validationStatus: '주의',
    validationSignals: ['조건과 주제는 적합하나 최근 사용 주제와 유사'],
    usageCount: 2,
    linkedExamCount: 1,
    content: {
      kind: '54',
      learnerPrompt: getAssessmentQuestionPromptText('AQ-54002') ?? '',
      topicPrompt: reviewDocument54002.approved_topic_seed.topic_seed_title,
      conditionLines: [
        reviewDocument54002.scenario_logic.chart_a_focus,
        reviewDocument54002.scenario_logic.chart_b_focus,
        reviewDocument54002.scenario_logic.cross_chart_bridge
      ],
      outlineGuide: reviewDocument54002.scenario_logic.writing_reason,
      reviewPoints: [
        reviewDocument54002.context_notes.cause,
        reviewDocument54002.context_notes.status
      ]
    }
  }
];

const pinnedQuestionIds = new Set(
  pinnedQuestionDefinitions.map((question) => question.questionId)
);

const generatedQuestionDefinitions: AssessmentQuestionMockDefinition[] =
  assessmentQuestionSeedEntries
    .filter(({ questionId }) => !pinnedQuestionIds.has(questionId))
    .map(({ questionId }) => buildGeneratedQuestionDefinition(questionId));

const initialQuestionDefinitions: AssessmentQuestionMockDefinition[] = [
  ...pinnedQuestionDefinitions,
  ...generatedQuestionDefinitions
];

const initialQuestions: AssessmentQuestion[] = initialQuestionDefinitions.map((question) => ({
  ...question,
  questionText:
    getAssessmentQuestionPromptText(question.questionId) ??
    getFallbackQuestionText(question.content)
}));

const initialAudits: AssessmentQuestionAuditEvent[] = [
  {
    id: 'ASQ-AUD-0001',
    targetType: 'AssessmentQuestion',
    targetId: 'AQ-52002',
    action: 'review_completed',
    reason: '정답·오답 구성이 안정적이고 52번 유형에 맞습니다.',
    changedBy: 'admin_current',
    createdAt: '2026-03-30 08:55'
  },
  {
    id: 'ASQ-AUD-0002',
    targetType: 'AssessmentQuestion',
    targetId: 'AQ-53002',
    action: 'operation_candidate_hidden',
    reason: '검수는 통과했으나 최근 세트와 유사해 숨김 후보로 둡니다.',
    changedBy: 'admin_current',
    createdAt: '2026-03-30 09:25'
  },
  {
    id: 'ASQ-AUD-0003',
    targetType: 'AssessmentQuestion',
    targetId: 'AQ-54002',
    action: 'operation_excluded',
    reason: '기존 운영 세트와 주제 유사도가 높아 이번 편성에서는 제외합니다.',
    changedBy: 'admin_current',
    createdAt: '2026-03-30 09:40'
  }
];

export const useAssessmentQuestionBankStore = create<AssessmentQuestionBankStore>(
  (set) => ({
    questions: initialQuestions,
    audits: initialAudits,
    updateReviewStatus: ({ questionId, nextStatus, reason }) => {
      let updatedQuestion: AssessmentQuestion | null = null;

      set((state) => {
        const nextQuestions = state.questions.map((question) => {
          if (question.questionId !== questionId) {
            return question;
          }

          updatedQuestion = {
            ...question,
            reviewStatus: nextStatus,
            reviewDocument: question.reviewDocument
              ? {
                  ...question.reviewDocument,
                  review_passed: nextStatus === '검수 완료'
                }
              : null,
            updatedAt: formatNow(),
            updatedBy: CURRENT_ACTOR
          };

          return updatedQuestion;
        });

        if (!updatedQuestion) {
          return state;
        }

        const audit: AssessmentQuestionAuditEvent = {
          id: createAuditId(state.audits),
          targetType: 'AssessmentQuestion',
          targetId: questionId,
          action: mapReviewAction(nextStatus),
          reason,
          changedBy: CURRENT_ACTOR,
          createdAt: formatNow()
        };

        return {
          questions: nextQuestions,
          audits: [audit, ...state.audits]
        };
      });

      return updatedQuestion;
    },
    updateReviewMemo: ({ questionId, reviewMemo }) => {
      let updatedQuestion: AssessmentQuestion | null = null;

      set((state) => {
        const nextQuestions = state.questions.map((question) => {
          if (question.questionId !== questionId) {
            return question;
          }

          updatedQuestion = {
            ...question,
            reviewMemo,
            reviewDocument: question.reviewDocument
              ? {
                  ...question.reviewDocument,
                  review_memo: reviewMemo
                }
              : null,
            updatedAt: formatNow(),
            updatedBy: CURRENT_ACTOR
          };

          return updatedQuestion;
        });

        if (!updatedQuestion) {
          return state;
        }

        const audit: AssessmentQuestionAuditEvent = {
          id: createAuditId(state.audits),
          targetType: 'AssessmentQuestion',
          targetId: questionId,
          action: 'review_memo_saved',
          reason: reviewMemo,
          changedBy: CURRENT_ACTOR,
          createdAt: formatNow()
        };

        return {
          questions: nextQuestions,
          audits: [audit, ...state.audits]
        };
      });

      return updatedQuestion;
    },
    updateOperationStatus: ({ questionId, nextStatus, reason }) => {
      let updatedQuestion: AssessmentQuestion | null = null;

      set((state) => {
        const nextQuestions = state.questions.map((question) => {
          if (question.questionId !== questionId) {
            return question;
          }

          updatedQuestion = {
            ...question,
            operationStatus: nextStatus,
            updatedAt: formatNow(),
            updatedBy: CURRENT_ACTOR
          };

          return updatedQuestion;
        });

        if (!updatedQuestion) {
          return state;
        }

        const audit: AssessmentQuestionAuditEvent = {
          id: createAuditId(state.audits),
          targetType: 'AssessmentQuestion',
          targetId: questionId,
          action: mapOperationAction(nextStatus),
          reason,
          changedBy: CURRENT_ACTOR,
          createdAt: formatNow()
        };

        return {
          questions: nextQuestions,
          audits: [audit, ...state.audits]
        };
      });

      return updatedQuestion;
    }
  })
);
