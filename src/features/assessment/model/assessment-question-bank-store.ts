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
    domain: '생활',
    questionTypeLabel: '빈칸 완성',
    difficultyLevel: '중',
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
    coreMeaning: '도서관 공지문 맥락에서 공공장소 예절 어휘를 고르는 문항입니다.',
    keyIssue: '오답 선택지 간 의미 차이는 안정적이지만 4번 표현이 다소 직접적입니다.',
    modelAnswer:
      '도서관 공지문의 핵심은 조용히 해야 한다는 점이므로, 공손한 종결 표현을 고른 답이 정답입니다.',
    scoringCriteria: [
      '도서관 이용 맥락과 공공 예절을 정확히 읽었는지',
      '존댓말 문장에 맞는 종결 표현을 선택했는지'
    ],
    revisionHistory: [
      {
        id: 'AQ-51001-REV-001',
        changedAt: '2026-03-29 09:10',
        changedBy: 'system_batch',
        summary: '초기 생성본 등록'
      }
    ],
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
    domain: '생활',
    questionTypeLabel: '빈칸 완성',
    difficultyLevel: '상',
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
    coreMeaning: '분실물 보관 안내문에서 수동/능동 표현을 구분하게 하는 문항입니다.',
    keyIssue: '정답과 오답 후보의 의미 간격이 좁아 중의성 제거가 필요합니다.',
    modelAnswer:
      '주인을 찾을 때까지 분실물을 안전하게 보관한다는 의미가 자연스럽게 연결되어야 합니다.',
    scoringCriteria: [
      '안내문 맥락에서 수동 표현을 정확히 골랐는지',
      '의미상 가능한 오답을 걸러낼 수 있는지'
    ],
    revisionHistory: [
      {
        id: 'AQ-51002-REV-001',
        changedAt: '2026-03-29 09:11',
        changedBy: 'system_batch',
        summary: '초기 생성본 등록'
      },
      {
        id: 'AQ-51002-REV-002',
        changedAt: '2026-03-29 13:20',
        changedBy: 'admin_current',
        summary: '정답-오답 중의성으로 보류 처리'
      }
    ],
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
    domain: '학습',
    questionTypeLabel: '연결 표현',
    difficultyLevel: '중',
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
    coreMeaning: '자기계발 맥락에서 이어지는 의도 표현을 고르게 하는 문항입니다.',
    keyIssue: '정답 표현은 적절하지만 화자의 의도가 조금 더 선명하면 좋겠습니다.',
    modelAnswer:
      '운동 습관을 계속 이어 가겠다는 화자의 의도 표현이 자연스럽게 연결되어야 합니다.',
    scoringCriteria: [
      '화자의 의도와 미래 계획을 읽고 연결 표현을 고를 수 있는지',
      '문장 흐름을 끊지 않는 자연스러운 표현을 구분했는지'
    ],
    revisionHistory: [
      {
        id: 'AQ-52001-REV-001',
        changedAt: '2026-03-29 10:02',
        changedBy: 'system_batch',
        summary: '초기 생성본 등록'
      },
      {
        id: 'AQ-52001-REV-002',
        changedAt: '2026-03-30 09:05',
        changedBy: 'admin_current',
        summary: '검수 중 메모 보강'
      }
    ],
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
    domain: '학습',
    questionTypeLabel: '연결 표현',
    difficultyLevel: '중',
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
    coreMeaning: '꾸준한 학습 습관에 대한 의견을 완성하는 문장 연결형 문항입니다.',
    keyIssue: '구문은 안정적이지만 2번 보기를 더 멀게 만들 여지는 있습니다.',
    modelAnswer:
      '꾸준함의 중요성을 강조한 뒤, 매일 조금씩 연습하려는 의도를 이어 주는 답이 적절합니다.',
    scoringCriteria: [
      '문맥상 의도 표현을 정확히 선택했는지',
      '오답 보기와 정답 보기의 문법 범주를 구분했는지'
    ],
    revisionHistory: [
      {
        id: 'AQ-52002-REV-001',
        changedAt: '2026-03-29 10:05',
        changedBy: 'system_batch',
        summary: '초기 생성본 등록'
      },
      {
        id: 'AQ-52002-REV-002',
        changedAt: '2026-03-30 08:55',
        changedBy: 'admin_current',
        summary: '검수 완료 후 노출 후보 유지'
      }
    ],
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
    domain: '사회',
    questionTypeLabel: '자료 설명',
    difficultyLevel: '상',
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
    coreMeaning: '도시별 자전거 이용률 증가 추세를 비교해 설명하는 자료 해석형 문항입니다.',
    keyIssue: '답안 가이드와 핵심 수치 연결이 느슨하고 2024년 수치 설명이 빠졌습니다.',
    modelAnswer:
      '전체적으로 자전거 이용률이 증가했으며, 서울이 가장 높고 대구가 가장 낮았다는 점을 수치와 함께 서술해야 합니다.',
    scoringCriteria: [
      '모든 연도별 핵심 수치를 빠짐없이 반영했는지',
      '도시 간 비교 포인트를 최소 2개 이상 제시했는지',
      '53번 분량과 객관적 서술 톤을 유지했는지'
    ],
    revisionHistory: [
      {
        id: 'AQ-53001-REV-001',
        changedAt: '2026-03-29 11:42',
        changedBy: 'system_batch',
        summary: '초기 생성본 등록'
      },
      {
        id: 'AQ-53001-REV-002',
        changedAt: '2026-03-30 09:15',
        changedBy: 'admin_current',
        summary: '핵심 수치 누락으로 수정 필요 처리'
      }
    ],
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
    domain: '학습',
    questionTypeLabel: '자료 설명',
    difficultyLevel: '중',
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
    coreMeaning: '연령대별 온라인 강의 만족도 차이를 비교해 요약하는 표 해석형 문항입니다.',
    keyIssue: '품질은 양호하지만 비교 지점이 한쪽으로 쏠려 답안 다양성이 낮습니다.',
    modelAnswer:
      '20대 만족도가 가장 높고 40대가 가장 낮다는 점을 중심으로, 보통 응답 비율을 보조 근거로 정리해야 합니다.',
    scoringCriteria: [
      '만족도 차이를 연령대별로 비교했는지',
      '보조 지표를 함께 활용해 설명을 확장했는지',
      '표 데이터만으로 객관적으로 서술했는지'
    ],
    revisionHistory: [
      {
        id: 'AQ-53002-REV-001',
        changedAt: '2026-03-29 11:48',
        changedBy: 'system_batch',
        summary: '초기 생성본 등록'
      },
      {
        id: 'AQ-53002-REV-002',
        changedAt: '2026-03-30 09:25',
        changedBy: 'admin_current',
        summary: '비교 포인트 단순성으로 숨김 후보 지정'
      }
    ],
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
    domain: '학습',
    questionTypeLabel: '의견 서술',
    difficultyLevel: '상',
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
    coreMeaning: '온라인 학습과 오프라인 학습의 효과를 비교해 자신의 입장을 서술하는 논술형 문항입니다.',
    keyIssue: '주제 범위는 적절하지만 최근 세트와의 주제 중복 여부 확인이 필요합니다.',
    modelAnswer:
      '입장을 명확히 밝힌 뒤 접근성, 집중도, 상호작용을 근거로 장단점을 비교하고 결론에서 현실적인 판단을 제시해야 합니다.',
    scoringCriteria: [
      '입장을 서론에서 분명히 밝혔는지',
      '본론에서 최소 두 가지 근거를 구체적으로 전개했는지',
      '조건 줄과 결론 제안을 모두 충족했는지'
    ],
    revisionHistory: [
      {
        id: 'AQ-54001-REV-001',
        changedAt: '2026-03-29 14:15',
        changedBy: 'system_batch',
        summary: '초기 생성본 등록'
      }
    ],
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
    domain: '문화',
    questionTypeLabel: '의견 서술',
    difficultyLevel: '상',
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
    coreMeaning: '지역 축제의 전통 보존과 현대화 사이에서 의견을 제시하게 하는 사회문화형 논술 문항입니다.',
    keyIssue: '품질은 충분하지만 최근 운영 세트와의 주제 유사도가 높습니다.',
    modelAnswer:
      '전통 보존과 현대화의 장단점을 모두 다룬 뒤, 지역 정체성을 지키면서도 현대적 요소를 부분 도입하는 절충안을 제시하는 구조가 적절합니다.',
    scoringCriteria: [
      '찬반 입장과 이유를 분명히 제시했는지',
      '전통 유지와 변화의 장단점을 균형 있게 다뤘는지',
      '결론에서 현실적 제안을 포함했는지'
    ],
    revisionHistory: [
      {
        id: 'AQ-54002-REV-001',
        changedAt: '2026-03-29 14:18',
        changedBy: 'system_batch',
        summary: '초기 생성본 등록'
      },
      {
        id: 'AQ-54002-REV-002',
        changedAt: '2026-03-30 09:40',
        changedBy: 'admin_current',
        summary: '주제 유사도로 운영 제외 처리'
      }
    ],
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
