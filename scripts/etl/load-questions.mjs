#!/usr/bin/env node
// P2 ETL 3/4 — load (실행 계획안 §6.2-3).
// transform 산출 payload를 service-role로 idempotent upsert(question_id 충돌 갱신)하고
// source_map을 동시 기록한다. 적재 후 전 행 canonical 해시를 남겨 2회 연속 실행
// diff 0건(P2-1)의 비교 기준으로 쓴다.
//
// Usage: node scripts/etl/load-questions.mjs [--in <dir>] [--report <path>]

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { loadEnvLocal, requireEnv, ETL_EVIDENCE_DIR } from './lib/env.mjs';
import { TABLES, canonical } from './lib/transform-core.mjs';

loadEnvLocal();
requireEnv('VITE_SUPABASE_URL', 'SUPABASE_SECRET_KEY');

const args = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : dflt;
};
const IN = flag('--in', join(ETL_EVIDENCE_DIR, 'transform-out'));
const REPORT = flag('--report', join(ETL_EVIDENCE_DIR, `load-report-${Date.now()}.json`));

const service = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});

const report = { startedAt: new Date().toISOString(), in: IN, upserted: {}, errors: [] };
const CHUNK = 100;

async function upsertAll(table, rows, conflict) {
  let n = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error } = await service.from(table).upsert(chunk, { onConflict: conflict });
    if (error) {
      report.errors.push({ table, offset: i, message: error.message });
      console.error(`${table} upsert 실패 @${i}: ${error.message}`);
      process.exit(1);
    }
    n += chunk.length;
  }
  return n;
}

for (const no of [51, 52, 53, 54]) {
  const rows = JSON.parse(readFileSync(join(IN, `payload-${no}.json`), 'utf8'));
  report.upserted[TABLES[no]] = await upsertAll(TABLES[no], rows, 'question_id');
}
const sourceMapRows = JSON.parse(readFileSync(join(IN, 'source-map.json'), 'utf8'));
report.upserted.topik_writing_question_source_map = await upsertAll(
  'topik_writing_question_source_map', sourceMapRows, 'question_id');

// 적재 결과 전 행 canonical 해시 (P2-1 idempotency 비교 기준)
async function tableHash(table) {
  const all = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await service.from(table).select('*').order('question_id').range(from, from + 999);
    if (error) throw new Error(`${table} 재조회 실패: ${error.message}`);
    all.push(...data);
    if (data.length < 1000) break;
  }
  return {
    rows: all.length,
    sha256: createHash('sha256').update(JSON.stringify(canonical(all))).digest('hex'),
  };
}
report.postLoad = {};
for (const t of [...Object.values(TABLES), 'topik_writing_question_source_map']) {
  report.postLoad[t] = await tableHash(t);
}

report.finishedAt = new Date().toISOString();
writeFileSync(REPORT, JSON.stringify(report, null, 2));
console.log(`load 완료: ${JSON.stringify(report.upserted)}`);
for (const [t, h] of Object.entries(report.postLoad)) console.log(`${t}: rows=${h.rows} sha256=${h.sha256.slice(0, 16)}…`);
console.log(`report: ${REPORT}`);
