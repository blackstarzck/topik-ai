import type {
  InstitutionExposableQuestion,
  InstitutionQuestionMutationResult
} from '../model/institution-questions-types';

/**
 * 기관 중심 노출 문항 mock(Supabase 미구성/e2e). assessment mock의 4문항
 * (topik-writing-5x-9901)을 별 메모리로 복제한다(D-12 — 두 화면 독립 검증). 실DB·감사에
 * 쓰지 않으며 노출 추가/제거는 모듈 메모리(code→문항 id 집합)로 화면 왕복만 재현한다.
 */
const mockExposableQuestions: Omit<InstitutionExposableQuestion, 'isExposed'>[] = [
  {
    questionId: 'topik-writing-51-9901',
    itemNumber: 51,
    topicMain: '교육',
    situationSummary: '[모크] 도서관 이용 시간 변경을 알리는 학교 공지문',
    questionTypeName: '빈칸 완성',
    serviceStatus: 'internal_test'
  },
  {
    questionId: 'topik-writing-52-9901',
    itemNumber: 52,
    topicMain: '건강',
    situationSummary: '[모크] 충분한 수면이 건강에 미치는 영향을 설명하는 글',
    questionTypeName: '연결 표현',
    serviceStatus: 'internal_test'
  },
  {
    questionId: 'topik-writing-53-9901',
    itemNumber: 53,
    topicMain: '사회',
    situationSummary: '[모크] 1인 가구 비율 변화를 나타낸 그래프 설명 과제',
    questionTypeName: '자료 설명',
    serviceStatus: 'internal_test'
  },
  {
    questionId: 'topik-writing-54-9901',
    itemNumber: 54,
    topicMain: '사회',
    situationSummary: '[모크] 인공지능 시대의 교육 방향에 대한 의견 서술 과제',
    questionTypeName: '의견 서술',
    serviceStatus: 'internal_test'
  }
];

// code -> 노출 문항 id 집합 (모듈 메모리, add/remove 왕복 재현).
const mockExposureByCode = new Map<string, Set<string>>();
// 불러오기 데모용 시드: 다른 기관(BOOTH-B)에만 미리 노출 — 현재 기관(BOOTH-A) 0건 가정은 유지.
mockExposureByCode.set(
  'EXPO2026-BOOTH-B',
  new Set(['topik-writing-51-9901', 'topik-writing-52-9901'])
);

function exposedSet(code: string): Set<string> {
  let set = mockExposureByCode.get(code);
  if (!set) {
    set = new Set();
    mockExposureByCode.set(code, set);
  }
  return set;
}

export async function loadMockInstitutionQuestions(
  code: string
): Promise<InstitutionExposableQuestion[]> {
  const exposed = exposedSet(code);
  return mockExposableQuestions.map((question) => ({
    ...question,
    isExposed: exposed.has(question.questionId)
  }));
}

export async function addMockInstitutionQuestions(
  code: string,
  questionIds: string[]
): Promise<InstitutionQuestionMutationResult> {
  const exposed = exposedSet(code);
  const unique = Array.from(new Set(questionIds));
  let changed = 0;
  let unchanged = 0;
  let failed = 0;
  const details: InstitutionQuestionMutationResult['details'] = [];

  for (const questionId of unique) {
    if (!mockExposableQuestions.some((q) => q.questionId === questionId)) {
      failed += 1;
      if (details.length < 50) {
        details.push({ questionId, message: '문항 대상을 찾을 수 없습니다.' });
      }
      continue;
    }
    if (exposed.has(questionId)) {
      unchanged += 1;
      continue;
    }
    exposed.add(questionId);
    changed += 1;
  }

  return { total: unique.length, changed, unchanged, failed, batchId: 'mock-batch', details };
}

export async function removeMockInstitutionQuestions(
  code: string,
  questionIds: string[]
): Promise<InstitutionQuestionMutationResult> {
  const exposed = exposedSet(code);
  const unique = Array.from(new Set(questionIds));
  let changed = 0;
  let unchanged = 0;

  for (const questionId of unique) {
    if (exposed.has(questionId)) {
      exposed.delete(questionId);
      changed += 1;
    } else {
      unchanged += 1;
    }
  }

  return {
    total: unique.length,
    changed,
    unchanged,
    failed: 0,
    batchId: 'mock-batch',
    details: []
  };
}
