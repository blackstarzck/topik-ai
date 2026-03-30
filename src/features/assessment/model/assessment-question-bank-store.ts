import { create } from 'zustand';

import type {
  AssessmentQuestion,
  AssessmentQuestionAuditAction,
  AssessmentQuestionAuditEvent,
  AssessmentQuestionOperationStatus,
  AssessmentQuestionReviewStatus
} from './assessment-question-bank-types';

const CURRENT_ACTOR = 'admin_current';

type UpdateReviewStatusPayload = {
  questionId: string;
  nextStatus: AssessmentQuestionReviewStatus;
  reason: string;
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
  updateOperationStatus: (
    payload: UpdateOperationStatusPayload
  ) => AssessmentQuestion | null;
};

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

const initialQuestions: AssessmentQuestion[] = [
  {
    questionId: 'AQ-51001',
    questionNumber: '51',
    topic: '안내문 빈칸 어휘 선택',
    sourceType: 'AI 자동 생성',
    generationBatchId: 'BATCH-20260329-01',
    promptVersion: 'prompt-v2.3',
    generationModel: 'writing-generator-v3',
    reviewStatus: '검수 대기',
    operationStatus: '미지정',
    validationStatus: '정상',
    validationSignals: ['보기 수 4개 확인', '정답 1개 확인'],
    usageCount: 0,
    linkedExamCount: 0,
    reviewMemo: '빈칸 주변 문맥은 자연스럽지만 distractor 난이도 확인이 필요합니다.',
    managementNote: '검수 완료 후 EPS TOPIK 편성 후보와 비교 예정',
    generatedAt: '2026-03-29 09:10',
    updatedAt: '2026-03-29 09:10',
    updatedBy: 'system_batch',
    reviewerName: '이한나',
    content: {
      kind: '51',
      instruction: '다음을 읽고 가장 알맞은 것을 고르십시오.',
      learnerPrompt:
        '도서관에서는 큰 소리로 이야기하면 안 됩니다. 다른 사람에게 피해를 줄 수 있으므로 조용히 ____.',
      choices: ['말해야 합니다', '이야기합시다', '이용해야 합니다', '이야기해야 합니다'],
      answer: '이야기해야 합니다',
      reviewPoints: ['존댓말 활용이 자연스러운지 확인', '오답 선택지가 지나치게 약하지 않은지 확인']
    }
  },
  {
    questionId: 'AQ-51002',
    questionNumber: '51',
    topic: '생활 공지문 빈칸 표현',
    sourceType: 'AI 자동 생성',
    generationBatchId: 'BATCH-20260329-01',
    promptVersion: 'prompt-v2.3',
    generationModel: 'writing-generator-v3',
    reviewStatus: '보류',
    operationStatus: '미지정',
    validationStatus: '주의',
    validationSignals: ['정답 표현과 오답 표현 간 의미 간격이 좁음'],
    usageCount: 0,
    linkedExamCount: 0,
    reviewMemo: '정답과 3번 보기가 모두 가능한 문맥으로 읽힐 수 있어 보류했습니다.',
    managementNote: '프롬프트 재생성 후보',
    generatedAt: '2026-03-29 09:11',
    updatedAt: '2026-03-29 13:20',
    updatedBy: 'admin_current',
    reviewerName: '김소연',
    content: {
      kind: '51',
      instruction: '다음을 읽고 가장 알맞은 것을 고르십시오.',
      learnerPrompt:
        '분실물은 안내 데스크에 맡겨 주시기 바랍니다. 주인을 찾을 때까지 안전하게 ____.',
      choices: ['보관됩니다', '확인합니다', '연결됩니다', '선택합니다'],
      answer: '보관됩니다',
      reviewPoints: ['수동/능동 표현이 섞이지 않는지 확인', '문장 종결 어미 일관성 확인']
    }
  },
  {
    questionId: 'AQ-52001',
    questionNumber: '52',
    topic: '짧은 설명문 연결 표현',
    sourceType: 'AI 자동 생성',
    generationBatchId: 'BATCH-20260329-02',
    promptVersion: 'prompt-v2.4',
    generationModel: 'writing-generator-v3',
    reviewStatus: '검수 중',
    operationStatus: '미지정',
    validationStatus: '정상',
    validationSignals: ['문장 길이 기준 적합', '정답 표현 빈도 기준 적합'],
    usageCount: 0,
    linkedExamCount: 0,
    reviewMemo: '연결 표현 난이도는 적절합니다. 지문 자연스러움만 추가 확인 중입니다.',
    managementNote: '검수 완료 후 바로 노출 후보 검토',
    generatedAt: '2026-03-29 10:02',
    updatedAt: '2026-03-30 09:05',
    updatedBy: 'admin_current',
    reviewerName: '박준형',
    content: {
      kind: '52',
      instruction: '다음을 읽고 이어질 말로 가장 알맞은 것을 고르십시오.',
      learnerPrompt:
        '주말마다 운동을 시작한 후부터 몸이 훨씬 가벼워졌다. 앞으로도 이 습관을 ____.',
      choices: ['이어 가고 싶다', '늦추어야 한다', '비교할 수 없다', '만족시켜야 한다'],
      answer: '이어 가고 싶다',
      reviewPoints: ['연결 표현이 52번 난이도에 맞는지 확인', '불필요한 중의성이 없는지 검토']
    }
  },
  {
    questionId: 'AQ-52002',
    questionNumber: '52',
    topic: '의견 표현 연결 문장',
    sourceType: 'AI 자동 생성',
    generationBatchId: 'BATCH-20260329-02',
    promptVersion: 'prompt-v2.4',
    generationModel: 'writing-generator-v3',
    reviewStatus: '검수 완료',
    operationStatus: '노출 후보',
    validationStatus: '정상',
    validationSignals: ['정답 1개 확인', '문항 길이 기준 적합'],
    usageCount: 3,
    linkedExamCount: 1,
    reviewMemo: '검수 완료. 보기 간 난이도 차이도 허용 범위입니다.',
    managementNote: '4월 모의고사 세트 후보',
    generatedAt: '2026-03-29 10:05',
    updatedAt: '2026-03-30 08:55',
    updatedBy: 'admin_current',
    reviewerName: '김소연',
    content: {
      kind: '52',
      instruction: '다음을 읽고 이어질 말로 가장 알맞은 것을 고르십시오.',
      learnerPrompt:
        '새로운 기술을 배울 때는 속도보다 꾸준함이 더 중요하다고 생각한다. 그래서 나는 매일 조금씩이라도 ____.',
      choices: ['연습하려고 한다', '줄어드는 편이다', '마무리된 상태다', '설명할 수도 있다'],
      answer: '연습하려고 한다',
      reviewPoints: ['1인칭 화자의 의도 표현이 자연스러운지 확인', '정답과 오답의 문법 범주 일치 확인']
    }
  },
  {
    questionId: 'AQ-53001',
    questionNumber: '53',
    topic: '도시별 자전거 이용률 그래프',
    sourceType: 'AI 자동 생성',
    generationBatchId: 'BATCH-20260329-03',
    promptVersion: 'prompt-v3.0',
    generationModel: 'writing-generator-v4',
    reviewStatus: '수정 필요',
    operationStatus: '미지정',
    validationStatus: '재검토',
    validationSignals: ['핵심 수치 1개 누락', '답안 가이드와 그래프 수치 불일치'],
    usageCount: 0,
    linkedExamCount: 0,
    reviewMemo: '그래프 설명에서 2024년 수치가 누락돼 재생성이 필요합니다.',
    managementNote: '재생성 전까지 운영 제외 유지',
    generatedAt: '2026-03-29 11:42',
    updatedAt: '2026-03-30 09:15',
    updatedBy: 'admin_current',
    reviewerName: '이한나',
    content: {
      kind: '53',
      learnerPrompt:
        '아래 그래프를 보고 자전거 이용률 변화를 200~300자로 쓰십시오.',
      chartTitle: '도시별 자전거 이용률 변화',
      sourceSummary: '서울, 부산, 대구의 2022~2024년 자전거 이용률 비교 그래프',
      keyFigures: ['서울 18% -> 24%', '부산 12% -> 19%', '대구 10% -> 15%'],
      answerGuide:
        '전체적인 증가 추세를 먼저 쓰고, 증가 폭이 가장 큰 도시와 가장 낮은 도시를 비교해 설명합니다.',
      reviewPoints: ['모든 핵심 수치가 지문과 답안 가이드에 반영됐는지 확인', '53번 분량 지시가 자연스러운지 확인']
    }
  },
  {
    questionId: 'AQ-53002',
    questionNumber: '53',
    topic: '연령대별 온라인 강의 만족도 표',
    sourceType: 'AI 자동 생성',
    generationBatchId: 'BATCH-20260329-03',
    promptVersion: 'prompt-v3.0',
    generationModel: 'writing-generator-v4',
    reviewStatus: '검수 완료',
    operationStatus: '숨김 후보',
    validationStatus: '주의',
    validationSignals: ['지시문은 적합하나 비교 포인트가 다소 단순함'],
    usageCount: 1,
    linkedExamCount: 1,
    reviewMemo: '문항은 사용 가능하지만 비교 포인트가 단순해 숨김 후보로 관리합니다.',
    managementNote: '다음 세트 편성에서는 우선순위 낮음',
    generatedAt: '2026-03-29 11:48',
    updatedAt: '2026-03-30 09:25',
    updatedBy: 'admin_current',
    reviewerName: '박준형',
    content: {
      kind: '53',
      learnerPrompt:
        '아래 표를 보고 온라인 강의 만족도 특징을 200~300자로 쓰십시오.',
      chartTitle: '연령대별 온라인 강의 만족도',
      sourceSummary: '20대, 30대, 40대의 만족/보통/불만족 비율 표',
      keyFigures: ['20대 만족 62%', '30대 만족 58%', '40대 만족 49%'],
      answerGuide:
        '만족도가 가장 높은 연령대와 가장 낮은 연령대를 비교하고, 보통 응답 비율을 보조 포인트로 정리합니다.',
      reviewPoints: ['표 설명과 답안 가이드가 일치하는지 확인', '핵심 비교 포인트가 최소 2개 이상인지 확인']
    }
  },
  {
    questionId: 'AQ-54001',
    questionNumber: '54',
    topic: '온라인 학습의 장단점 의견 제시',
    sourceType: 'AI 자동 생성',
    generationBatchId: 'BATCH-20260329-04',
    promptVersion: 'prompt-v3.1',
    generationModel: 'writing-generator-v4',
    reviewStatus: '검수 대기',
    operationStatus: '미지정',
    validationStatus: '정상',
    validationSignals: ['조건 줄 수 확인', '의견형 구조 확인'],
    usageCount: 0,
    linkedExamCount: 0,
    reviewMemo: '조건과 주제는 적절합니다. 주제 중복 여부만 확인하면 됩니다.',
    managementNote: '검수 완료 전 사용처 없음',
    generatedAt: '2026-03-29 14:15',
    updatedAt: '2026-03-29 14:15',
    updatedBy: 'system_batch',
    reviewerName: '김소연',
    content: {
      kind: '54',
      learnerPrompt:
        '다음 주제에 대해 자신의 생각을 600~700자로 쓰십시오.',
      topicPrompt: '온라인 학습이 오프라인 학습보다 효과적인 경우가 많다는 주장에 대한 자신의 의견',
      conditionLines: ['서론-본론-결론 구조 유지', '구체적인 예시 1개 이상 포함', '찬성/반대 근거를 명확히 제시'],
      outlineGuide:
        '서론에서 입장을 밝히고, 본론에서 접근성/집중도/상호작용 같은 관점을 비교한 뒤 결론에서 자신의 판단을 정리합니다.',
      reviewPoints: ['주제 범위가 과도하게 넓지 않은지 확인', '조건 줄이 평가 포인트와 중복되지 않는지 확인']
    }
  },
  {
    questionId: 'AQ-54002',
    questionNumber: '54',
    topic: '지역 축제 보존과 변화에 대한 의견',
    sourceType: 'AI 자동 생성',
    generationBatchId: 'BATCH-20260329-04',
    promptVersion: 'prompt-v3.1',
    generationModel: 'writing-generator-v4',
    reviewStatus: '검수 완료',
    operationStatus: '운영 제외',
    validationStatus: '주의',
    validationSignals: ['조건과 주제는 적합하나 최근 사용 주제와 유사'],
    usageCount: 2,
    linkedExamCount: 1,
    reviewMemo: '문항 품질은 충분하지만 최근 세트와 주제 유사도가 높아 운영 제외로 둡니다.',
    managementNote: '차기 배치 생성 시 주제 다양성 필터 강화 필요',
    generatedAt: '2026-03-29 14:18',
    updatedAt: '2026-03-30 09:40',
    updatedBy: 'admin_current',
    reviewerName: '이한나',
    content: {
      kind: '54',
      learnerPrompt:
        '다음 주제에 대해 자신의 생각을 600~700자로 쓰십시오.',
      topicPrompt: '지역 축제를 전통 그대로 유지해야 하는지, 현대적으로 바꿔야 하는지에 대한 의견',
      conditionLines: ['자신의 입장을 분명히 밝힐 것', '전통 유지와 변화의 장단점을 모두 언급할 것', '결론에서 현실적 제안을 포함할 것'],
      outlineGuide:
        '서론에서 축제의 역할을 제시하고, 본론에서 전통 보존과 현대화의 장단점을 비교한 뒤 결론에서 현실적인 절충안을 제안합니다.',
      reviewPoints: ['최근 기출/내부 세트와 주제 중복 여부 확인', '조건 줄이 실제 채점 기준과 연결되는지 확인']
    }
  }
];

const initialAudits: AssessmentQuestionAuditEvent[] = [
  {
    id: 'ASQ-AUD-0001',
    targetType: 'AssessmentQuestion',
    targetId: 'AQ-52002',
    action: 'review_completed',
    reason: '정답/오답 구성이 안정적이고 52번 난이도에 맞습니다.',
    changedBy: 'admin_current',
    createdAt: '2026-03-30 08:55'
  },
  {
    id: 'ASQ-AUD-0002',
    targetType: 'AssessmentQuestion',
    targetId: 'AQ-53002',
    action: 'operation_candidate_hidden',
    reason: '검수 품질은 통과했으나 최근 세트와 유사해 숨김 후보로 둡니다.',
    changedBy: 'admin_current',
    createdAt: '2026-03-30 09:25'
  },
  {
    id: 'ASQ-AUD-0003',
    targetType: 'AssessmentQuestion',
    targetId: 'AQ-54002',
    action: 'operation_excluded',
    reason: '기존 운영 세트와 주제 유사도가 높아 이번 회차에서는 제외합니다.',
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
