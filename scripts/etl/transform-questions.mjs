#!/usr/bin/env node
// P2 ETL 2/4 — transform (실행 계획안 §6.2-2).
// problems 덤프 + 재분류 입력표(D-3) + source_map 선조회(D-4) → 테이블별 upsert payload
// + 적재 보류 목록(D-5) + source_map 행 + 변환 리포트.
//
// Usage:
//   node scripts/etl/transform-questions.mjs [--dump <path>] [--batch <label>] [--out <dir>]

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { loadEnvLocal, requireEnv, ETL_EVIDENCE_DIR, REPO_ROOT } from './lib/env.mjs';
import { transformAll } from './lib/transform-core.mjs';

loadEnvLocal();
requireEnv('VITE_SUPABASE_URL', 'SUPABASE_SECRET_KEY');

const args = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : dflt;
};
const DUMP = flag('--dump', join(ETL_EVIDENCE_DIR, 'problems-dump.json'));
const BATCH = flag('--batch', 'p2-2026-06-10');
const OUT = flag('--out', join(ETL_EVIDENCE_DIR, 'transform-out'));
const CLS_PATH = join(REPO_ROOT, 'data', 'etl', 'reclassification-input.json');

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8').replace(/^﻿/, ''));
const rows = readJson(DUMP);
const clsRows = readJson(CLS_PATH).rows;
const classificationById = new Map(clsRows.map((c) => [c.legacy_problem_id, c]));

// D-4: source_map 선조회 (기존 매핑 재사용 — idempotent 채번)
const service = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});
const existing = new Map();
for (let from = 0; ; from += 1000) {
  const { data, error } = await service
    .from('topik_writing_question_source_map')
    .select('question_id, legacy_problem_id')
    .range(from, from + 999);
  if (error) {
    console.error(`source_map 선조회 실패: ${error.message}`);
    process.exit(1);
  }
  for (const m of data) if (m.legacy_problem_id) existing.set(m.legacy_problem_id, m);
  if (data.length < 1000) break;
}

const { payloads, holds, sourceMapRows, report } = transformAll(rows, classificationById, existing, BATCH);

mkdirSync(OUT, { recursive: true });
for (const no of [51, 52, 53, 54]) {
  writeFileSync(join(OUT, `payload-${no}.json`), JSON.stringify(payloads[no], null, 1));
}
writeFileSync(join(OUT, 'source-map.json'), JSON.stringify(sourceMapRows, null, 1));
writeFileSync(join(OUT, 'holds.json'), JSON.stringify(holds, null, 2));
writeFileSync(join(OUT, 'transform-report.json'), JSON.stringify({
  transformedAt: new Date().toISOString(),
  dump: DUMP,
  batch: BATCH,
  existingMappingsReused: existing.size,
  ...report,
  holds,
}, null, 2));

console.log(`transform: input=${report.input} loaded=${report.loaded} held=${report.held}`);
console.log(`per table: ${JSON.stringify(report.perTable)} (existing mappings reused: ${existing.size})`);
if (report.autoChecksFailed.length) console.log(`auto_checks_passed=false: ${report.autoChecksFailed.join(', ')}`);
for (const h of holds) console.log(`HOLD ${h.question_id} [${h.item_number}] ${h.title} — ${h.reasons.join(' | ')}`);
