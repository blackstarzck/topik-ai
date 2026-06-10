// P2-7 (권장 게이트): ETL 변환 코어 순수 함수 단위 테스트.
// 실행: npm run test:unit  (vitest run tests/unit)
import { describe, it, expect } from 'vitest';
import {
  mapReviewStatus,
  assignQuestionIds,
  parseBlankSpan,
  parseWordCount,
  parseNumberedItems,
  reassemble,
  reassembleMatches,
  canonical,
  jsonEqual,
  deriveChangeType,
  build51,
  build52,
  build53,
  build54,
  missingRequired,
  transformAll,
  QUESTION_TYPE_CODE,
  TOPIC_SOURCE,
} from '../../scripts/etl/lib/transform-core.mjs';

describe('mapReviewStatus (D-2 이관 사전)', () => {
  it('pending → needs_revision + not_started', () => {
    expect(mapReviewStatus('pending')).toEqual({ review_status: 'needs_revision', review_workflow_status: 'not_started' });
  });
  it('approved → approved + done', () => {
    expect(mapReviewStatus('approved')).toEqual({ review_status: 'approved', review_workflow_status: 'done' });
  });
  it('rejected → needs_revision + revision_requested', () => {
    expect(mapReviewStatus('rejected')).toEqual({ review_status: 'needs_revision', review_workflow_status: 'revision_requested' });
  });
  it('미지의 값은 pending 사전으로 폴백', () => {
    expect(mapReviewStatus('weird')).toEqual(mapReviewStatus('pending'));
  });
});

describe('assignQuestionIds (D-4 idempotent 채번)', () => {
  const row = (id, no, createdAt) => ({ id, question_no: no, created_at: createdAt });
  it('(created_at, id) 결정적 정렬로 연번 부여', () => {
    const rows = [row('b', 51, '2026-01-02'), row('a', 51, '2026-01-01'), row('c', 52, '2026-01-01')];
    const ids = assignQuestionIds(rows, new Map());
    expect(ids.get('a')).toBe('topik-writing-51-0001');
    expect(ids.get('b')).toBe('topik-writing-51-0002');
    expect(ids.get('c')).toBe('topik-writing-52-0001');
  });
  it('created_at 동률은 id 타이브레이커', () => {
    const rows = [row('z', 51, '2026-01-01'), row('a', 51, '2026-01-01')];
    const ids = assignQuestionIds(rows, new Map());
    expect(ids.get('a')).toBe('topik-writing-51-0001');
    expect(ids.get('z')).toBe('topik-writing-51-0002');
  });
  it('기존 매핑 재사용 + 신규는 최대 연번 다음부터', () => {
    const existing = new Map([['a', { question_id: 'topik-writing-51-0007', legacy_problem_id: 'a' }]]);
    const rows = [row('a', 51, '2026-01-01'), row('b', 51, '2026-01-02')];
    const ids = assignQuestionIds(rows, existing);
    expect(ids.get('a')).toBe('topik-writing-51-0007');
    expect(ids.get('b')).toBe('topik-writing-51-0008');
  });
  it('재실행해도 같은 결과 (idempotency)', () => {
    const rows = [row('a', 53, '2026-01-01'), row('b', 53, '2026-01-02')];
    const first = assignQuestionIds(rows, new Map());
    const existing = new Map([...first.entries()].map(([legacy, qid]) => [legacy, { question_id: qid }]));
    const second = assignQuestionIds(rows, existing);
    expect([...second.entries()]).toEqual([...first.entries()]);
  });
});

describe('파서', () => {
  it('parseBlankSpan: 검수 메모 빈칸 지정에서 스팬 추출', () => {
    expect(parseBlankSpan("ㄱ: 검수 메모 기준 '말리려면' 구간 전체를 빈칸으로 지정")).toBe('말리려면');
    expect(parseBlankSpan('따옴표 없음')).toBeNull();
    expect(parseBlankSpan(null)).toBeNull();
  });
  it('parseWordCount: 200~300자', () => {
    expect(parseWordCount('다음을 참고하여 200~300자로 글을 쓰시오.')).toEqual({ min: 200, max: 300 });
    expect(parseWordCount('글자수 없음')).toEqual({ min: null, max: null });
  });
  it('parseNumberedItems: 1)~3) 항목 분리', () => {
    const items = parseNumberedItems("쓰시오. 1) '이용률'의 경향을 쓰시오. 2) 항목 간 차이를 쓰시오. 3) 정리하여 마무리하시오.");
    expect(items).toHaveLength(3);
    expect(items[0]).toContain('경향');
    expect(items[2]).toContain('마무리');
  });
});

describe('재조립 검증 (§6.3)', () => {
  const prompt = '특강에 ( ㄱ ) 신청서를 작성해 주시기 바랍니다. 궁금한 점은 담당자에게 ( ㄴ ).';
  it('대표정답 삽입 결과가 기준 텍스트와 일치하면 true', () => {
    const resolved = '특강에 참가하고 싶으신 분들은 신청서를 작성해 주시기 바랍니다. 궁금한 점은 담당자에게 문의해 주십시오.';
    expect(reassemble(prompt, '참가하고 싶으신 분들은', '문의해 주십시오')).toBe(resolved);
    expect(reassembleMatches(prompt, '참가하고 싶으신 분들은', '문의해 주십시오', resolved)).toBe(true);
  });
  it('기준 텍스트가 본문만 담아도(헤더 제외) 포함 비교로 통과', () => {
    const withHeader = `<공지>\n제목: 안내\n\n${reassemble(prompt, 'A', 'B')}`;
    expect(reassembleMatches(withHeader, 'A', 'B', reassemble(prompt, 'A', 'B'))).toBe(true);
  });
  it('정답이 다르면 false, 입력 결손도 false', () => {
    expect(reassembleMatches(prompt, '엉뚱한 답', '문의해 주십시오', reassemble(prompt, 'A', 'B'))).toBe(false);
    expect(reassembleMatches(prompt, null, 'B', 'x')).toBe(false);
  });
});

describe('canonical / jsonEqual', () => {
  it('키 순서가 달라도 동치', () => {
    expect(jsonEqual({ a: 1, b: [{ y: 2, x: 1 }] }, { b: [{ x: 1, y: 2 }], a: 1 })).toBe(true);
  });
  it('값이 다르면 비동치', () => {
    expect(jsonEqual({ a: 1 }, { a: 2 })).toBe(false);
  });
  it('canonical은 배열 순서를 보존', () => {
    expect(canonical([2, 1])).toEqual([2, 1]);
  });
});

describe('deriveChangeType', () => {
  it.each([
    ['이용률이 꾸준히 상승하였다', '증가'],
    ['비율이 감소하였다', '감소'],
    ['수치가 유지되었다', '유지'],
    ['항목 간 차이가 크다', '차이'],
    ['', null],
  ])('%s → %s', (text, expected) => {
    expect(deriveChangeType(text)).toBe(expected);
  });
});

// ── 빌더 픽스처 (실측 problems 구조 축약) ───────────────────────────────
const CLS = {
  topic_main: '일과 직업',
  topic_detail: '취업',
  secondary_topic_main: null,
  secondary_topic_detail: null,
  question_type_name: '빈칸 완성',
  target_level: 'TOPIK 3급',
  difficulty_level: 3,
};

const ROW51 = {
  id: 'uuid-51',
  question_no: 51,
  title: '취업 특강 안내',
  prompt: '특강에 ( ㄱ ) 신청해 주시기 바랍니다. 담당자에게 ( ㄴ ).',
  review_status: 'approved',
  publish_status: 'published',
  visibility: 'public',
  topic_category_code: null,
  created_at: '2026-06-08T03:10:46+00:00',
  updated_at: '2026-06-08T03:10:46+00:00',
  rubric: null,
  materials: {
    blanks: {
      blank_1: { role: '문맥 세팅', function: '안심 유도', position: 'ㄱ', answer_type: '종결 표현', canonical_answer: '참가하고 싶으신 분들은', accepted_answers: ['참가하고 싶으신 분들은'], accepted_synonyms: null },
      blank_2: { role: '종결 화행', function: '신청 유도', position: 'ㄴ', answer_type: '연결 표현', canonical_answer: '문의해 주십시오', accepted_answers: ['문의해 주십시오'] },
      blank_target_giyeok: "ㄱ: '참가하고 싶으신 분들은' 구간",
      blank_target_nieun: "ㄴ: '문의해 주십시오' 구간",
    },
    review: { validation: { topik3_passed: true }, review_memo: '검수 메모', review_passed: true },
    taxonomy: { scenario_type: '취업 특강 안내', speech_act: '안내', text_type: '공지/초대문', relation: '기관 → 학생', blank_count: 2, text_state: 'blank_inserted_in_prompt_text', blank_notation_policy: 'prompt_text_contains_( ㄱ )_( ㄴ )' },
    source_context: { resolved_text: '특강에 참가하고 싶으신 분들은 신청해 주시기 바랍니다. 담당자에게 문의해 주십시오.', situation_summary: '특강 참가자를 모집하는 공지다.' },
    source_label: 'D-01', source_file: 'sample-51.json', source_item_id: 'topik51-0001',
  },
  answer_key: { kind: 'blank_completion', model_answer: 'ㄱ: 참가하고 싶으신 분들은\nㄴ: 문의해 주십시오' },
};

describe('build51', () => {
  const row = build51(ROW51, CLS, 'topik-writing-51-0001');
  it('공통 매핑: 검수 사전·고정값·메모 영구화(D-7)', () => {
    expect(row.question_id).toBe('topik-writing-51-0001');
    expect(row.item_number).toBe(51);
    expect(row.question_type_code).toBe(QUESTION_TYPE_CODE[51]);
    expect(row.topic_source).toBe(TOPIC_SOURCE);
    expect(row.review_status).toBe('approved');
    expect(row.review_workflow_status).toBe('done');
    expect(row.review_passed).toBe(true);
    expect(row.service_status).toBe('internal_test');
    expect(row.content_team_memo).toBe('검수 메모');
    expect(row.source_reference).toBe('D-01 · sample-51.json · topik51-0001');
  });
  it('blank_* 직매핑 + target_note + validation_result', () => {
    expect(row.blank_1_canonical_answer).toBe('참가하고 싶으신 분들은');
    expect(row.blank_2_function).toBe('신청 유도');
    expect(row.blank_1_target_note).toContain('ㄱ');
    expect(row.validation_result).toEqual({ topik3_passed: true });
  });
  it('재조립 통과 → auto_checks_passed=true, 필수 컬럼 충족', () => {
    expect(row.auto_checks_passed).toBe(true);
    expect(missingRequired(row)).toEqual([]);
  });
  it('추천키/반복방지키 파생', () => {
    expect(row.recommendation_keys).toContain('topic:일과 직업');
    expect(row.avoid_repeat_keys).toContain('answer:참가하고 싶으신 분들은');
  });
});

const ROW52 = {
  id: 'uuid-52',
  question_no: 52,
  title: '생활 과학 / 장마철 빨래',
  prompt: '장마철에 빨래를 빨리 ( ㄱ ) 간격을 넓히는 것이 좋다. 물기가 더 잘 ( ㄴ ). 끝.',
  review_status: 'pending',
  publish_status: 'draft',
  visibility: 'private',
  created_at: '2026-06-08T03:10:47+00:00',
  updated_at: null,
  rubric: { rubric: { content: 'c' }, approved_rubric: { rubric_focus_summary: '자연성 평가' } },
  materials: {
    blanks: { blank_target_giyeok: "ㄱ: '말리려면' 빈칸", blank_target_nieun: "ㄴ: '날아가기 때문이다' 빈칸" },
    review: { review_memo: '52 메모' },
    scenario: { approved_topic_seed: { topic_seed_title: '생활 과학 / 장마철 빨래', why_exam_worthy: '연결 능력 평가' }, narrative: { summary_trend: '장마철에는 빨래가 잘 마르지 않는다.' } },
    taxonomy: { blank_count: 2, link_keywords: ['그래서'], subject_domain: '생활 과학' },
  },
  answer_key: {
    kind: 'complete_paragraph',
    model_answer: '장마철에 빨래를 빨리 말리려면 간격을 넓히는 것이 좋다. 물기가 더 잘 날아가기 때문이다. 끝.',
    blank_target_giyeok: "ㄱ: '말리려면' 빈칸",
    blank_target_nieun: "ㄴ: '날아가기 때문이다' 빈칸",
  },
};
const CLS52 = { ...CLS, topic_main: '일상생활', topic_detail: '가정생활', question_type_name: '연결 표현', target_level: 'TOPIK 4급', difficulty_level: 4, q52: { completion_unit: '구', connection_function: '이유 설명', required_expression_function: '이유 설명', answer_scope_type: '정답형' } };

describe('build52', () => {
  const row = build52(ROW52, CLS52, 'topik-writing-52-0001');
  it('검수 메모 스팬 → 대표정답, resolved_text=model_answer', () => {
    expect(row.blank_1_canonical_answer).toBe('말리려면');
    expect(row.blank_2_canonical_answer).toBe('날아가기 때문이다');
    expect(row.resolved_text).toBe(ROW52.answer_key.model_answer);
  });
  it('재조립 통과 + 분류 입력표 NOT NULL 4컬럼 반영', () => {
    expect(row.auto_checks_passed).toBe(true);
    expect(row.completion_unit).toBe('구');
    expect(row.answer_scope_type).toBe('정답형');
    expect(missingRequired(row)).toEqual([]);
  });
  it('pending → needs_revision + not_started, 단서 문장·응집성 파생', () => {
    expect(row.review_status).toBe('needs_revision');
    expect(row.review_workflow_status).toBe('not_started');
    expect(row.review_passed).toBeNull();
    expect(row.clue_before_text).toContain('( ㄱ )');
    expect(row.cohesion_focus).toBe('접속 표현');
    expect(row.scoring_notes).toBe('자연성 평가');
  });
  it('q52 분류 없으면 필수 컬럼 결손으로 검출 (적재 보류 경로)', () => {
    const bare = build52(ROW52, { ...CLS52, q52: undefined }, 'topik-writing-52-0002');
    expect(missingRequired(bare)).toEqual(expect.arrayContaining(['completion_unit', 'connection_function']));
  });
});

const ROW53 = {
  id: 'uuid-53',
  question_no: 53,
  title: '구독 서비스 이용률',
  prompt: "다음을 참고하여 200~300자로 글을 쓰시오. 단, 글의 제목을 쓰지 마시오. (30점) 1) '이용률'의 경향을 쓰시오. 2) 항목 간 차이를 쓰시오. 3) 마무리하시오.",
  review_status: 'approved',
  publish_status: 'published',
  visibility: 'public',
  created_at: '2026-06-08T03:10:48+00:00',
  updated_at: null,
  rubric: { rubric: { content: '과제 수행', language: '격식체', structure: '흐름' } },
  materials: {
    charts: {
      chart_a: { unit: '%', title: '이용률', series: [{ label: '비율', values: [21, 72] }], chart_type: 'line', year_range: [2018, 2026] },
      chart_b: { unit: '%', title: '유형별 비율', series: [{ label: '2026년', values: [24, 27] }], chart_type: 'bar', year_range: ['식품', '학습'] },
    },
    review: { review_memo: null },
    scenario: { approved_topic_seed: { topic_seed_title: '구독 서비스 이용률', why_exam_worthy: '종합 기술' }, narrative: { summary_trend: '이용률이 꾸준히 상승하였다.', detail_feature: '학습이 가장 높았다.' }, scenario_logic: { scenario_title: '구독 서비스 연결' } },
    taxonomy: { subject_domain: '경제' },
  },
  answer_key: { kind: 'model_answer', model_answer: '모범답안' },
};
const CLS53 = { ...CLS, topic_main: '사회', topic_detail: '경제', question_type_name: '자료 설명', target_level: 'TOPIK 4급', difficulty_level: 4, q53: { comparison_type: '전후 비교', change_type: null, interpretation_difficulty: '복수 비교' } };

describe('build53', () => {
  const row = build53(ROW53, CLS53, 'topik-writing-53-0001');
  it('차트 2종 → 복합 자료, source_data 원본 보존(D-13)', () => {
    expect(row.data_type).toBe('복합 자료');
    expect(row.source_data).toEqual(ROW53.materials.charts);
    expect(row.data_asset_url).toBeNull();
  });
  it('프롬프트 파싱: 글자수·과제·금지요소', () => {
    expect(row.word_count_min).toBe(200);
    expect(row.word_count_max).toBe(300);
    expect(row.required_structure).toHaveLength(3);
    expect(row.prohibited_elements).toEqual(['글의 제목 작성']);
  });
  it('범주 차트 기준 비교대상 수·시리즈 수, change_type은 narrative 파생', () => {
    expect(row.comparison_target_count).toBe(2);
    expect(row.data_series_count).toBe(2);
    expect(row.change_type).toBe('증가');
  });
  it('필수 컬럼 충족 + auto_checks_passed', () => {
    expect(missingRequired(row)).toEqual([]);
    expect(row.auto_checks_passed).toBe(true);
  });
});

const ROW54 = {
  id: 'uuid-54',
  question_no: 54,
  title: '직무 자동화',
  prompt: '다음을 주제로 하여 자신의 생각을 600~700자로 쓰시오. 단, 문제를 그대로 옮겨 쓰지 마시오. 배경 설명이다. 1) 장점은 무엇인가? 2) 문제는 무엇인가? 3) 무엇을 준비해야 하는가?',
  review_status: 'approved',
  publish_status: 'published',
  visibility: 'public',
  created_at: '2026-06-08T03:10:49+00:00',
  updated_at: null,
  rubric: { rubric: { content: '과제 수행', language: '격식체', structure: '구조' } },
  materials: {
    review: { review_memo: '54 메모' },
    scenario: { topic_seed_title: '직무 자동화' },
    taxonomy: { subject_domain: '사회', topic_type: 'advantage_problem_solution' },
    normalized_difficulty: 5,
  },
  answer_key: { kind: 'model_answer', model_answer: '모범답안 본문' },
};
const CLS54 = { ...CLS, topic_main: '일과 직업', topic_detail: '업무', question_type_name: '의견 서술', target_level: 'TOPIK 5급', difficulty_level: 5, q54: { essay_type: '장단점형', stance_requirement: '해결 방안 제시', reasoning_pattern: '장점→문제→대응', situation_summary: '직무 자동화에 대한 관심이 높아지는 상황이다.' } };

describe('build54', () => {
  const row = build54(ROW54, CLS54, 'topik-writing-54-0001');
  it('issue_topic은 축약 scenario에서도 복원, 질문 3개 파싱', () => {
    expect(row.issue_topic).toBe('직무 자동화');
    expect(row.prompt_questions).toHaveLength(3);
    expect(row.word_count_min).toBe(600);
  });
  it('logic_chain 부재 → 루브릭 공통 구조 폴백 + 분류 입력표 값 채택', () => {
    expect(row.required_structure).toEqual(['도입', '전개', '마무리']);
    expect(row.essay_type).toBe('장단점형');
    expect(row.reasoning_pattern).toBe('장점→문제→대응');
    expect(row.situation_summary).toBe('직무 자동화에 대한 관심이 높아지는 상황이다.');
  });
  it('vocabulary_level은 normalized_difficulty 파생, scoring_focus=rubric', () => {
    expect(row.vocabulary_level).toBe('중상급');
    expect(row.scoring_focus).toEqual(ROW54.rubric.rubric);
  });
  it('필수 컬럼 충족', () => {
    expect(missingRequired(row)).toEqual([]);
  });
});

describe('transformAll (보류·source_map·수량)', () => {
  const rows = [ROW51, ROW52, ROW53, ROW54, { ...ROW51, id: 'uuid-hold', materials: null, answer_key: null, title: '예시 행', prompt: 'x', created_at: '2026-05-26T00:00:00+00:00' }];
  const cls = new Map([
    ['uuid-51', CLS],
    ['uuid-52', CLS52],
    ['uuid-53', CLS53],
    ['uuid-54', CLS54],
  ]);
  const { payloads, holds, sourceMapRows, report } = transformAll(rows, cls, new Map(), 'test-batch');
  it('분류 입력표 없는 행은 적재 보류 + hold_reason 기록', () => {
    expect(holds).toHaveLength(1);
    expect(holds[0].legacy_problem_id).toBe('uuid-hold');
    const holdMap = sourceMapRows.find((m) => m.legacy_problem_id === 'uuid-hold');
    expect(holdMap.hold_reason).toContain('재분류 입력표 없음');
  });
  it('수량: 입력 = 적재 + 보류, source_map 전수', () => {
    expect(report.input).toBe(5);
    expect(report.loaded).toBe(4);
    expect(report.held).toBe(1);
    expect(sourceMapRows).toHaveLength(5);
  });
  it('source_map에 legacy 노출 신호·배치 라벨 보존 (P2-4)', () => {
    const m = sourceMapRows.find((s) => s.legacy_problem_id === 'uuid-51');
    expect(m.legacy_publish_status).toBe('published');
    expect(m.legacy_visibility).toBe('public');
    expect(m.backfill_batch).toBe('test-batch');
  });
  it('보류 행도 question_id 선점 (소스맵 주석 계약)', () => {
    const m = sourceMapRows.find((s) => s.legacy_problem_id === 'uuid-hold');
    expect(m.question_id).toMatch(/^topik-writing-51-\d{4}$/);
  });
  it('payload 테이블 라우팅', () => {
    expect(payloads[51]).toHaveLength(1);
    expect(payloads[52]).toHaveLength(1);
    expect(payloads[53]).toHaveLength(1);
    expect(payloads[54]).toHaveLength(1);
  });
});
