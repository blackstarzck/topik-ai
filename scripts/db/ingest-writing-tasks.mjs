#!/usr/bin/env node
// 외부 공급 API의 쓰기 문항을 무손실 인박스(topik_writing_question_import)에 적재하고
// §7 정식 문항으로 승격한다. (P6 — docs/plans/question-bank-ingest-flow-plan.html)
//
// 소스: GET /api/writing/tasks/{Q51..Q54} (타입별 페이지네이션, full §7 응답).
//   - 목록(/api/writing/tasks)은 요약뿐이라 승격에 불충분 → 상세(full)를 받는다.
// 적재: admin_ingest_writing_tasks_bulk(멱등·버전·무손실). question_id 기준.
// 승격: admin_promote_writing_questions(§7 upsert — 콘텐츠 덮어쓰기 / 노출·태그 보존).
//
// 인증: 상류 API_BASE_URL + API_ACCOUNT_INFO_EMAIL/PASSWORD. DB는 SUPABASE_ACCESS_TOKEN
//   (Management API). .env.local 자동 로드(process.env 우선).
//
// 사용:
//   node scripts/db/ingest-writing-tasks.mjs                  # 전 유형 적재+승격
//   node scripts/db/ingest-writing-tasks.mjs --task-type Q53  # 특정 유형
//   node scripts/db/ingest-writing-tasks.mjs --limit 50       # 최대 N건
//   node scripts/db/ingest-writing-tasks.mjs --dry-run        # 받아서 집계만(쓰기 없음)
//   node scripts/db/ingest-writing-tasks.mjs --no-promote     # 적재만(승격 생략)

import { readFileSync, existsSync } from 'node:fs';

const env = { ...process.env };
if (existsSync('.env.local')) {
  for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const m = /^([A-Za-z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (m && env[m[1]] === undefined) {
      let v = m[2];
      if (/^".*"$/.test(v) || /^'.*'$/.test(v)) v = v.slice(1, -1);
      env[m[1]] = v;
    }
  }
}

const BASE = (env.API_BASE_URL || '').replace(/\/$/, '');
const EMAIL = env.API_ACCOUNT_INFO_EMAIL || '';
const PASSWORD = env.API_ACCOUNT_INFO_PASSWORD || '';
const MGMT = env.SUPABASE_ACCESS_TOKEN || '';
const PROJECT_REF = env.SUPABASE_PROJECT_REF || 'fglggyfvzjdsbyckinqa';
const SOURCE_ENDPOINT = '/api/writing/tasks';
const TASK_TYPES = ['Q51', 'Q52', 'Q53', 'Q54'];
const REVIEW_COMPLETE = '검수 완료'; // 검수 완료 게이트(fail-closed): 이 값만 적재
const PAGE = 50; // 상류 목록 limit 상한(라이브 확인: limit<=50)
const CHUNK = 50; // 벌크 RPC 1회당 항목 수

const args = process.argv.slice(2);
const getArg = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const normalizeType = (v) => { const m = /(51|52|53|54)/.exec(String(v || '')); return m ? `Q${m[1]}` : null; };
const taskType = normalizeType(getArg('--task-type'));
const maxLimit = getArg('--limit') ? Number(getArg('--limit')) : null;
const dryRun = args.includes('--dry-run');
const noPromote = args.includes('--no-promote');

function fail(msg) { console.error(msg); process.exit(1); }
if (!BASE || !EMAIL || !PASSWORD) fail('API_BASE_URL / API_ACCOUNT_INFO_EMAIL / API_ACCOUNT_INFO_PASSWORD missing.');
if (!dryRun && !MGMT) fail('SUPABASE_ACCESS_TOKEN missing (needed to write).');

async function runSql(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST', headers: { Authorization: `Bearer ${MGMT}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ query: sql })
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`SQL HTTP ${res.status}: ${text.slice(0, 300)}`);
  try { return JSON.parse(text); } catch { return text; }
}
const dq = (s) => `$tw$${String(s)}$tw$`;

async function login() {
  const r = await fetch(`${BASE}/api/eval/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: EMAIL, password: PASSWORD }) });
  if (!r.ok) throw new Error(`upstream login failed: ${r.status} ${(await r.text()).slice(0, 200)}`);
  const token = JSON.parse(await r.text()).token;
  if (!token) throw new Error('upstream login returned no token');
  return token;
}

// 타입별 상세(full §7) 전체 페이지네이션 수신.
async function fetchAll(token) {
  const items = [];
  for (const t of taskType ? [taskType] : TASK_TYPES) {
    let offset = 0;
    for (;;) {
      const r = await fetch(`${BASE}/api/writing/tasks/${t}?limit=${PAGE}&offset=${offset}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error(`upstream detail ${t} failed: ${r.status} ${(await r.text()).slice(0, 200)}`);
      const body = JSON.parse(await r.text());
      const page = Array.isArray(body) ? body : (body.items || []);
      items.push(...page);
      offset += PAGE;
      if (maxLimit && items.length >= maxLimit) { items.length = maxLimit; return items; }
      if (page.length < PAGE) break;
    }
  }
  return items;
}

async function main() {
  const token = await login();
  const items = await fetchAll(token);
  // 검수 완료 게이트: review_status가 정확히 '검수 완료'인 항목만 적재한다.
  const reviewed = items.filter((it) => it.review_status === REVIEW_COMPLETE);
  const skippedReview = items.length - reviewed.length;
  const byNum = reviewed.reduce((a, it) => { const n = it.item_number ?? '미상'; a[n] = (a[n] || 0) + 1; return a; }, {});
  console.log(`fetched ${items.length}` + (taskType ? ` (${taskType})` : '') + ` | 검수완료 ${reviewed.length} (제외 ${skippedReview}) | by number: ${JSON.stringify(byNum)}`);
  if (reviewed[0]) console.log('sample question_id:', reviewed[0].question_id, '| keys:', Object.keys(reviewed[0]).length);

  if (dryRun) { console.log('[dry-run] no write.'); return; }

  const adminRows = await runSql("select id from public.profiles where app_role in ('content_admin','platform_admin') limit 1");
  const actor = env.INGEST_ACTOR_ID || adminRows[0]?.id;
  if (!actor) fail('no content_admin/platform_admin actor found (set INGEST_ACTOR_ID).');

  // 적재(벌크, 청크 단위)
  let ingested = 0;
  for (let i = 0; i < reviewed.length; i += CHUNK) {
    const slice = reviewed.slice(i, i + CHUNK).map((it) => ({
      source_task_id: it.question_id,
      raw_payload: it,
      raw_response_text: JSON.stringify(it),
      item_number: it.item_number ?? null
    }));
    await runSql(`select public.admin_ingest_writing_tasks_bulk('${actor}'::uuid, '${SOURCE_ENDPOINT}', ${dq(JSON.stringify(slice))}::jsonb);`);
    ingested += slice.length;
    process.stdout.write(`\ringested ${ingested}/${reviewed.length}`);
  }
  process.stdout.write('\n');

  // 승격(§7 upsert) — 인박스 is_latest raw/held 전체
  if (!noPromote) {
    const prom = await runSql(`select public.admin_promote_writing_questions('${actor}'::uuid, null) as r;`);
    console.log('promote:', JSON.stringify(prom[0].r));
  }

  const summary = await runSql(`
    select
      (select count(*)::int from public.topik_writing_question_import where source_endpoint='${SOURCE_ENDPOINT}' and is_latest) as inbox_latest,
      (select count(*)::int from public.topik_writing_question_import where is_latest and mapping_status='promoted') as promoted,
      (select count(*)::int from public.topik_writing_question_import where is_latest and mapping_status='held') as held,
      (select count(*)::int from public.topik_writing_question_recommendation_view) as in_view;`);
  console.log('summary:', JSON.stringify(summary[0]));
}

main().catch((e) => { console.error('\nFATAL', e.message); process.exit(1); });
