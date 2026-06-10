import type {
  AssessmentQuestionDetail,
  AssessmentQuestionSummary,
  AssessmentReviewAction,
  AssessmentReviewStatus,
  AssessmentReviewWorkflowStatus,
  TopikWritingQuestionTagRow,
  TopikWritingTopicMasterRow
} from '../model/assessment-question-bank-types';

/**
 * D-12 모크 모드 (CI/스모크): Supabase가 구성되지 않은 실행에서 화면·e2e가
 * 결정적 픽스처로 동작하도록 하는 인메모리 어댑터다. 검수 액션·메모 저장은
 * 모듈 메모리를 변조해 RT-4형 왕복(쓰기→재조회 반영)을 화면 수준에서 재현한다.
 * 실DB·감사 로그에는 아무것도 쓰지 않으며, 페이지는 모크 모드 배너를 띄운다.
 */

const REVIEW_DEFAULT: {
  reviewStatus: AssessmentReviewStatus;
  reviewWorkflowStatus: AssessmentReviewWorkflowStatus;
} = { reviewStatus: 'needs_revision', reviewWorkflowStatus: 'not_started' };

const mockDetails: AssessmentQuestionDetail[] = [
  {
    questionId: 'topik-writing-51-9901',
    questionNumber: '51',
    targetLevel: 'TOPIK 3급',
    difficultyLevel: 3,
    topicMain: '교육',
    topicDetail: '학교생활',
    speechAct: '안내',
    scenarioType: '공지문',
    situationSummary: '[모크] 도서관 이용 시간 변경을 알리는 학교 공지문',
    questionTypeName: '빈칸 완성',
    recommendationKeys: ['topic:교육', 'type:writing_51_blank_completion'],
    avoidRepeatKeys: ['scenario:공지문'],
    ...REVIEW_DEFAULT,
    serviceStatus: 'internal_test',
    contentTeamMemo: '',
    createdAt: '2026-06-10 09:00',
    updatedAt: '2026-06-10 09:00',
    secondaryTopicMain: null,
    secondaryTopicDetail: null,
    textType: '실용문',
    learningGoalSummary: '맥락에 맞는 종결 표현 완성',
    promptText:
      '도서관에서 안내 말씀드립니다. 다음 주부터 시험 기간이라서 이용 시간을 ( ㄱ ). 책을 빌리고 싶은 학생은 ( ㄴ ).',
    resolvedText:
      '도서관에서 안내 말씀드립니다. 다음 주부터 시험 기간이라서 이용 시간을 연장합니다. 책을 빌리고 싶은 학생은 학생증을 가져오시기 바랍니다.',
    modelAnswer: 'ㄱ: 연장합니다 / ㄴ: 학생증을 가져오시기 바랍니다',
    autoChecksPassed: true,
    reviewPassed: null,
    content: {
      kind: '51',
      blankCount: 2,
      blank1: {
        position: 'ㄱ',
        role: '핵심 정보 제시',
        blankFunction: '변경 내용 안내',
        answerType: '종결 표현',
        canonicalAnswer: '연장합니다',
        acceptedAnswers: ['연장합니다', '늘립니다'],
        targetNote: ''
      },
      blank2: {
        position: 'ㄴ',
        role: '행동 요청',
        blankFunction: '준비물 안내',
        answerType: '요청 표현',
        canonicalAnswer: '학생증을 가져오시기 바랍니다',
        acceptedAnswers: ['학생증을 가져오시기 바랍니다'],
        targetNote: ''
      }
    }
  },
  {
    questionId: 'topik-writing-52-9901',
    questionNumber: '52',
    targetLevel: 'TOPIK 4급',
    difficultyLevel: 4,
    topicMain: '건강',
    topicDetail: '질병과 증상',
    speechAct: '설명',
    scenarioType: '설명문',
    situationSummary: '[모크] 충분한 수면이 건강에 미치는 영향을 설명하는 글',
    questionTypeName: '연결 표현',
    recommendationKeys: ['topic:건강', 'type:writing_52_sentence_completion'],
    avoidRepeatKeys: ['scenario:설명문'],
    ...REVIEW_DEFAULT,
    serviceStatus: 'internal_test',
    contentTeamMemo: '',
    createdAt: '2026-06-10 09:00',
    updatedAt: '2026-06-10 09:00',
    secondaryTopicMain: null,
    secondaryTopicDetail: null,
    textType: '설명문',
    learningGoalSummary: '조건·결과 연결 표현 완성',
    promptText:
      '잠이 부족하면 집중력이 떨어진다. 따라서 건강을 ( ㄱ ) 충분히 자야 한다. 왜냐하면 잠은 피로를 풀어 주기 ( ㄴ ).',
    resolvedText:
      '잠이 부족하면 집중력이 떨어진다. 따라서 건강을 지키려면 충분히 자야 한다. 왜냐하면 잠은 피로를 풀어 주기 때문이다.',
    modelAnswer: 'ㄱ: 지키려면 / ㄴ: 때문이다',
    autoChecksPassed: true,
    reviewPassed: null,
    content: {
      kind: '52',
      completionUnit: '구',
      connectionFunction: '조건 제시',
      requiredExpressionFunction: '이유 설명',
      clueBeforeText: '따라서 건강을 ( ㄱ ) 충분히 자야 한다.',
      clueAfterText: '왜냐하면 잠은 피로를 풀어 주기 ( ㄴ ).',
      answerScopeType: '유사표현 허용형',
      blank1CanonicalAnswer: '지키려면',
      blank2CanonicalAnswer: '때문이다',
      scoringNotes: '연결 어미의 기능 일치 여부를 우선 평가'
    }
  },
  {
    questionId: 'topik-writing-53-9901',
    questionNumber: '53',
    targetLevel: 'TOPIK 4급',
    difficultyLevel: 4,
    topicMain: '사회',
    topicDetail: '사회 문제',
    speechAct: '설명',
    scenarioType: '자료 제시형',
    situationSummary: '[모크] 1인 가구 비율 변화를 나타낸 그래프 설명 과제',
    questionTypeName: '자료 설명',
    recommendationKeys: ['topic:사회', 'data:선그래프'],
    avoidRepeatKeys: ['data_topic:1인 가구'],
    ...REVIEW_DEFAULT,
    serviceStatus: 'internal_test',
    contentTeamMemo: '',
    createdAt: '2026-06-10 09:00',
    updatedAt: '2026-06-10 09:00',
    secondaryTopicMain: null,
    secondaryTopicDetail: null,
    textType: '설명문',
    learningGoalSummary: '수치 비교·추세 기술',
    promptText:
      '다음은 1인 가구 비율의 변화를 나타낸 그래프이다. 이 내용을 200~300자로 쓰시오. 단, 글의 제목을 쓰지 마시오.',
    resolvedText: '',
    modelAnswer: '',
    autoChecksPassed: true,
    reviewPassed: null,
    content: {
      kind: '53',
      dataType: '선그래프',
      dataTopic: '1인 가구 비율 변화',
      chartTitle: '연도별 1인 가구 비율',
      chartUnit: '%',
      comparisonType: '전후 비교',
      changeType: '증가',
      interpretationDifficulty: '단순 비교',
      keyFindings: ['2010년 23%에서 2025년 35%로 증가'],
      requiredStructure: ['도입', '비교', '마무리'],
      wordCountMin: 200,
      wordCountMax: 300,
      sourceData: {
        chart_a: {
          title: '연도별 1인 가구 비율',
          unit: '%',
          year_range: ['2010', '2015', '2020', '2025'],
          series: [{ name: '1인 가구 비율', values: [23, 27, 31, 35] }]
        }
      },
      dataAssetUrl: '',
      scoringFocus: ['수치 인용 정확성', '추세 표현']
    }
  },
  {
    questionId: 'topik-writing-54-9901',
    questionNumber: '54',
    targetLevel: 'TOPIK 5급',
    difficultyLevel: 5,
    topicMain: '사회',
    topicDetail: '대중 매체',
    speechAct: '주장',
    scenarioType: '의견 제시형',
    situationSummary: '[모크] 인공지능 시대의 교육 방향에 대한 의견 서술 과제',
    questionTypeName: '의견 서술',
    recommendationKeys: ['topic:사회', 'essay:주장형'],
    avoidRepeatKeys: ['issue:인공지능 교육'],
    ...REVIEW_DEFAULT,
    serviceStatus: 'internal_test',
    contentTeamMemo: '',
    createdAt: '2026-06-10 09:00',
    updatedAt: '2026-06-10 09:00',
    secondaryTopicMain: '교육',
    secondaryTopicDetail: '교육 제도',
    textType: '',
    learningGoalSummary: '주장과 근거의 논리적 전개',
    promptText:
      '인공지능 기술이 발전하면서 교육의 역할이 변하고 있다. 다음 내용을 중심으로 600~700자로 글을 쓰시오. 1) 교육의 역할은 무엇인가? 2) 어떤 교육이 필요한가?',
    resolvedText: '',
    modelAnswer: '',
    autoChecksPassed: true,
    reviewPassed: null,
    content: {
      kind: '54',
      essayType: '주장형',
      issueTopic: '인공지능 시대의 교육',
      promptQuestions: ['교육의 역할은 무엇인가?', '어떤 교육이 필요한가?'],
      stanceRequirement: '해결 방안 제시',
      requiredStructure: ['서론', '본론', '결론'],
      reasoningPattern: '주장→근거→방안',
      argumentKeywords: ['인공지능', '교육'],
      wordCountMin: 600,
      wordCountMax: 700,
      scoringFocus: ['논리 전개', '근거 제시'],
      prohibitedElements: ['문제 문장 그대로 옮겨 쓰기']
    }
  }
];

const mockTopicMaster: TopikWritingTopicMasterRow[] = [
  { topicMain: '교육', topicDetail: '학교생활', sortOrder: 1 },
  { topicMain: '건강', topicDetail: '질병과 증상', sortOrder: 2 },
  { topicMain: '사회', topicDetail: '사회 문제', sortOrder: 3 },
  { topicMain: '사회', topicDetail: '대중 매체', sortOrder: 4 }
];

function toSummary(detail: AssessmentQuestionDetail): AssessmentQuestionSummary {
  return {
    questionId: detail.questionId,
    questionNumber: detail.questionNumber,
    targetLevel: detail.targetLevel,
    difficultyLevel: detail.difficultyLevel,
    topicMain: detail.topicMain,
    topicDetail: detail.topicDetail,
    speechAct: detail.speechAct,
    scenarioType: detail.scenarioType,
    situationSummary: detail.situationSummary,
    questionTypeName: detail.questionTypeName,
    recommendationKeys: detail.recommendationKeys,
    avoidRepeatKeys: detail.avoidRepeatKeys,
    reviewStatus: detail.reviewStatus,
    reviewWorkflowStatus: detail.reviewWorkflowStatus,
    serviceStatus: detail.serviceStatus,
    contentTeamMemo: detail.contentTeamMemo,
    createdAt: detail.createdAt,
    updatedAt: detail.updatedAt
  };
}

export async function loadMockSummaries(): Promise<AssessmentQuestionSummary[]> {
  return mockDetails.map(toSummary);
}

export async function loadMockDetail(
  questionId: string
): Promise<AssessmentQuestionDetail> {
  const found = mockDetails.find((detail) => detail.questionId === questionId);
  if (!found) {
    throw new Error('문항 대상을 찾을 수 없습니다.');
  }
  return { ...found };
}

export async function loadMockTopicMaster(): Promise<TopikWritingTopicMasterRow[]> {
  return mockTopicMaster;
}

export async function loadMockActiveQuestionTags(): Promise<
  TopikWritingQuestionTagRow[]
> {
  return [];
}

const MOCK_REVIEW_PATCH: Record<
  AssessmentReviewAction,
  { reviewStatus: AssessmentReviewStatus; reviewWorkflowStatus: AssessmentReviewWorkflowStatus }
> = {
  approved: { reviewStatus: 'approved', reviewWorkflowStatus: 'done' },
  on_hold: { reviewStatus: 'on_hold', reviewWorkflowStatus: 'on_hold' },
  needs_revision: {
    reviewStatus: 'needs_revision',
    reviewWorkflowStatus: 'revision_requested'
  }
};

export async function setMockReviewAction(
  questionId: string,
  action: AssessmentReviewAction
): Promise<void> {
  const found = mockDetails.find((detail) => detail.questionId === questionId);
  if (!found) {
    throw new Error('문항 대상을 찾을 수 없습니다.');
  }
  Object.assign(found, MOCK_REVIEW_PATCH[action]);
  if (action === 'approved') {
    found.reviewPassed = true;
  }
}

export async function saveMockReviewMemo(
  questionId: string,
  memo: string
): Promise<void> {
  const found = mockDetails.find((detail) => detail.questionId === questionId);
  if (!found) {
    throw new Error('문항 대상을 찾을 수 없습니다.');
  }
  found.contentTeamMemo = memo;
}
