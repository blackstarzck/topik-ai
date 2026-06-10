// P2 ETL 변환 코어 — 순수 함수만 (I/O 없음, vitest 단위 테스트 대상).
// 매핑 계약: 실행 계획안 §3.3 + 데이터 계약 §12.2 + 결정 기록 D-2~D-7.
// 파생 규칙은 함수별 주석에 근거를 남긴다(검증 리포트·콘텐츠팀 검토 대상).

export const QUESTION_TYPE_CODE = {
  51: 'writing_51_blank_completion',
  52: 'writing_52_sentence_completion',
  53: 'writing_53_data_description',
  54: 'writing_54_opinion_essay',
};
export const QUESTION_TYPE_NAME_DEFAULT = { 51: '빈칸 완성', 52: '연결 표현', 53: '자료 설명', 54: '의견 서술' };
export const TOPIC_SOURCE = '메신저 전달 항목(국제 통용 한국어 표준 교육과정 적용 연구 참고)';
export const TABLES = {
  51: 'topik_writing_51_questions',
  52: 'topik_writing_52_questions',
  53: 'topik_writing_53_questions',
  54: 'topik_writing_54_questions',
};

// D-2 / 데이터 계약 §12.2: 검수 상태 이관 사전
export function mapReviewStatus(legacy) {
  const dict = {
    pending: { review_status: 'needs_revision', review_workflow_status: 'not_started' },
    approved: { review_status: 'approved', review_workflow_status: 'done' },
    rejected: { review_status: 'needs_revision', review_workflow_status: 'revision_requested' },
  };
  return dict[legacy] ?? dict.pending;
}

// D-4: source_map 선조회 idempotent 채번. 기존 매핑 재사용, 미매핑분만
// (created_at, id) 결정적 정렬로 번호별 연번 이어 붙임.
export function assignQuestionIds(rows, existingByLegacyId) {
  const result = new Map();
  const maxSeq = { 51: 0, 52: 0, 53: 0, 54: 0 };
  for (const m of existingByLegacyId.values()) {
    const match = /^topik-writing-(\d{2})-(\d{4})$/.exec(m.question_id);
    if (!match) continue;
    const no = Number(match[1]);
    maxSeq[no] = Math.max(maxSeq[no] ?? 0, Number(match[2]));
  }
  const sorted = [...rows].sort((a, b) =>
    a.created_at === b.created_at ? (a.id < b.id ? -1 : 1) : (a.created_at < b.created_at ? -1 : 1));
  for (const r of sorted) {
    const existing = existingByLegacyId.get(r.id);
    if (existing) {
      result.set(r.id, existing.question_id);
      continue;
    }
    const no = r.question_no;
    maxSeq[no] += 1;
    result.set(r.id, `topik-writing-${no}-${String(maxSeq[no]).padStart(4, '0')}`);
  }
  return result;
}

// 52: 검수 메모 빈칸 지정 문자열("… '스팬' 구간 전체를 빈칸으로 지정")에서 정답 스팬 추출
export function parseBlankSpan(target) {
  const m = (target ?? '').match(/'([^']+)'/);
  return m ? m[1] : null;
}

// 53/54: "200~300자" 글자수 파싱
export function parseWordCount(prompt) {
  const m = (prompt ?? '').match(/(\d+)\s*[~∼]\s*(\d+)\s*자/);
  return m ? { min: Number(m[1]), max: Number(m[2]) } : { min: null, max: null };
}

// 53 과제/54 세부 질문: "1) … 2) … 3) …" 번호 항목 파싱
export function parseNumberedItems(prompt) {
  const items = [];
  const re = /(?:^|\s)(\d)\)\s*([^]*?)(?=(?:\s\d\)|$))/g;
  let m;
  while ((m = re.exec(prompt ?? '')) !== null) {
    const text = m[2].replace(/\s+/g, ' ').trim();
    if (text) items.push(text);
  }
  return items;
}

// 재조립(§6.3): ( ㄱ )/( ㄴ )에 대표정답 삽입 → 기준 텍스트와 공백 정규화 비교
const norm = (s) => (s ?? '').replace(/\s+/g, ' ').trim();
export function reassemble(prompt, answer1, answer2) {
  return (prompt ?? '').replace(/\(\s*ㄱ\s*\)/, answer1 ?? '').replace(/\(\s*ㄴ\s*\)/, answer2 ?? '');
}
export function reassembleMatches(prompt, answer1, answer2, reference) {
  if (!answer1 || !answer2 || !reference) return false;
  const resolved = norm(reassemble(prompt, answer1, answer2));
  const ref = norm(reference);
  return resolved === ref || resolved.includes(ref) || ref.includes(resolved);
}

// JSONB 비교용 정규화(키 정렬) — RT-2/보존 검증 공용
export function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((k) => [k, canonical(value[k])]));
  }
  return value;
}
export function jsonEqual(a, b) {
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}

function splitSentences(text) {
  return (text ?? '').split(/(?<=[.!?다])\s+/).map((s) => s.trim()).filter(Boolean);
}
function sentenceContaining(prompt, marker) {
  return splitSentences(prompt).find((s) => s.includes(marker)) ?? null;
}

// ── 공통 컬럼 빌더 ─────────────────────────────────────────────────────
// cls: 재분류 입력표 행(없으면 null → 보류 사유), r: problems 원행
export function buildCommon(r, cls, questionId) {
  const m = r.materials ?? {};
  const t = m.taxonomy ?? {};
  const sc = m.scenario ?? {};
  const no = r.question_no;
  const review = mapReviewStatus(r.review_status);
  const provenance = [m.source_label, m.source_file, m.source_item_id].filter(Boolean).join(' · ') || null;

  const scenarioType =
    no === 51 ? (t.scenario_type ?? null)
    : no === 52 ? (sc.approved_topic_seed?.topic_seed_title ?? r.title)
    : no === 53 ? (sc.scenario_logic?.scenario_title ?? r.title)
    : r.title;
  const situationSummary =
    no === 51 ? (m.source_context?.situation_summary ?? null)
    : (sc.narrative?.summary_trend ?? cls?.q54?.situation_summary ?? null);
  const speechAct = no === 51 ? (t.speech_act ?? null) : { 52: '설명', 53: '설명', 54: '주장' }[no];
  const textType = no === 51 ? (t.text_type ?? null) : { 52: '설명문', 53: '설명문/자료 설명문', 54: '논설문' }[no];
  const learningGoal =
    no === 51
      ? [m.blanks?.blank_1?.function, m.blanks?.blank_2?.function].filter(Boolean).join(', ') || null
      : (sc.approved_topic_seed?.why_exam_worthy ?? null);

  return {
    question_id: questionId,
    created_at: r.created_at,
    updated_at: r.updated_at,
    schema_version: '1.0',
    source_exam_reference: null,
    source_reference: provenance,
    exam_name: 'TOPIK',
    section: '쓰기',
    item_number: no,
    question_type_code: QUESTION_TYPE_CODE[no],
    question_type_name: cls?.question_type_name ?? QUESTION_TYPE_NAME_DEFAULT[no],
    target_level: cls?.target_level ?? null,
    difficulty_level: cls?.difficulty_level ?? null,
    topic_main: cls?.topic_main ?? null,
    topic_detail: cls?.topic_detail ?? null,
    secondary_topic_main: cls?.secondary_topic_main ?? null,
    secondary_topic_detail: cls?.secondary_topic_detail ?? null,
    topic_source: TOPIC_SOURCE,
    text_type: textType,
    speech_act: speechAct,
    relation: no === 51 ? (t.relation ?? null) : null,
    scenario_type: scenarioType,
    situation_summary: situationSummary,
    learning_goal_summary: learningGoal,
    prompt_text: r.prompt,
    resolved_text:
      no === 51 ? (m.source_context?.resolved_text ?? null)
      : no === 52 ? (r.answer_key?.model_answer ?? null)
      : null,
    model_answer: r.answer_key?.model_answer ?? null,
    answer_key: r.answer_key ?? null,
    review_status: review.review_status,
    review_workflow_status: review.review_workflow_status,
    service_status: 'internal_test', // D-6: 콘텐츠팀 승인 전 노출 차단
    auto_checks_passed: null, // 빌더 마지막에 검증 결과로 채움
    review_passed: r.review_status === 'approved' ? true : null,
    recommendation_keys: null, // 번호별 빌더에서 채움
    avoid_repeat_keys: null,
    content_team_memo: m.review?.review_memo ?? null,
  };
}

// ── 번호별 빌더 (NOT NULL 충족 실패 항목은 holdReasons에 적재) ──────────
export function build51(r, cls, questionId) {
  const m = r.materials ?? {};
  const b1 = m.blanks?.blank_1 ?? {};
  const b2 = m.blanks?.blank_2 ?? {};
  const common = buildCommon(r, cls, questionId);
  const row = {
    ...common,
    blank_count: m.taxonomy?.blank_count ?? 2,
    text_state: m.taxonomy?.text_state ?? null,
    blank_notation_policy: m.taxonomy?.blank_notation_policy ?? null,
    grammar_patterns: null,
    blank_1_position: b1.position ?? null,
    blank_1_role: b1.role ?? null,
    blank_1_function: b1.function ?? null,
    blank_1_answer_type: b1.answer_type ?? null,
    blank_1_canonical_answer: b1.canonical_answer ?? null,
    blank_1_accepted_answers: b1.accepted_answers ?? null,
    blank_1_accepted_synonyms: b1.accepted_synonyms ?? null,
    blank_1_target_note: m.blanks?.blank_target_giyeok ?? null,
    blank_2_position: b2.position ?? null,
    blank_2_role: b2.role ?? null,
    blank_2_function: b2.function ?? null,
    blank_2_answer_type: b2.answer_type ?? null,
    blank_2_canonical_answer: b2.canonical_answer ?? null,
    blank_2_accepted_answers: b2.accepted_answers ?? null,
    blank_2_accepted_synonyms: b2.accepted_synonyms ?? null,
    blank_2_target_note: m.blanks?.blank_target_nieun ?? null,
    validation_result: m.review?.validation ?? null,
  };
  row.recommendation_keys = buildRecommendationKeys(row);
  row.avoid_repeat_keys = compact([
    row.scenario_type ? `scenario:${row.scenario_type}` : null,
    row.blank_1_canonical_answer ? `answer:${row.blank_1_canonical_answer}` : null,
    row.blank_2_canonical_answer ? `answer:${row.blank_2_canonical_answer}` : null,
  ]);
  row.auto_checks_passed = reassembleMatches(r.prompt, row.blank_1_canonical_answer, row.blank_2_canonical_answer, row.resolved_text);
  return row;
}

export function build52(r, cls, questionId) {
  const m = r.materials ?? {};
  const t = m.taxonomy ?? {};
  const common = buildCommon(r, cls, questionId);
  const g = parseBlankSpan(r.answer_key?.blank_target_giyeok ?? m.blanks?.blank_target_giyeok);
  const n = parseBlankSpan(r.answer_key?.blank_target_nieun ?? m.blanks?.blank_target_nieun);
  const row = {
    ...common,
    completion_unit: cls?.q52?.completion_unit ?? null,
    required_sentence_count: null,
    blank_count: t.blank_count ?? null,
    connection_function: cls?.q52?.connection_function ?? null,
    // 앞문장_단서/뒷문장_단서: 빈칸이 든 문장 자체가 추론 단서(검수 메모 빈칸 지정 방식) — 해당 문장을 보존
    clue_before_text: sentenceContaining(r.prompt, 'ㄱ'),
    clue_after_text: sentenceContaining(r.prompt, 'ㄴ'),
    required_expression_function: cls?.q52?.required_expression_function ?? null,
    sentence_complexity: null,
    answer_scope_type: cls?.q52?.answer_scope_type ?? null,
    grammar_patterns: null,
    paragraph_role: null,
    cohesion_focus: (t.link_keywords ?? []).length ? '접속 표현' : null,
    blank_1_canonical_answer: g,
    blank_1_accepted_answers: null,
    blank_2_canonical_answer: n,
    blank_2_accepted_answers: null,
    scoring_notes: r.rubric?.approved_rubric?.rubric_focus_summary ?? null,
  };
  row.recommendation_keys = buildRecommendationKeys(row, (t.link_keywords ?? []).map((k) => `link:${k}`));
  row.avoid_repeat_keys = compact([
    row.scenario_type ? `scenario:${row.scenario_type}` : null,
    g ? `answer:${g}` : null,
    n ? `answer:${n}` : null,
  ]);
  row.auto_checks_passed = reassembleMatches(r.prompt, g, n, row.resolved_text);
  return row;
}

const DATA_TYPE_BY_CHART = { table: '표', bar: '막대그래프', line: '선그래프', pie: '원그래프', donut: '원그래프' };

export function build53(r, cls, questionId) {
  const m = r.materials ?? {};
  const charts = m.charts ?? null;
  const a = charts?.chart_a ?? null;
  const b = charts?.chart_b ?? null;
  const common = buildCommon(r, cls, questionId);
  const wc = parseWordCount(r.prompt);
  const tasks = parseNumberedItems(r.prompt);
  const sc = m.scenario ?? {};
  const isNumericAxis = (axis) => (axis ?? []).every((v) => typeof v === 'number');
  const categoryChart = b && !isNumericAxis(b.year_range) ? b : a && !isNumericAxis(a.year_range) ? a : null;
  const row = {
    ...common,
    data_type: a && b ? '복합 자료' : (DATA_TYPE_BY_CHART[a?.chart_type ?? b?.chart_type] ?? null),
    data_topic: sc.approved_topic_seed?.topic_seed_title ?? r.title ?? null,
    chart_title: compact([a?.title, b?.title]).join(' / ') || null,
    chart_unit: a?.unit && b?.unit ? (a.unit === b.unit ? a.unit : `${a.unit} / ${b.unit}`) : (a?.unit ?? b?.unit ?? null),
    comparison_target_count: categoryChart ? (categoryChart.year_range ?? []).length : null,
    data_series_count: (a?.series?.length ?? 0) + (b?.series?.length ?? 0) || null,
    number_expression_required: true, // 53번 과제 정의상 수치 표현 필수(프롬프트가 경향·차이 기술 요구)
    comparison_type: cls?.q53?.comparison_type ?? null,
    change_type: cls?.q53?.change_type ?? deriveChangeType(sc.narrative?.summary_trend),
    key_findings: compact([sc.narrative?.summary_trend, sc.narrative?.detail_feature]),
    required_structure: tasks.length ? tasks : null,
    expression_set: null,
    word_count_min: wc.min,
    word_count_max: wc.max,
    interpretation_difficulty: cls?.q53?.interpretation_difficulty ?? null,
    prohibited_elements: /제목을 쓰지 마시오/.test(r.prompt ?? '') ? ['글의 제목 작성'] : null,
    source_data: charts, // D-13: 수치 원본 JSONB 적재
    data_asset_url: null,
    scoring_focus: r.rubric?.rubric ?? null,
  };
  row.recommendation_keys = buildRecommendationKeys(row, compact([row.data_type ? `data:${row.data_type}` : null]));
  row.avoid_repeat_keys = compact([
    row.scenario_type ? `scenario:${row.scenario_type}` : null,
    row.data_topic ? `data_topic:${row.data_topic}` : null,
  ]);
  row.auto_checks_passed = Boolean(charts && tasks.length && wc.min != null);
  return row;
}

export function deriveChangeType(summaryTrend) {
  const s = summaryTrend ?? '';
  if (/(상승|증가|늘어)/.test(s)) return '증가';
  if (/(하락|감소|줄어)/.test(s)) return '감소';
  if (/유지/.test(s)) return '유지';
  if (/(차이|격차)/.test(s)) return '차이';
  return null;
}

export function build54(r, cls, questionId) {
  const m = r.materials ?? {};
  const sc = m.scenario ?? {};
  const common = buildCommon(r, cls, questionId);
  const wc = parseWordCount(r.prompt);
  const questions = parseNumberedItems(r.prompt);
  const logicChain = sc.scenario_logic?.logic_chain ?? null;
  const row = {
    ...common,
    essay_type: cls?.q54?.essay_type ?? null,
    issue_topic: sc.approved_topic_seed?.topic_seed_title ?? sc.topic_seed_title ?? r.title ?? null,
    prompt_questions: questions.length ? questions : null,
    stance_requirement: cls?.q54?.stance_requirement ?? null,
    // 글 구성: 생성 파이프라인 logic_chain 우선, 부재 시 루브릭 공통 구조(도입-전개-마무리)
    required_structure: logicChain && logicChain.length ? logicChain : ['도입', '전개', '마무리'],
    required_reason_count: null,
    example_requirement: null,
    word_count_min: wc.min,
    word_count_max: wc.max,
    reasoning_pattern: cls?.q54?.reasoning_pattern ?? (logicChain && logicChain.length ? logicChain.join('→') : null),
    argument_keywords: sc.narrative?.cause_keywords ?? null,
    vocabulary_level: { 4: '중급', 5: '중상급', 6: '고급' }[r.materials?.normalized_difficulty] ?? null,
    scoring_focus: r.rubric?.rubric ?? null,
    prohibited_elements: /그대로 옮겨 쓰지 마시오/.test(r.prompt ?? '') ? ['문제 문장 그대로 옮겨 쓰기'] : null,
    model_outline: sc.narrative ?? null,
    rubric: r.rubric ?? null,
  };
  row.recommendation_keys = buildRecommendationKeys(row, compact([row.essay_type ? `essay:${row.essay_type}` : null]));
  row.avoid_repeat_keys = compact([
    row.issue_topic ? `issue:${row.issue_topic}` : null,
    row.scenario_type ? `scenario:${row.scenario_type}` : null,
  ]);
  row.auto_checks_passed = Boolean(questions.length && wc.min != null);
  return row;
}

function compact(arr) {
  const out = arr.filter((v) => v != null && v !== '');
  return out.length ? out : [];
}
function buildRecommendationKeys(row, extra = []) {
  return compact([
    row.topic_main ? `topic:${row.topic_main}` : null,
    row.topic_detail ? `topic_detail:${row.topic_detail}` : null,
    row.speech_act ? `purpose:${row.speech_act}` : null,
    `type:${row.question_type_code}`,
    ...extra,
  ]);
}

// 테이블별 NOT NULL 계약 (마이그레이션 0003~0006과 동기 — 변경 시 동시 수정)
export const REQUIRED_COLUMNS = {
  common: ['question_id', 'question_type_code', 'question_type_name', 'topic_main', 'topic_detail', 'topic_source', 'scenario_type', 'situation_summary', 'prompt_text', 'review_status', 'review_workflow_status', 'service_status'],
  51: ['blank_count', 'blank_1_position', 'blank_1_role', 'blank_1_function', 'blank_1_answer_type', 'blank_1_canonical_answer', 'blank_2_position', 'blank_2_role', 'blank_2_function', 'blank_2_answer_type', 'blank_2_canonical_answer'],
  52: ['completion_unit', 'connection_function', 'required_expression_function', 'answer_scope_type'],
  53: ['data_type', 'data_topic', 'number_expression_required', 'comparison_type', 'required_structure'],
  54: ['essay_type', 'issue_topic', 'prompt_questions', 'stance_requirement', 'required_structure', 'reasoning_pattern', 'scoring_focus'],
};

export function missingRequired(row) {
  const required = [...REQUIRED_COLUMNS.common, ...REQUIRED_COLUMNS[row.item_number]];
  return required.filter((c) => row[c] == null || (Array.isArray(row[c]) && row[c].length === 0));
}

const BUILDERS = { 51: build51, 52: build52, 53: build53, 54: build54 };

// ── 전체 변환: rows + 재분류 입력표 + 기존 source_map → payload/보류/리포트 ──
export function transformAll(rows, classificationById, existingByLegacyId, batchLabel) {
  const idMap = assignQuestionIds(rows, existingByLegacyId);
  const payloads = { 51: [], 52: [], 53: [], 54: [] };
  const holds = [];
  const sourceMapRows = [];
  for (const r of rows) {
    const questionId = idMap.get(r.id);
    const cls = classificationById.get(r.id) ?? null;
    const row = BUILDERS[r.question_no](r, cls, questionId);
    const missing = missingRequired(row);
    const reasons = [];
    if (!cls) reasons.push('재분류 입력표 없음(분류 비대상 행)');
    if (missing.length) reasons.push(`필수 컬럼 역분해 실패: ${missing.join(', ')}`);
    const hold = reasons.length > 0;
    sourceMapRows.push({
      question_id: questionId,
      item_number: r.question_no,
      legacy_problem_id: r.id,
      legacy_topic_category_code: r.topic_category_code ?? null,
      legacy_publish_status: r.publish_status ?? null,
      legacy_visibility: r.visibility ?? null,
      backfill_batch: batchLabel,
      hold_reason: hold ? reasons.join(' | ') : null,
    });
    if (hold) {
      holds.push({ question_id: questionId, legacy_problem_id: r.id, item_number: r.question_no, title: r.title, reasons });
    } else {
      payloads[r.question_no].push(row);
    }
  }
  const report = {
    input: rows.length,
    loaded: Object.values(payloads).reduce((s, p) => s + p.length, 0),
    held: holds.length,
    perTable: Object.fromEntries(Object.entries(payloads).map(([k, v]) => [k, v.length])),
    autoChecksFailed: Object.values(payloads).flat().filter((p) => p.auto_checks_passed === false).map((p) => p.question_id),
  };
  return { payloads, holds, sourceMapRows, report };
}
