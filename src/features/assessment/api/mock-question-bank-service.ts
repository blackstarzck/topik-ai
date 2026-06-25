import type {
  AssessmentQuestionDetail,
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
 * D-12 모크 모드 (CI/스모크): Supabase가 구성되지 않은 실행에서 화면·e2e가
 * 결정적 픽스처로 동작하도록 하는 인메모리 어댑터다(인바운드 모델 — 조회 +
 * 관리 포인트). 노출 통제·태그 쓰기는 모듈 메모리를 변조해 왕복(쓰기→재조회
 * 반영)을 화면 수준에서 재현하며, RPC 가드(중복 활성 부여 차단, 노출상태 그룹
 * 차단)도 같은 규칙으로 흉내 낸다(P4 RT-4의 실DB 왕복과는 별개 — D-12).
 * 실DB·감사 로그에는 아무것도 쓰지 않으며, 페이지는 모크 모드 배너를 띄운다.
 */

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

// 시드(0002 마이그레이션)의 대표 부분집합 — 그룹별 동작 검증용. '서비스_노출상태'
// 그룹은 실 시드와 동일하게 부재(D-6/E3).
const mockTagMaster: TopikWritingTagMasterRow[] = [
  {
    tagCode: 'rec_use',
    tagNameKo: '추천 사용',
    tagGroup: '추천사용',
    description: '추천 엔진에서 사용할 수 있는 문제.',
    usageRule: '노출 가능 문항 중 추천 후보로 쓸 문제에 부여한다.',
    isActive: true
  },
  {
    tagCode: 'rec_first_entry',
    tagNameKo: '첫 진입용',
    tagGroup: '추천목적',
    description: '처음 진입한 학습자에게 적합한 문제.',
    usageRule: '난이도가 낮고 상황이 보편적인 문제에 부여한다.',
    isActive: true
  },
  {
    tagCode: 'avoid_same_situation',
    tagNameKo: '같은상황주의',
    tagGroup: '반복방지',
    description: '비슷한 상황 문제의 연속 노출을 피해야 하는 문제.',
    usageRule: '동일 시나리오가 많은 풀에서 부여한다.',
    isActive: true
  },
  {
    tagCode: 'avoid_same_answer',
    tagNameKo: '같은정답주의',
    tagGroup: '반복방지',
    description: '비슷한 정답 표현의 연속 노출을 피해야 하는 문제.',
    usageRule: '대표 정답 표현이 겹치는 문제군에 부여한다.',
    isActive: true
  },
  {
    tagCode: 'ops_expression_caution',
    tagNameKo: '표현 주의',
    tagGroup: '운영주의',
    description: '표현·어감에 주의가 필요한 문제.',
    usageRule: '노출 제외 기준 ②: 이 태그가 활성인 문항의 available 전환은 사유 입력이 필수다.',
    isActive: true
  },
  {
    tagCode: 'ops_operation_excluded',
    tagNameKo: '운영 제외',
    tagGroup: '운영주의',
    description: '운영상 영구 제외로 결정한 문제(E3).',
    usageRule: 'service_status=excluded와 함께 부여해 "일시 제외"와 "운영 제외"를 구분한다(D-6).',
    isActive: true
  }
];

let mockTagAssignmentSeq = 1;
const mockQuestionTags: TopikWritingQuestionTagRow[] = [];

export async function loadMockTagMaster(): Promise<TopikWritingTagMasterRow[]> {
  return mockTagMaster.map((row) => ({ ...row }));
}

/**
 * P5-1 마스터 카탈로그 모크 — /system/metadata 조회 surface용 전수 행.
 * 비활성 렌더 검증을 위해 비활성 예시 1행을 결정적으로 포함한다.
 */
export async function loadMockTopicMasterCatalog(): Promise<
  TopikWritingTopicMasterCatalogRow[]
> {
  const activeRows = mockTopicMaster.map((row, index) => ({
    topicId: index + 1,
    topicMain: row.topicMain,
    topicDetail: row.topicDetail,
    sourceName: '모크 시드(D-12)',
    isActive: true,
    sortOrder: row.sortOrder,
    memo: null
  }));
  return [
    ...activeRows,
    {
      topicId: activeRows.length + 1,
      topicMain: '예술',
      topicDetail: '미술',
      sourceName: '모크 시드(D-12)',
      isActive: false,
      sortOrder: 99,
      memo: '[모크] 비활성 표시 검증용'
    }
  ];
}

// P5-3 토글 왕복 재현용 가변 상태 — 편집 옵션 사전(mockTagMaster)과는 분리.
const mockTagMasterCatalogState: TopikWritingTagMasterCatalogRow[] = mockTagMaster.map(
  (row) => ({
    tagCode: row.tagCode,
    tagNameKo: row.tagNameKo,
    tagGroup: row.tagGroup,
    description: row.description,
    usageRule: row.usageRule,
    exampleQuestionId: null,
    isActive: row.isActive,
    updatedAt: '2026-06-10 09:00'
  })
);

export async function loadMockTagMasterCatalog(): Promise<
  TopikWritingTagMasterCatalogRow[]
> {
  return mockTagMasterCatalogState.map((row) => ({ ...row }));
}

/** P5-3 — RPC `admin_update_tag_master_status`의 가드(미존재·무변경 거부)를 흉내 낸다. */
export async function setMockTagMasterStatus(
  tagCode: string,
  nextActive: boolean
): Promise<void> {
  const row = mockTagMasterCatalogState.find((item) => item.tagCode === tagCode);
  if (!row) {
    throw new Error(`unknown tag_code: ${tagCode}`);
  }
  if (row.isActive === nextActive) {
    throw new Error(
      `tag_master already ${nextActive ? 'active' : 'inactive'}: ${tagCode}`
    );
  }
  row.isActive = nextActive;
  row.updatedAt = '2026-06-11 00:00';
}

export async function loadMockActiveQuestionTags(): Promise<
  TopikWritingQuestionTagRow[]
> {
  return mockQuestionTags.map((row) => ({ ...row }));
}

export async function setMockServiceStatus(
  questionId: string,
  nextStatus: AssessmentServiceStatus
): Promise<void> {
  const found = mockDetails.find((detail) => detail.questionId === questionId);
  if (!found) {
    throw new Error('문항 대상을 찾을 수 없습니다.');
  }
  found.serviceStatus = nextStatus;
}

/**
 * 운영 조치 일괄 처리 모크 — 실RPC와 동일한 결과 shape를 화면 수준에서 재현한다
 * (멱등 무변경/미존재 실패 분리). 실DB·감사에는 쓰지 않으며 차단(운영주의 게이트)은
 * 모크에서 재현하지 않는다(D-12 — 게이트 실검증은 dev DB 경로 RT). batchId는 모크
 * 고정 sentinel.
 */
export async function setMockServiceStatusBulk(
  questionIds: string[],
  nextStatus: AssessmentServiceStatus
): Promise<BulkServiceStatusResult> {
  const unique = Array.from(new Set(questionIds));
  let changed = 0;
  let unchanged = 0;
  let failed = 0;
  const details: BulkServiceStatusResult['details'] = [];

  for (const questionId of unique) {
    const found = mockDetails.find((detail) => detail.questionId === questionId);
    if (!found) {
      failed += 1;
      if (details.length < 50) {
        details.push({ questionId, kind: 'failed', message: '문항 대상을 찾을 수 없습니다.' });
      }
      continue;
    }
    if (found.serviceStatus === nextStatus) {
      unchanged += 1;
      continue;
    }
    found.serviceStatus = nextStatus;
    changed += 1;
  }

  return {
    total: unique.length,
    changed,
    unchanged,
    blocked: 0,
    failed,
    details,
    batchId: 'mock-batch'
  };
}

export async function assignMockQuestionTag(
  questionId: string,
  tagCode: string
): Promise<void> {
  if (!mockDetails.some((detail) => detail.questionId === questionId)) {
    throw new Error('문항 대상을 찾을 수 없습니다.');
  }
  const master = mockTagMaster.find((row) => row.tagCode === tagCode);
  if (!master) {
    throw new Error(`unknown tag_code: ${tagCode}`);
  }
  if (
    mockQuestionTags.some(
      (row) => row.questionId === questionId && row.tagCode === tagCode
    )
  ) {
    throw new Error(`tag already active on this question: ${tagCode}`);
  }
  mockQuestionTags.push({
    tagAssignmentId: mockTagAssignmentSeq++,
    questionId,
    tagCode,
    tagValue: null,
    assignedAt: '2026-06-11 00:00'
  });
}

export async function removeMockQuestionTag(
  tagAssignmentId: number
): Promise<void> {
  const index = mockQuestionTags.findIndex(
    (row) => row.tagAssignmentId === tagAssignmentId
  );
  if (index < 0) {
    throw new Error(`tag assignment not found: ${tagAssignmentId}`);
  }
  mockQuestionTags.splice(index, 1);
}

// ---------------------------------------------------------------------------
// 기관별 노출 매핑 모크 — set-semantics(전달 코드 집합 = 최종 허용 집합)·BulkResult
// shape를 화면 수준에서 재현. 실DB·감사에는 쓰지 않으며 코드 활성 검증은 흉내 내지
// 않는다(D-12 — 실검증은 dev DB 경로). 라벨은 code 그대로(화면은 codeOptions로 표시).
// ---------------------------------------------------------------------------

const mockQuestionInstitutions: WritingQuestionInstitutionRow[] = [];

export async function loadMockQuestionInstitutions(
  questionId?: string
): Promise<WritingQuestionInstitutionRow[]> {
  return mockQuestionInstitutions
    .filter((row) => !questionId || row.questionId === questionId)
    .map((row) => ({ ...row }));
}

export async function setMockQuestionInstitutions(
  questionIds: string[],
  institutionCodes: string[],
  reason: string
): Promise<BulkServiceStatusResult> {
  const uniqueIds = Array.from(new Set(questionIds));
  const targetCodes = Array.from(
    new Set(institutionCodes.map((code) => code.trim()).filter(Boolean))
  );
  let changed = 0;
  let unchanged = 0;
  let failed = 0;
  const details: BulkServiceStatusResult['details'] = [];

  for (const questionId of uniqueIds) {
    const detail = mockDetails.find((item) => item.questionId === questionId);
    if (!detail) {
      failed += 1;
      if (details.length < 50) {
        details.push({ questionId, kind: 'failed', message: '문항 대상을 찾을 수 없습니다.' });
      }
      continue;
    }
    const current = mockQuestionInstitutions
      .filter((row) => row.questionId === questionId)
      .map((row) => row.institutionCode);
    const added = targetCodes.filter((code) => !current.includes(code));
    const removed = current.filter((code) => !targetCodes.includes(code));
    if (added.length === 0 && removed.length === 0) {
      unchanged += 1;
      continue;
    }
    for (const code of removed) {
      const index = mockQuestionInstitutions.findIndex(
        (row) => row.questionId === questionId && row.institutionCode === code
      );
      if (index >= 0) {
        mockQuestionInstitutions.splice(index, 1);
      }
    }
    for (const code of added) {
      mockQuestionInstitutions.push({
        questionId,
        itemNumber: Number(detail.questionNumber),
        institutionCode: code,
        institutionLabel: code,
        institutionStatus: '활성',
        reason,
        createdAt: '2026-06-25 00:00'
      });
    }
    changed += 1;
  }

  return {
    total: uniqueIds.length,
    changed,
    unchanged,
    blocked: 0,
    failed,
    details,
    batchId: 'mock-batch'
  };
}

export async function clearMockQuestionInstitutions(
  questionIds: string[]
): Promise<BulkServiceStatusResult> {
  const uniqueIds = Array.from(new Set(questionIds));
  let changed = 0;
  let unchanged = 0;

  for (const questionId of uniqueIds) {
    const before = mockQuestionInstitutions.length;
    for (let index = mockQuestionInstitutions.length - 1; index >= 0; index -= 1) {
      if (mockQuestionInstitutions[index].questionId === questionId) {
        mockQuestionInstitutions.splice(index, 1);
      }
    }
    if (mockQuestionInstitutions.length < before) {
      changed += 1;
    } else {
      unchanged += 1;
    }
  }

  return {
    total: uniqueIds.length,
    changed,
    unchanged,
    blocked: 0,
    failed: 0,
    details: [],
    batchId: 'mock-batch'
  };
}
