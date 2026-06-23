// Generates the backend-handoff API inventory doc (markdown + HTML) from the workflow JSON.
import fs from 'node:fs';

const SRC = 'C:/Users/admin/AppData/Local/Temp/claude/C--Users-admin-Desktop-workspace-topik-ai/e3677ece-f3e4-4879-a217-95eb53f904d4/tasks/wnfrfkes0.output';
const outer = JSON.parse(fs.readFileSync(SRC, 'utf8'));
const data = typeof outer.result === 'string' ? JSON.parse(outer.result) : outer.result;

// First 9 domains are topik-ai, next 6 are v13 (parallel preserves input order).
const PROJECT_SPLIT = 9;
const domains = data.domains.map((d, i) => ({ ...d, project: i < PROJECT_SPLIT ? 'topik-ai' : 'v13' }));
const relays = (data.relays || []).flatMap((r) => (r.relays ? r.relays : [r]));

const TYPE_LABEL = {
  supabase_rpc: 'RPC',
  supabase_table: 'TABLE',
  next_api_route: 'ROUTE',
  external_service: 'EXTERNAL',
  supabase_auth: 'AUTH',
  supabase_storage: 'STORAGE',
};

// ---------- helpers ----------
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const ROOTS = { 'topik-ai': 'topik-ai', v13: 'topik-project/v13' };

// =========================================================
// MARKDOWN
// =========================================================
function mdEscape(s) { return String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' '); }

const md = [];
md.push('# v13 · topik-ai API 인벤토리 (백엔드 전달용)');
md.push('');
md.push(`> 자동 생성 — 두 프로젝트의 **프론트엔드 코드(서비스 계층) + Supabase 마이그레이션(RPC 정의)** 을 함께 읽어 작성. "기대 response"는 프론트엔드가 실제로 소비하는 형태이며, RPC는 SQL의 \`RETURNS\` / \`json_build_object\` 정의를 근거로 합니다.`);
md.push('');
md.push('## 0. 개요');
md.push('');
md.push('| 항목 | v13 (`talkpik-ai`) | topik-ai |');
md.push('|---|---|---|');
md.push('| 성격 | 학습자용 서비스 앱 | 운영자용 어드민 대시보드 |');
md.push('| 스택 | Next.js 16 (App Router), React 19, Supabase SSR | Vite + React, Supabase JS |');
md.push('| 백엔드 | Supabase (Postgres RPC + PostgREST + Auth) | 동일 Supabase 프로젝트 |');
md.push('| 외부 | 쓰기 AI 채점 API(`TALKPIK_WRITING_API_BASE_URL`), SMTP(Daou Office) | Supabase Management API, SMTP |');
md.push('');
md.push('**"API"의 의미** — 이 문서에서 API는 ① Supabase RPC(`.rpc()`), ② PostgREST 테이블 접근(`.from().select/insert/...`), ③ Next.js 라우트 핸들러(`route.ts`), ④ 외부 HTTP 서비스 4종을 포함합니다. 백엔드는 RPC 시그니처/반환과 라우트 계약을 주로 보면 됩니다.');
md.push('');
md.push('### 인증/권한 모델 요약');
md.push('- **topik-ai**: 모든 쓰기는 `admin_*` RPC(SECURITY DEFINER) 경유. 게이트는 `private.is_platform_admin` / `is_content_admin` / `is_admin`. RLS가 직접 테이블 쓰기를 차단하므로 RPC가 유일 경로.');
md.push('- **v13**: 사용자는 `auth.uid()` 기준 RLS로 자기 데이터만. 일부 RPC는 SECURITY DEFINER. 알림 워커/외부채점은 서비스롤 키 + 워커 시크릿(`NOTIFICATION_WORKER_SECRET`).');
md.push('');
md.push('### 커버리지');
md.push(`- 도메인 ${domains.length}개, API 항목 ${domains.reduce((n, d) => n + d.apis.length, 0)}개, 릴레이 시퀀스 ${relays.length}개.`);
md.push(`- 참고: \`${(data.coverage?.missing || []).join('`, `')}\` 는 직접 호출되는 API가 아니라 타입 참조/서버측 기록 대상으로만 등장(별도 프론트 호출 없음).`);
md.push('');

function mdSection(project) {
  md.push(`\n---\n\n# ${project === 'v13' ? 'A. v13 (학습자 앱)' : 'B. topik-ai (어드민)'} — \`${ROOTS[project]}\``);
  for (const d of domains.filter((x) => x.project === project)) {
    md.push(`\n## ${d.domain}`);
    for (const a of d.apis) {
      md.push(`\n### \`${a.name}\`  · ${TYPE_LABEL[a.type] || a.type} · ${a.op}`);
      md.push(`**목적**: ${a.purpose}`);
      if (a.usage?.length) {
        md.push('');
        md.push('**사용 위치**:');
        a.usage.forEach((u) => md.push(`- \`${u}\``));
      }
      if (a.request?.length) {
        md.push('');
        md.push('**요청 파라미터**:');
        md.push('| 이름 | 타입 | 필수 | 설명 |');
        md.push('|---|---|---|---|');
        a.request.forEach((p) => md.push(`| \`${mdEscape(p.name)}\` | ${mdEscape(p.type)} | ${p.required ? '✓' : ''} | ${mdEscape(p.desc)} |`));
      }
      md.push('');
      md.push('**기대 Response**:');
      md.push('```ts');
      md.push(a.responseShape || '(none)');
      md.push('```');
      if (a.responseFields?.length) {
        md.push('| 필드 | 타입 | 설명 |');
        md.push('|---|---|---|');
        a.responseFields.forEach((f) => md.push(`| \`${mdEscape(f.name)}\` | ${mdEscape(f.type)} | ${mdEscape(f.desc)} |`));
      }
      if (a.notes) { md.push(''); md.push(`**비고**: ${a.notes}`); }
    }
  }
}
mdSection('v13');
mdSection('topik-ai');

md.push('\n---\n\n# C. 릴레이 시퀀스 (API 연쇄 호출)');
md.push('');
relays.forEach((r, i) => {
  md.push(`\n## C${i + 1}. ${r.name}`);
  md.push(`- **프로젝트**: ${r.project}`);
  md.push(`- **트리거**: ${r.trigger}`);
  md.push(`- **요약**: ${r.summary}`);
  md.push('');
  (r.steps || []).sort((a, b) => a.order - b.order).forEach((s) => {
    md.push(`**${s.order}. ${s.api}**`);
    if (s.caller) md.push(`   - 호출: \`${s.caller}\``);
    if (s.input) md.push(`   - 입력: ${s.input}`);
    if (s.output) md.push(`   - 출력: ${s.output}`);
    if (s.thenWhat) md.push(`   - → 다음 단계 연결: ${s.thenWhat}`);
    md.push('');
  });
  if (r.notes) md.push(`> 비고: ${r.notes}`);
});

fs.writeFileSync('docs/api-inventory-backend-handoff.md', md.join('\n'), 'utf8');

// =========================================================
// HTML (navigable artifact)
// =========================================================
const typeColor = {
  supabase_rpc: '#7c3aed', supabase_table: '#0891b2', next_api_route: '#ea580c',
  external_service: '#dc2626', supabase_auth: '#16a34a', supabase_storage: '#64748b',
};

function reqTable(rows) {
  if (!rows?.length) return '';
  return `<table class="t"><thead><tr><th>이름</th><th>타입</th><th>필수</th><th>설명</th></tr></thead><tbody>${
    rows.map((p) => `<tr><td><code>${esc(p.name)}</code></td><td class="ty">${esc(p.type)}</td><td class="rq">${p.required ? '✓' : ''}</td><td>${esc(p.desc)}</td></tr>`).join('')
  }</tbody></table>`;
}
function fieldTable(rows) {
  if (!rows?.length) return '';
  return `<table class="t"><thead><tr><th>필드</th><th>타입</th><th>설명</th></tr></thead><tbody>${
    rows.map((f) => `<tr><td><code>${esc(f.name)}</code></td><td class="ty">${esc(f.type)}</td><td>${esc(f.desc)}</td></tr>`).join('')
  }</tbody></table>`;
}

function apiCard(a) {
  const c = typeColor[a.type] || '#64748b';
  return `<div class="api" id="api-${slug(a.name)}-${slug(a.op)}">
    <div class="api-h">
      <span class="badge" style="background:${c}">${TYPE_LABEL[a.type] || a.type}</span>
      <code class="api-name">${esc(a.name)}</code>
      <span class="op">${esc(a.op)}</span>
    </div>
    <p class="purpose">${esc(a.purpose)}</p>
    ${a.usage?.length ? `<div class="block"><h5>사용 위치</h5><ul class="usage">${a.usage.map((u) => `<li><code>${esc(u)}</code></li>`).join('')}</ul></div>` : ''}
    ${a.request?.length ? `<div class="block"><h5>요청 파라미터</h5><div class="scroll">${reqTable(a.request)}</div></div>` : ''}
    <div class="block"><h5>기대 Response</h5><pre><code>${esc(a.responseShape || '(none)')}</code></pre>${a.responseFields?.length ? `<div class="scroll">${fieldTable(a.responseFields)}</div>` : ''}</div>
    ${a.notes ? `<div class="notes"><strong>비고</strong> ${esc(a.notes)}</div>` : ''}
  </div>`;
}

function domainSection(d) {
  return `<section class="domain" id="dom-${slug(d.domain)}">
    <h3>${esc(d.domain)} <span class="count">${d.apis.length}</span></h3>
    ${d.apis.map(apiCard).join('')}
  </section>`;
}

function relayCard(r, i) {
  const steps = (r.steps || []).slice().sort((a, b) => a.order - b.order);
  return `<section class="relay" id="relay-${i + 1}">
    <h3>C${i + 1}. ${esc(r.name)} <span class="pill">${esc(r.project)}</span></h3>
    <p class="trigger"><strong>트리거</strong> ${esc(r.trigger)}</p>
    <p class="summary">${esc(r.summary)}</p>
    <ol class="steps">
      ${steps.map((s) => `<li>
        <div class="step-api"><span class="num">${s.order}</span><code>${esc(s.api)}</code></div>
        ${s.caller ? `<div class="sk"><b>호출</b> <code>${esc(s.caller)}</code></div>` : ''}
        ${s.input ? `<div class="sk"><b>입력</b> ${esc(s.input)}</div>` : ''}
        ${s.output ? `<div class="sk"><b>출력</b> ${esc(s.output)}</div>` : ''}
        ${s.thenWhat ? `<div class="sk then"><b>→ 다음</b> ${esc(s.thenWhat)}</div>` : ''}
      </li>`).join('')}
    </ol>
    ${r.notes ? `<div class="notes"><strong>비고</strong> ${esc(r.notes)}</div>` : ''}
  </section>`;
}

const navProjects = ['v13', 'topik-ai'].map((p) => {
  const ds = domains.filter((x) => x.project === p);
  return `<div class="nav-group"><div class="nav-proj">${p === 'v13' ? 'A · v13 (학습자)' : 'B · topik-ai (어드민)'}</div>${
    ds.map((d) => `<a href="#dom-${slug(d.domain)}">${esc(d.domain)}<span>${d.apis.length}</span></a>`).join('')
  }</div>`;
}).join('');
const navRelays = `<div class="nav-group"><div class="nav-proj">C · 릴레이 시퀀스</div>${
  relays.map((r, i) => `<a href="#relay-${i + 1}">C${i + 1}. ${esc(r.name.slice(0, 38))}</a>`).join('')
}</div>`;

const totalApis = domains.reduce((n, d) => n + d.apis.length, 0);
const countBy = (t) => domains.reduce((n, d) => n + d.apis.filter((a) => a.type === t).length, 0);

const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>API 인벤토리 — v13 · topik-ai (백엔드 전달용)</title>
<style>
:root{--bg:#0f1115;--panel:#171a21;--panel2:#1d212b;--bd:#2a3040;--tx:#e6e9ef;--mut:#9aa4b2;--ac:#7c3aed;--cyan:#22d3ee;}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--tx);font:14px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Malgun Gothic","Apple SD Gothic Neo",sans-serif}
code{font-family:"SFMono-Regular",Consolas,"Liberation Mono",monospace;font-size:.86em}
.layout{display:flex;align-items:flex-start}
nav{position:sticky;top:0;height:100vh;overflow-y:auto;width:280px;flex:0 0 280px;background:var(--panel);border-right:1px solid var(--bd);padding:18px 12px}
nav h1{font-size:14px;margin:0 0 4px;letter-spacing:.02em}
nav .sub{color:var(--mut);font-size:11px;margin-bottom:16px}
.nav-group{margin-bottom:14px}
.nav-proj{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--cyan);font-weight:700;padding:4px 8px}
nav a{display:flex;justify-content:space-between;gap:8px;color:var(--mut);text-decoration:none;padding:4px 8px;border-radius:6px;font-size:12.5px}
nav a:hover{background:var(--panel2);color:var(--tx)}
nav a span{background:var(--bd);color:var(--tx);border-radius:10px;padding:0 7px;font-size:10px;align-self:center}
main{flex:1;min-width:0;max-width:1100px;margin:0 auto;padding:32px 36px 120px}
.hero h1{font-size:26px;margin:0 0 6px}
.hero p{color:var(--mut);margin:.3em 0}
.stats{display:flex;flex-wrap:wrap;gap:10px;margin:18px 0 10px}
.stat{background:var(--panel);border:1px solid var(--bd);border-radius:10px;padding:10px 16px}
.stat b{font-size:22px;display:block}
.stat span{color:var(--mut);font-size:11px}
.legend{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0 24px;font-size:11px}
.legend .badge{font-size:10px}
.overview{background:var(--panel);border:1px solid var(--bd);border-radius:12px;padding:18px 22px;margin-bottom:30px}
.overview table{width:100%;border-collapse:collapse;margin:10px 0}
.overview th,.overview td{border:1px solid var(--bd);padding:7px 10px;text-align:left;vertical-align:top}
.overview th{background:var(--panel2);color:var(--cyan);font-size:12px}
.overview ul{margin:8px 0;padding-left:18px;color:var(--mut)}
.overview ul code{color:var(--tx)}
h2.proj{font-size:20px;margin:42px 0 8px;padding-bottom:8px;border-bottom:2px solid var(--ac)}
.domain{margin:26px 0}
.domain>h3{font-size:16px;color:var(--cyan);border-left:3px solid var(--cyan);padding-left:10px;margin:30px 0 12px}
.domain>h3 .count{background:var(--bd);color:var(--mut);border-radius:10px;font-size:11px;padding:1px 8px;margin-left:6px}
.api{background:var(--panel);border:1px solid var(--bd);border-radius:10px;padding:14px 16px;margin:10px 0}
.api-h{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.badge{color:#fff;font-size:10.5px;font-weight:700;padding:2px 8px;border-radius:5px;letter-spacing:.04em}
.api-name{font-size:14.5px;color:#fff;font-weight:600;word-break:break-all}
.op{color:var(--mut);font-size:11px;border:1px solid var(--bd);border-radius:5px;padding:1px 7px;text-transform:uppercase}
.purpose{margin:8px 0;color:var(--tx)}
.block{margin:10px 0}
.block h5{margin:0 0 5px;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--mut)}
ul.usage{margin:0;padding-left:0;list-style:none}
ul.usage li{margin:2px 0}
ul.usage code{color:var(--cyan);font-size:11.5px}
.scroll{overflow-x:auto}
table.t{border-collapse:collapse;width:100%;font-size:12.5px;min-width:420px}
table.t th,table.t td{border:1px solid var(--bd);padding:5px 8px;text-align:left;vertical-align:top}
table.t th{background:var(--panel2);color:var(--mut);font-weight:600;white-space:nowrap}
table.t td.ty{color:var(--cyan);white-space:nowrap}
table.t td.rq{text-align:center;color:#22c55e}
pre{background:#0b0d12;border:1px solid var(--bd);border-radius:8px;padding:11px 13px;overflow-x:auto;margin:6px 0}
pre code{color:#cbd5e1;font-size:12px;white-space:pre}
.notes{background:var(--panel2);border-left:3px solid #eab308;border-radius:0 6px 6px 0;padding:8px 12px;margin-top:10px;font-size:12.5px;color:#d9dee7}
.notes strong{color:#eab308}
.relay{background:var(--panel);border:1px solid var(--bd);border-radius:12px;padding:18px 20px;margin:18px 0}
.relay h3{margin:0 0 8px;font-size:17px;color:#fff}
.pill{background:var(--ac);color:#fff;font-size:11px;border-radius:10px;padding:2px 10px;margin-left:8px;vertical-align:middle}
.trigger,.summary{margin:6px 0}
.summary{color:var(--mut)}
ol.steps{counter-reset:none;list-style:none;padding:0;margin:14px 0 0;position:relative}
ol.steps li{border:1px solid var(--bd);border-left:3px solid var(--cyan);background:var(--panel2);border-radius:0 8px 8px 0;padding:10px 14px;margin:0 0 10px;position:relative}
.step-api{display:flex;align-items:center;gap:9px;margin-bottom:5px}
.step-api .num{background:var(--cyan);color:#06121a;font-weight:800;width:22px;height:22px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:12px;flex:0 0 22px}
.step-api code{color:#fff;font-size:13px;font-weight:600}
.sk{font-size:12.5px;color:var(--mut);margin:2px 0 2px 31px}
.sk b{color:var(--tx);font-weight:600}
.sk code{color:var(--cyan)}
.sk.then b{color:#22c55e}
@media(max-width:880px){nav{display:none}main{padding:20px 14px 80px}}
</style></head><body>
<div class="layout">
<nav>
  <h1>API 인벤토리</h1>
  <div class="sub">v13 · topik-ai → 백엔드 전달용</div>
  <div class="nav-group"><a href="#overview" style="color:var(--tx);font-weight:600">▸ 개요 / 인증 모델</a></div>
  ${navProjects}
  ${navRelays}
</nav>
<main>
  <div class="hero" id="overview">
    <h1>v13 · topik-ai API 인벤토리</h1>
    <p>백엔드 전달용 · 프론트엔드 서비스 계층 + Supabase 마이그레이션(RPC 정의)을 함께 분석해 작성</p>
    <p style="font-size:12px">"기대 Response"는 <b>프론트엔드가 실제로 소비하는 형태</b>이며, RPC는 SQL의 <code>RETURNS</code> / <code>json_build_object</code> 정의가 근거입니다.</p>
    <div class="stats">
      <div class="stat"><b>${totalApis}</b><span>API 항목</span></div>
      <div class="stat"><b>${domains.length}</b><span>도메인</span></div>
      <div class="stat"><b>${countBy('supabase_rpc')}</b><span>Supabase RPC</span></div>
      <div class="stat"><b>${countBy('supabase_table')}</b><span>테이블 접근</span></div>
      <div class="stat"><b>${countBy('next_api_route')}</b><span>Next 라우트</span></div>
      <div class="stat"><b>${countBy('external_service')}</b><span>외부 서비스</span></div>
      <div class="stat"><b>${relays.length}</b><span>릴레이 시퀀스</span></div>
    </div>
    <div class="legend">
      ${Object.entries(TYPE_LABEL).map(([k, v]) => `<span class="badge" style="background:${typeColor[k]}">${v}</span>`).join('')}
    </div>
    <div class="overview">
      <table>
        <tr><th>항목</th><th>v13 (talkpik-ai)</th><th>topik-ai</th></tr>
        <tr><td>성격</td><td>학습자용 서비스 앱</td><td>운영자용 어드민 대시보드</td></tr>
        <tr><td>스택</td><td>Next.js 16 (App Router), React 19, Supabase SSR</td><td>Vite + React, Supabase JS</td></tr>
        <tr><td>백엔드</td><td colspan="2">동일 Supabase 프로젝트 (Postgres RPC + PostgREST + Auth)</td></tr>
        <tr><td>외부</td><td>쓰기 AI 채점 API(<code>TALKPIK_WRITING_API_BASE_URL</code>), SMTP(Daou Office)</td><td>Supabase Management API, SMTP</td></tr>
      </table>
      <p><b>"API"의 범위</b> — ① Supabase RPC(<code>.rpc()</code>), ② PostgREST 테이블 접근(<code>.from().select/insert/...</code>), ③ Next.js 라우트 핸들러(<code>route.ts</code>), ④ 외부 HTTP 서비스.</p>
      <p style="color:var(--cyan);font-weight:600;margin-bottom:2px">인증/권한 모델</p>
      <ul>
        <li><b>topik-ai</b>: 모든 쓰기는 <code>admin_*</code> RPC(SECURITY DEFINER) 경유. 게이트 = <code>private.is_platform_admin</code> / <code>is_content_admin</code> / <code>is_admin</code>. RLS가 직접 테이블 쓰기를 차단 → RPC가 유일 경로.</li>
        <li><b>v13</b>: 사용자는 <code>auth.uid()</code> 기준 RLS로 자기 데이터만 접근. 알림 워커/외부채점 호출은 서비스롤 키 + 워커 시크릿(<code>NOTIFICATION_WORKER_SECRET</code>).</li>
      </ul>
      <p style="font-size:12px;color:var(--mut)">참고: <code>${(data.coverage?.missing || []).join('</code>, <code>')}</code> 은 직접 호출되는 API가 아니라 타입 참조/서버측 기록 대상으로만 등장(별도 프론트 호출 없음).</p>
    </div>
  </div>

  <h2 class="proj">A · v13 (학습자 앱) — <code>${ROOTS.v13}</code></h2>
  ${domains.filter((d) => d.project === 'v13').map(domainSection).join('')}

  <h2 class="proj">B · topik-ai (어드민) — <code>${ROOTS['topik-ai']}</code></h2>
  ${domains.filter((d) => d.project === 'topik-ai').map(domainSection).join('')}

  <h2 class="proj">C · 릴레이 시퀀스 (API 연쇄 호출)</h2>
  ${relays.map(relayCard).join('')}
</main>
</div>
</body></html>`;

fs.writeFileSync('docs/api-inventory-backend-handoff.html', html, 'utf8');
console.log('WROTE docs/api-inventory-backend-handoff.md', md.join('\n').length, 'chars');
console.log('WROTE docs/api-inventory-backend-handoff.html', html.length, 'chars');
console.log('APIs:', totalApis, '| domains:', domains.length, '| relays:', relays.length);
console.log('by type:', ['supabase_rpc','supabase_table','next_api_route','external_service','supabase_auth','supabase_storage'].map(t=>`${t}=${countBy(t)}`).join(' '));
