#!/usr/bin/env node
// P2 ETL 1/4 — extract (실행 계획안 §6.2-1).
// v13 `problems` 51~54 전수를 service-role로 덤프한다 (D-9 확정 범위: 검수 상태 무관).
// 정렬은 D-4 채번 타이브레이커와 동일한 (created_at, id) — 결정적 순서를 덤프 단계에서 고정.
// 출력: .omx/evidence/etl/problems-dump.json (비추적) + extract-report.json (구조 실측 리포트)

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { loadEnvLocal, requireEnv, ETL_EVIDENCE_DIR } from './lib/env.mjs';

loadEnvLocal();
requireEnv('VITE_SUPABASE_URL', 'SUPABASE_SECRET_KEY');

const service = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});

const PAGE = 500;
const rows = [];
for (let from = 0; ; from += PAGE) {
  const { data, error } = await service
    .from('problems')
    .select('*')
    .in('question_no', [51, 52, 53, 54])
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
    .range(from, from + PAGE - 1);
  if (error) {
    console.error(`extract failed at offset ${from}: ${error.message}`);
    process.exit(1);
  }
  rows.push(...data);
  if (data.length < PAGE) break;
}

// ── 구조 실측 리포트 (transform의 NOT NULL 파생 가능성 판단 입력) ─────────
const report = {
  extractedAt: new Date().toISOString(),
  total: rows.length,
  byNoStatus: {},
  columns: rows.length ? Object.keys(rows[0]) : [],
  materialsKeys: {},
  taxonomyKeys: {},
  scenarioKeys: {},
  derivationSignals: {},
};
for (const r of rows) {
  const k = `${r.question_no}/${r.review_status}`;
  report.byNoStatus[k] = (report.byNoStatus[k] ?? 0) + 1;
  const no = r.question_no;
  const m = r.materials ?? {};
  report.materialsKeys[no] ??= {};
  for (const key of Object.keys(m)) report.materialsKeys[no][key] = (report.materialsKeys[no][key] ?? 0) + 1;
  report.taxonomyKeys[no] ??= {};
  for (const key of Object.keys(m.taxonomy ?? {})) report.taxonomyKeys[no][key] = (report.taxonomyKeys[no][key] ?? 0) + 1;
  report.scenarioKeys[no] ??= {};
  for (const key of Object.keys(m.scenario ?? {})) report.scenarioKeys[no][key] = (report.scenarioKeys[no][key] ?? 0) + 1;
  const sig = (report.derivationSignals[no] ??= {
    rows: 0, hasTitle: 0, hasPrompt: 0, hasAnswerKey: 0, hasBlanks: 0, hasCharts: 0,
    hasResolvedText: 0, hasValidation: 0, hasScenario: 0, hasTaxonomy: 0,
  });
  sig.rows += 1;
  if (r.title) sig.hasTitle += 1;
  if (r.prompt) sig.hasPrompt += 1;
  if (r.answer_key) sig.hasAnswerKey += 1;
  if (m.blanks) sig.hasBlanks += 1;
  if (m.charts) sig.hasCharts += 1;
  if (m.source_context?.resolved_text) sig.hasResolvedText += 1;
  if (m.review?.validation) sig.hasValidation += 1;
  if (m.scenario) sig.hasScenario += 1;
  if (m.taxonomy) sig.hasTaxonomy += 1;
}

mkdirSync(ETL_EVIDENCE_DIR, { recursive: true });
const dumpPath = join(ETL_EVIDENCE_DIR, 'problems-dump.json');
writeFileSync(dumpPath, JSON.stringify(rows, null, 1));
writeFileSync(join(ETL_EVIDENCE_DIR, 'extract-report.json'), JSON.stringify(report, null, 2));

console.log(`extracted ${rows.length} rows -> ${dumpPath}`);
console.log(JSON.stringify(report.byNoStatus, null, 2));
console.log('materials keys:', JSON.stringify(report.materialsKeys));
