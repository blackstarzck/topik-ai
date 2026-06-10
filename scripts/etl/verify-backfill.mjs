#!/usr/bin/env node
// P2 ETL 4/4 — verify (실행 계획안 §6.3 검증 5종 + RT-2 재조회 왕복).
// 비교 대상은 변환 산출물이 아니라 "DB에 실제로 저장된 값"이다 (§12.0).
//   1) 재조립: 51/52 — DB의 prompt_text+대표정답 → resolved_text 일치
//   2) 보존: DB answer_key == 원본 problems.answer_key, 51 blank_* == answer_key 필드
//   3) 수량: 덤프 = 적재 + 보류, 테이블별 건수 일치
//   4) 축: topic (main, detail)·secondary 쌍 전부 topic_master 집합 포함
//   5) RT-2: DB 행 vs upsert payload 필드별 diff 0건
//   +) D-6: 전 행 service_status='internal_test' 확인
//
// Usage: node scripts/etl/verify-backfill.mjs [--in <dir>] [--dump <path>] [--report <path>]

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { loadEnvLocal, requireEnv, ETL_EVIDENCE_DIR } from './lib/env.mjs';
import { TABLES, canonical, jsonEqual, reassembleMatches } from './lib/transform-core.mjs';

loadEnvLocal();
requireEnv('VITE_SUPABASE_URL', 'SUPABASE_SECRET_KEY');

const args = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : dflt;
};
const IN = flag('--in', join(ETL_EVIDENCE_DIR, 'transform-out'));
const DUMP = flag('--dump', join(ETL_EVIDENCE_DIR, 'problems-dump.json'));
const REPORT = flag('--report', join(ETL_EVIDENCE_DIR, `verify-report-${Date.now()}.json`));

const service = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});

const dump = JSON.parse(readFileSync(DUMP, 'utf8'));
const dumpById = new Map(dump.map((r) => [r.id, r]));
const payloads = {};
for (const no of [51, 52, 53, 54]) payloads[no] = JSON.parse(readFileSync(join(IN, `payload-${no}.json`), 'utf8'));
const sourceMapRows = JSON.parse(readFileSync(join(IN, 'source-map.json'), 'utf8'));
const holds = JSON.parse(readFileSync(join(IN, 'holds.json'), 'utf8'));
const legacyByQuestionId = new Map(sourceMapRows.map((m) => [m.question_id, m.legacy_problem_id]));

async function selectAll(table, columns = '*', orderBy = 'question_id') {
  const all = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await service.from(table).select(columns).order(orderBy).range(from, from + 999);
    if (error) throw new Error(`${table} 조회 실패: ${error.message}`);
    all.push(...data);
    if (data.length < 1000) break;
  }
  return all;
}

const report = { verifiedAt: new Date().toISOString(), in: IN, checks: {}, failed: 0 };
function check(name, ok, detail) {
  report.checks[name] = { ok, detail };
  if (!ok) report.failed += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail != null ? ` — ${typeof detail === 'string' ? detail : JSON.stringify(detail).slice(0, 400)}` : ''}`);
}

const db = {};
for (const no of [51, 52, 53, 54]) db[no] = await selectAll(TABLES[no]);

// 1) 재조립 검증 (51/52)
for (const no of [51, 52]) {
  const fails = db[no].filter((r) => !reassembleMatches(
    r.prompt_text, r.blank_1_canonical_answer, r.blank_2_canonical_answer, r.resolved_text));
  check(`재조립 ${no} (${db[no].length}행)`, fails.length === 0, fails.length ? fails.map((f) => f.question_id) : 'all match');
}

// 2) 보존 검증: answer_key 원본 동치 + 51 정규화 컬럼 동치
{
  const fails = [];
  for (const no of [51, 52, 53, 54]) {
    for (const r of db[no]) {
      const legacy = dumpById.get(legacyByQuestionId.get(r.question_id));
      if (!legacy) { fails.push({ q: r.question_id, why: 'legacy 원행 없음' }); continue; }
      if (!jsonEqual(r.answer_key, legacy.answer_key)) fails.push({ q: r.question_id, why: 'answer_key 불일치' });
    }
  }
  for (const r of db[51]) {
    const legacy = dumpById.get(legacyByQuestionId.get(r.question_id));
    for (const b of [1, 2]) {
      const src = legacy?.answer_key?.[`blank_${b}`] ?? {};
      for (const [col, key] of [['role', 'role'], ['function', 'function'], ['answer_type', 'answer_type'], ['canonical_answer', 'canonical_answer']]) {
        if (r[`blank_${b}_${col}`] !== (src[key] ?? null)) fails.push({ q: r.question_id, why: `blank_${b}_${col} 불일치` });
      }
      if (!jsonEqual(r[`blank_${b}_accepted_answers`], src.accepted_answers ?? null)) fails.push({ q: r.question_id, why: `blank_${b}_accepted_answers 불일치` });
    }
  }
  check('보존 (answer_key 원본 + 51 정규화 동치)', fails.length === 0, fails.length ? fails.slice(0, 10) : `${db[51].length + db[52].length + db[53].length + db[54].length}행 동치`);
}

// 3) 수량 검증
{
  const loaded = [51, 52, 53, 54].reduce((s, no) => s + db[no].length, 0);
  const ok = dump.length === loaded + holds.length
    && [51, 52, 53, 54].every((no) => db[no].length === payloads[no].length);
  check('수량 (덤프 = 적재 + 보류)', ok, { dump: dump.length, loaded, held: holds.length, perTable: Object.fromEntries([51, 52, 53, 54].map((no) => [no, db[no].length])) });
}

// 4) 축 검증: topic 쌍이 topic_master 집합에 포함
{
  const master = await selectAll('topik_writing_topic_master', 'topic_main, topic_detail', 'topic_main');
  const allowed = new Set(master.map((t) => `${t.topic_main}|${t.topic_detail}`));
  const fails = [];
  for (const no of [51, 52, 53, 54]) {
    for (const r of db[no]) {
      if (!allowed.has(`${r.topic_main}|${r.topic_detail}`)) fails.push({ q: r.question_id, pair: `${r.topic_main}/${r.topic_detail}` });
      if (r.secondary_topic_main && !allowed.has(`${r.secondary_topic_main}|${r.secondary_topic_detail}`)) fails.push({ q: r.question_id, pair: `2차 ${r.secondary_topic_main}/${r.secondary_topic_detail}` });
    }
  }
  check(`축 (topic_master ${allowed.size}쌍 포함)`, fails.length === 0, fails.length ? fails.slice(0, 10) : 'all in master');
}

// 5) RT-2: DB 재조회 vs payload 필드별 diff 0건
{
  let compared = 0;
  const diffs = [];
  for (const no of [51, 52, 53, 54]) {
    const dbById = new Map(db[no].map((r) => [r.question_id, r]));
    for (const p of payloads[no]) {
      const row = dbById.get(p.question_id);
      if (!row) { diffs.push({ q: p.question_id, field: '(row missing)' }); continue; }
      for (const k of Object.keys(p)) {
        let a = p[k]; let b = row[k];
        if (k === 'created_at' || k === 'updated_at') {
          if ((a && Date.parse(a)) !== (b && Date.parse(b))) diffs.push({ q: p.question_id, field: k, payload: a, db: b });
          continue;
        }
        if (!jsonEqual(a, b)) diffs.push({ q: p.question_id, field: k, payload: a, db: b });
      }
      compared += 1;
    }
  }
  check(`RT-2 재조회 왕복 (${compared}행 필드별 비교)`, diffs.length === 0, diffs.length ? diffs.slice(0, 10) : 'diff 0건');
  report.rt2 = { compared, diffCount: diffs.length, diffs: diffs.slice(0, 100) };
}

// +) D-6: 전 행 internal_test
{
  const fails = [51, 52, 53, 54].flatMap((no) => db[no].filter((r) => r.service_status !== 'internal_test').map((r) => r.question_id));
  check("service_status 전 행 'internal_test' (D-6)", fails.length === 0, fails.length ? fails : null);
}

// +) source_map 전수 대사 (P2-4)
{
  const dbMap = await selectAll('topik_writing_question_source_map');
  const batchRows = dbMap.filter((m) => m.legacy_problem_id);
  const loadedCount = [51, 52, 53, 54].reduce((s, no) => s + db[no].length, 0);
  const holdCount = batchRows.filter((m) => m.hold_reason != null).length;
  const ok = batchRows.length === dump.length && holdCount === holds.length
    && batchRows.length - holdCount === loadedCount
    && batchRows.every((m) => m.legacy_publish_status != null && m.legacy_visibility != null);
  check('source_map 전수 (매핑=덤프, 보류 hold_reason, legacy 노출 신호 보존)', ok,
    { mapped: batchRows.length, holds: holdCount, loaded: loadedCount });
}

report.overall = report.failed === 0 ? 'PASS' : 'FAIL';
writeFileSync(REPORT, JSON.stringify(report, null, 2));
console.log(`\n검증 ${report.overall} — report: ${REPORT}`);
process.exit(report.failed === 0 ? 0 : 1);
