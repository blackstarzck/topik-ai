#!/usr/bin/env node
// P1 프로덕션 적용 게이트 스모크 (실행 계획안 §5.4 / §12.0 RT-1 / §12.1 P1).
// 수행 내용:
//   1. service-role로 번호별 파일럿 문항 4건 + source_map 4건 적재 (백필 경로 검증 겸용)
//   2. RLS 역할 매트릭스: anon / 비admin / admin 계정으로 9오브젝트 SELECT 허용·차단 확인
//      (뷰는 security_invoker 네거티브 테스트: anon·비admin 0행, admin은 파일럿 4행)
//   3. RT-1 왕복: 적재 payload ↔ ① 테이블 직조회 ② 추천 뷰 ③ 태그 조인 ④ admin RLS 경유 — 필드별 일치
//   4. RPC 검증: admin_assign_question_tag / admin_update_topik_question (감사 로그 역추적 포함)
//      + 비admin RPC 거부 + 비admin 직접 INSERT 차단
//   5. 파일럿 행 정리(채번 오염 방지) 후 정리 확인
// 출력: JSON 리포트(stdout + --out 파일)

import { writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const URL_BASE = process.env.VITE_SUPABASE_URL ?? 'https://fglggyfvzjdsbyckinqa.supabase.co';
const ANON = process.env.VITE_SUPABASE_ANON_KEY;
const SECRET = process.env.SUPABASE_SECRET_KEY;
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD;
const USER_EMAIL = process.env.E2E_USER_EMAIL;
const USER_PASSWORD = process.env.E2E_USER_PASSWORD;

if (!ANON || !SECRET || !ADMIN_EMAIL || !ADMIN_PASSWORD || !USER_EMAIL || !USER_PASSWORD) {
  console.error('VITE_SUPABASE_ANON_KEY, SUPABASE_SECRET_KEY, E2E_* env vars must be set.');
  process.exit(1);
}

const report = { startedAt: new Date().toISOString(), steps: [] };
let failed = 0;
function step(name, ok, detail) {
  report.steps.push({ name, ok, detail });
  if (!ok) failed += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${typeof detail === 'string' ? detail : JSON.stringify(detail)}` : ''}`);
}

const service = createClient(URL_BASE, SECRET, { auth: { persistSession: false } });

// ── 시드 사용자 보장 (비admin) ──────────────────────────────────────────
async function ensureUser(email, password) {
  const headers = { apikey: SECRET, Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' };
  const res = await fetch(`${URL_BASE}/auth/v1/admin/users`, {
    method: 'POST', headers, body: JSON.stringify({ email, password, email_confirm: true }),
  });
  if (res.ok) return (await res.json()).id;
  const body = await res.text();
  if (res.status === 422 && body.includes('already')) return null; // exists
  throw new Error(`ensureUser ${email}: HTTP ${res.status} ${body}`);
}
await ensureUser(USER_EMAIL, USER_PASSWORD);

// ── 파일럿 payload (NOT NULL/CHECK/FK 충족, topic_master 실값 사용) ─────
const COMMON = (n) => ({
  question_id: `topik-writing-${n}-9999`,
  item_number: n,
  question_type_code: { 51: 'writing_51_blank_completion', 52: 'writing_52_sentence_completion', 53: 'writing_53_data_description', 54: 'writing_54_opinion_essay' }[n],
  question_type_name: { 51: '빈칸 완성', 52: '연결 표현', 53: '자료 설명', 54: '의견 서술' }[n],
  target_level: 'TOPIK 3급',
  difficulty_level: 3,
  topic_main: '일상생활',
  topic_detail: '학교생활',
  topic_source: '메신저 전달 항목(국제 통용 한국어 표준 교육과정 적용 연구 참고)',
  speech_act: '문의',
  scenario_type: '파일럿 검증 시나리오',
  situation_summary: 'RT-1 파일럿 적재 왕복 검증용 문항이다.',
  prompt_text: `파일럿 ${n}번 본문 ( ㄱ ) 텍스트 ( ㄴ ) 끝.`,
  answer_key: { kind: 'pilot', note: `pilot-${n}` },
  review_status: 'needs_revision',
  review_workflow_status: 'not_started',
  service_status: 'internal_test',
  recommendation_keys: [`pilot-key-${n}`],
  avoid_repeat_keys: [`pilot-avoid-${n}`],
  content_team_memo: `파일럿 메모 ${n}`,
});
const PILOTS = {
  51: {
    ...COMMON(51),
    blank_count: 2,
    blank_1_position: 'ㄱ', blank_1_role: '문맥 세팅', blank_1_function: '절차 고민',
    blank_1_answer_type: '종결 표현', blank_1_canonical_answer: '빌리려면',
    blank_1_accepted_answers: ['빌리려면', '빌리고 싶으면'],
    blank_2_position: 'ㄴ', blank_2_role: '종결 화행', blank_2_function: '안내 요청',
    blank_2_answer_type: '종결 표현', blank_2_canonical_answer: '신청할 수 있습니까',
    blank_2_accepted_answers: ['신청할 수 있습니까'],
  },
  52: {
    ...COMMON(52),
    completion_unit: '문장', connection_function: '이유 설명',
    required_expression_function: '이유 설명', answer_scope_type: '유사표현 허용형',
    sentence_complexity: '연결 문장', scoring_notes: '파일럿 채점 메모',
  },
  53: {
    ...COMMON(53),
    data_type: '표', data_topic: '파일럿 자료 주제', chart_title: '파일럿 표',
    number_expression_required: true, comparison_type: '항목 비교',
    required_structure: ['도입', '비교', '마무리'], source_data: { rows: [{ 항목: 'A', 값: 1 }] },
  },
  54: {
    ...COMMON(54),
    essay_type: '주장형', issue_topic: '파일럿 논제', prompt_questions: ['질문 1', '질문 2'],
    stance_requirement: '균형적 관점', required_structure: ['서론', '본론', '결론'],
    reasoning_pattern: '주장→근거', scoring_focus: ['내용', '구조', '표현'],
  },
};
const TABLES = { 51: 'topik_writing_51_questions', 52: 'topik_writing_52_questions', 53: 'topik_writing_53_questions', 54: 'topik_writing_54_questions' };
const NUMS = [51, 52, 53, 54];

// ── 1. service-role 파일럿 적재 ─────────────────────────────────────────
for (const n of NUMS) {
  const { error } = await service.from(TABLES[n]).upsert(PILOTS[n]);
  step(`pilot insert ${TABLES[n]} (service-role)`, !error, error?.message);
  const { error: mapErr } = await service.from('topik_writing_question_source_map').upsert({
    question_id: PILOTS[n].question_id, item_number: n, backfill_batch: 'pilot',
  });
  step(`pilot source_map ${n}`, !mapErr, mapErr?.message);
}

// ── 2. RLS 역할 매트릭스 ────────────────────────────────────────────────
const OBJECTS = [
  'topik_writing_51_questions', 'topik_writing_52_questions', 'topik_writing_53_questions',
  'topik_writing_54_questions', 'topik_writing_topic_master', 'topik_writing_tag_master',
  'topik_writing_question_tags', 'topik_writing_question_source_map',
  'topik_writing_question_recommendation_view',
];
const EXPECT_ADMIN_MIN = {
  topik_writing_51_questions: 1, topik_writing_52_questions: 1, topik_writing_53_questions: 1,
  topik_writing_54_questions: 1, topik_writing_topic_master: 85, topik_writing_tag_master: 19,
  topik_writing_question_tags: 0, topik_writing_question_source_map: 4,
  topik_writing_question_recommendation_view: 4,
};

async function countAll(client, label, expectZero) {
  const counts = {};
  for (const obj of OBJECTS) {
    const { data, error } = await client.from(obj).select('*');
    if (error) { counts[obj] = `error: ${error.message}`; }
    else counts[obj] = data.length;
    if (expectZero) {
      step(`${label} SELECT ${obj} 차단(0행)`, !error && data.length === 0, `rows=${counts[obj]}`);
    }
  }
  return counts;
}

const anonClient = createClient(URL_BASE, ANON, { auth: { persistSession: false } });
report.anonCounts = await countAll(anonClient, 'anon', true);

const userClient = createClient(URL_BASE, ANON, { auth: { persistSession: false } });
{
  const { error } = await userClient.auth.signInWithPassword({ email: USER_EMAIL, password: USER_PASSWORD });
  step('비admin 로그인', !error, error?.message);
}
report.userCounts = await countAll(userClient, '비admin', true);

const adminClient = createClient(URL_BASE, ANON, { auth: { persistSession: false } });
{
  const { error } = await adminClient.auth.signInWithPassword({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  step('admin 로그인', !error, error?.message);
}
const adminCounts = {};
for (const obj of OBJECTS) {
  const { data, error } = await adminClient.from(obj).select('*');
  adminCounts[obj] = error ? `error: ${error.message}` : data.length;
  const min = EXPECT_ADMIN_MIN[obj];
  step(`admin SELECT ${obj} 허용(>=${min})`, !error && data.length >= min, `rows=${adminCounts[obj]}`);
}
report.adminCounts = adminCounts;

// ── 3. 비admin 쓰기 차단 (직접 INSERT + RPC) ────────────────────────────
{
  const { error } = await userClient.from('topik_writing_51_questions').insert({ ...PILOTS[51], question_id: 'topik-writing-51-9998' });
  step('비admin 직접 INSERT 차단', Boolean(error), error?.message ?? 'INSERT가 허용됨(차단 실패)');
}
{
  const { error } = await userClient.rpc('admin_update_topik_question', {
    p_question_id: PILOTS[51].question_id, p_item_number: 51, p_patch: { content_team_memo: 'should fail' },
  });
  step('비admin RPC 거부(forbidden)', Boolean(error), error?.message ?? 'RPC가 허용됨(차단 실패)');
}

// ── 4. admin RPC 왕복 + 감사 로그 ───────────────────────────────────────
let tagAssignmentId = null;
{
  const { data, error } = await adminClient.rpc('admin_assign_question_tag', {
    p_question_id: PILOTS[51].question_id, p_item_number: 51,
    p_tag_code: 'rec_first_entry', p_tag_value: null, p_memo: '파일럿 태그 부여',
  });
  tagAssignmentId = data;
  step('admin_assign_question_tag RPC', !error && Number.isInteger(data), error?.message ?? `assignment_id=${data}`);
}
{
  const { error } = await adminClient.rpc('admin_update_topik_question', {
    p_question_id: PILOTS[51].question_id, p_item_number: 51,
    p_patch: { review_workflow_status: 'in_progress', content_team_memo: '파일럿 메모 갱신', __note: '파일럿 검수 사유' },
  });
  step('admin_update_topik_question RPC', !error, error?.message);
}
{
  const { data, error } = await adminClient.from('topik_writing_51_questions')
    .select('review_workflow_status, content_team_memo').eq('question_id', PILOTS[51].question_id).single();
  const ok = !error && data?.review_workflow_status === 'in_progress' && data?.content_team_memo === '파일럿 메모 갱신';
  step('RPC write 반영 확인(재조회)', ok, data ?? error?.message);
}
{
  const { data, error } = await service.from('admin_audit_logs')
    .select('action, target_table, target_id, diff, payload')
    .eq('target_id', PILOTS[51].question_id).order('created_at', { ascending: false });
  const actions = (data ?? []).map((r) => r.action);
  const ok = !error && actions.includes('tag_assigned') && actions.includes('review_status_changed')
    && data.every((r) => r.target_table === 'AssessmentQuestion')
    && JSON.stringify(data).includes('파일럿 검수 사유');
  step('감사 로그 역추적(tag_assigned + review_status_changed + __note payload)', ok, actions);
  report.auditRows = data;
}

// ── 5. RT-1 왕복: 필드별 비교 (테이블 직조회 / 뷰 / 태그 조인) ──────────
// jsonb는 객체 키 순서를 보존하지 않으므로 키 정렬 정규화 후 비교한다.
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((k) => [k, canonical(value[k])]));
  }
  return value;
}
function fieldDiff(expected, actual, keys) {
  const diffs = [];
  for (const k of keys) {
    const e = expected[k];
    const a = actual?.[k];
    if (JSON.stringify(canonical(e)) !== JSON.stringify(canonical(a))) diffs.push({ field: k, expected: e, actual: a });
  }
  return diffs;
}
const VIEW_KEYS = ['question_id', 'item_number', 'target_level', 'difficulty_level', 'topic_main', 'topic_detail', 'speech_act', 'scenario_type', 'recommendation_keys', 'avoid_repeat_keys', 'review_status', 'service_status', 'situation_summary', 'question_type_name'];
for (const n of NUMS) {
  const pilot = PILOTS[n];
  const keys = Object.keys(pilot).filter((k) => !['content_team_memo', 'review_workflow_status'].includes(k) || n !== 51); // 51은 RPC로 메모/워크플로 변경됨
  const { data: row, error } = await adminClient.from(TABLES[n]).select('*').eq('question_id', pilot.question_id).single();
  const diffs = error ? [{ field: '(query)', expected: 'row', actual: error.message }] : fieldDiff(pilot, row, keys);
  step(`RT-1 테이블 직조회 일치 ${TABLES[n]}`, diffs.length === 0, diffs.length ? diffs : `${keys.length} fields equal`);
  const { data: vrow, error: vErr } = await adminClient.from('topik_writing_question_recommendation_view').select('*').eq('question_id', pilot.question_id).single();
  const vKeys = VIEW_KEYS.filter((k) => n !== 51 || !['content_team_memo', 'review_workflow_status'].includes(k));
  const vDiffs = vErr ? [{ field: '(query)', expected: 'row', actual: vErr.message }] : fieldDiff(pilot, vrow, vKeys);
  step(`RT-1 추천 뷰 일치 ${n}`, vDiffs.length === 0, vDiffs.length ? vDiffs : `${vKeys.length} fields equal`);
}
{
  const { data, error } = await adminClient.from('topik_writing_question_tags')
    .select('question_id, item_number, tag_code, is_active, memo, topik_writing_tag_master(tag_name_ko, tag_group)')
    .eq('question_id', PILOTS[51].question_id).eq('is_active', true);
  const row = data?.[0];
  const ok = !error && row?.tag_code === 'rec_first_entry' && row?.topik_writing_tag_master?.tag_name_ko === '첫 진입용';
  step('RT-1 태그 조인 일치', ok, row ?? error?.message);
}

// ── 6. 파일럿 정리 (채번 오염 방지) ─────────────────────────────────────
{
  await service.from('topik_writing_question_tags').delete().in('question_id', NUMS.map((n) => PILOTS[n].question_id));
  await service.from('topik_writing_question_source_map').delete().eq('backfill_batch', 'pilot');
  for (const n of NUMS) await service.from(TABLES[n]).delete().eq('question_id', PILOTS[n].question_id);
  const { data } = await service.from('topik_writing_question_recommendation_view').select('question_id');
  step('파일럿 행 정리(0행 확인)', (data ?? []).length === 0, `remaining=${data?.length}`);
}

report.finishedAt = new Date().toISOString();
report.failed = failed;
const outFlag = process.argv.indexOf('--out');
if (outFlag >= 0) writeFileSync(process.argv[outFlag + 1], JSON.stringify(report, null, 2));
console.log(`\n${failed === 0 ? 'ALL PASS' : `${failed} FAILURE(S)`} — steps: ${report.steps.length}`);
process.exit(failed === 0 ? 0 : 1);
