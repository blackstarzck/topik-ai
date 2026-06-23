// v2 — readable redesign: light theme, plain-language one-liners, accordion (collapsed by default),
// per-domain plain intros, search/filter. Merges the extraction JSON + the plain-rewrite JSON.
import fs from 'node:fs';

const BASE = 'C:/Users/admin/AppData/Local/Temp/claude/C--Users-admin-Desktop-workspace-topik-ai/e3677ece-f3e4-4879-a217-95eb53f904d4/tasks';
const outer = JSON.parse(fs.readFileSync(`${BASE}/wnfrfkes0.output`, 'utf8'));
const data = typeof outer.result === 'string' ? JSON.parse(outer.result) : outer.result;

let plainMap = {};
try {
  const po = JSON.parse(fs.readFileSync(`${BASE}/wizjfs8b8.output`, 'utf8'));
  const pdata = typeof po.result === 'string' ? JSON.parse(po.result) : po.result;
  (pdata.byDomain || []).forEach((d) => (d.items || []).forEach((it) => {
    plainMap[`${d.domain}||${it.n}||${it.op}`] = { easy: it.easy, easyResp: it.easyResp };
  }));
  console.log('plain layer entries:', Object.keys(plainMap).length);
} catch (e) {
  console.log('WARN no plain layer yet:', e.message);
}

const PROJECT_SPLIT = 9;
const domains = data.domains.map((d, i) => ({ ...d, project: i < PROJECT_SPLIT ? 'topik-ai' : 'v13' }));
const relays = (data.relays || []).flatMap((r) => (r.relays ? r.relays : [r]));

const TYPE_LABEL = { supabase_rpc: 'RPC', supabase_table: '테이블', next_api_route: '라우트', external_service: '외부', supabase_auth: '인증', supabase_storage: '저장소' };
const typeColor = { supabase_rpc: '#6366f1', supabase_table: '#0d9488', next_api_route: '#ea580c', external_service: '#dc2626', supabase_auth: '#16a34a', supabase_storage: '#64748b' };

const DOMAIN_INTRO = {
  'writing (작성/외부 AI 채점/피드백)': '학습자가 쓴 작문을 외부 AI 채점 서버로 보내고, 점수·문장별 첨삭 결과를 받아 화면에 보여주는 영역입니다. 채점은 외부에서 비동기로 돌아가므로 결과가 나올 때까지 잠깐씩 다시 물어보는(폴링) 구조입니다.',
  'problems + learning (문제풀이/학습이벤트)': '학습자가 풀 문제를 받아오고, 푼 기록과 학습 활동(언제 무엇을 했는지)을 저장하는 영역입니다.',
  'dashboard + recommendations (대시보드/추천/리포트)': '학습자 홈 화면의 요약 지표, 추천 문제, 비교 리포트를 만들어 보여주는 영역입니다.',
  'auth + account + affiliation (로그인/회원/탈퇴/기관코드)': '로그인·소셜 로그인 콜백·닉네임 중복확인·약관 동의·계정 탈퇴, 그리고 박람회/기관 코드 등록을 처리하는 영역입니다.',
  'notifications (인앱/이메일/구독해지)': '사용자에게 앱 안 알림과 이메일을 실제로 보내고(워커), 이메일 수신거부를 처리하는 영역입니다.',
  'export (PDF 내보내기)': '학습 결과나 리포트를 PDF 파일로 만들어 내려받게 해주는 영역입니다.',
  'assessment (문항/태그/쓰기)': '관리자가 시험 문항의 노출 상태(공개/제외/내부테스트)를 바꾸고, 운영 태그를 붙이거나 떼는 영역입니다.',
  'billing (환불 심사)': '관리자가 사용자의 결제 환불 요청을 검토해 승인하거나 반려하는 영역입니다.',
  'commerce (쿠폰/포인트)': '관리자가 쿠폰과 포인트 정책을 만들고, 발급 상태나 만료를 조정하는 영역입니다.',
  'community (게시글/신고)': '관리자가 커뮤니티 글을 숨기거나 삭제하고, 신고를 처리하며 메모를 남기는 영역입니다.',
  'message + auth-email (인증메일 템플릿)': '관리자가 가입 인증메일 등 시스템 메일의 템플릿을 편집하고, 실제 메일 발송 설정(Supabase)에 적용(동기화)하는 영역입니다.',
  'operation (공지/FAQ/약관/이벤트)': '관리자가 공지사항·FAQ·이용약관·이벤트를 등록하고 노출/발행 상태를 관리하는 영역입니다. 약관은 버전을 발행하면 사용자 앱에도 반영됩니다.',
  'system (감사로그/관리자/메타데이터/권한)': '관리자 계정과 권한 등급, 시스템 로그(감사 추적), 공통 코드(메타데이터)를 관리하는 영역입니다.',
  'users (회원/강사/추천인/기관코드)': '관리자가 회원·강사·추천인·기관코드를 조회하고 상태를 바꾸거나 상세 활동(결제/접속/커뮤니티 등)을 들여다보는 영역입니다.',
  'notifications (알림 발송/템플릿/그룹)': '관리자가 알림을 작성해 발송하고, 알림 템플릿과 발송 대상 그룹을 관리하는 영역입니다.',
};
const RELAY_ONELINE = {
  0: '작문 제출 → 외부 AI 채점 → 결과 폴링 → 저장 → 화면 표시까지의 7단계 흐름.',
  1: '관리자가 보낸 알림이 사용자 앱 안 알림 카드로 뜨기까지.',
  2: '관리자가 보낸 알림이 실제 이메일로 발송되기까지(워커 + SMTP).',
  3: '관리자가 편집한 인증메일 템플릿이 Supabase 실제 메일 설정에 반영되기까지.',
  4: '소셜/이메일 로그인 → 프로필 생성 → 닉네임/동의 → 기관코드 등록까지의 가입 흐름.',
  5: '관리자가 약관 새 버전을 발행 → 사용자 앱 약관 페이지에 반영 → 전체 알림 → 재동의까지.',
};

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const ROOTS = { 'topik-ai': 'topik-ai', v13: 'topik-project/v13' };
const firstSentence = (s) => String(s || '').split(/(?<=[.。])\s/)[0].slice(0, 60);
const easyOf = (d, a) => (plainMap[`${d.domain}||${a.name}||${a.op}`]?.easy) || firstSentence(a.purpose);
const easyRespOf = (d, a) => (plainMap[`${d.domain}||${a.name}||${a.op}`]?.easyResp) || '';
const authChip = (notes) => {
  const t = notes || '';
  if (/platform_admin/.test(t)) return { t: 'platform_admin', c: '#7c3aed' };
  if (/content_admin/.test(t)) return { t: 'content_admin', c: '#0891b2' };
  if (/service[_ ]?role/i.test(t)) return { t: 'service_role', c: '#dc2626' };
  if (/is_admin/.test(t)) return { t: 'admin', c: '#4f46e5' };
  if (/auth\.uid|소유자|RLS/.test(t)) return { t: '본인(RLS)', c: '#16a34a' };
  return null;
};

// ---------- per-API accordion row ----------
function reqTable(rows) {
  if (!rows?.length) return '';
  return `<div class="scroll"><table class="t"><thead><tr><th>이름</th><th>타입</th><th>필수</th><th>설명</th></tr></thead><tbody>${
    rows.map((p) => `<tr><td><code>${esc(p.name)}</code></td><td class="ty">${esc(p.type)}</td><td class="rq">${p.required ? '필수' : '-'}</td><td>${esc(p.desc)}</td></tr>`).join('')}</tbody></table></div>`;
}
function fieldTable(rows) {
  if (!rows?.length) return '';
  return `<div class="scroll"><table class="t"><thead><tr><th>필드</th><th>타입</th><th>설명</th></tr></thead><tbody>${
    rows.map((f) => `<tr><td><code>${esc(f.name)}</code></td><td class="ty">${esc(f.type)}</td><td>${esc(f.desc)}</td></tr>`).join('')}</tbody></table></div>`;
}
function apiRow(d, a) {
  const c = typeColor[a.type] || '#64748b';
  const easy = easyOf(d, a);
  const easyResp = easyRespOf(d, a);
  const ac = authChip(a.notes);
  const search = `${a.name} ${a.op} ${easy} ${a.purpose}`.toLowerCase().replace(/"/g, '');
  return `<div class="api" data-s="${esc(search)}">
    <button class="api-sum" onclick="tog(this)" aria-expanded="false">
      <span class="badge" style="background:${c}">${TYPE_LABEL[a.type] || a.type}</span>
      <span class="api-mid"><code class="api-name">${esc(a.name)}</code><span class="easy">${esc(easy)}</span></span>
      <span class="api-right">${ac ? `<span class="authchip" style="--ac:${ac.c}">${ac.t}</span>` : ''}<span class="op">${esc(a.op)}</span><span class="chev">▸</span></span>
    </button>
    <div class="api-det">
      ${easyResp ? `<div class="easyresp"><b>쉽게 말하면</b> ${esc(easyResp)}</div>` : ''}
      <div class="block"><h5>자세한 목적</h5><p class="purpose">${esc(a.purpose)}</p></div>
      ${a.usage?.length ? `<div class="block"><h5>사용 위치</h5><ul class="usage">${a.usage.map((u) => `<li><code>${esc(u)}</code></li>`).join('')}</ul></div>` : ''}
      ${a.request?.length ? `<div class="block"><h5>요청 파라미터</h5>${reqTable(a.request)}</div>` : ''}
      <div class="block"><h5>기대 Response</h5><pre><code>${esc(a.responseShape || '(없음)')}</code></pre>${fieldTable(a.responseFields)}</div>
      ${a.notes ? `<div class="notes"><b>비고(권한·예외)</b> ${esc(a.notes)}</div>` : ''}
    </div>
  </div>`;
}
function domainSection(d) {
  return `<section class="domain" id="dom-${slug(d.domain)}">
    <h3>${esc(d.domain)} <span class="count">${d.apis.length}</span></h3>
    ${DOMAIN_INTRO[d.domain] ? `<p class="dom-intro">${esc(DOMAIN_INTRO[d.domain])}</p>` : ''}
    <div class="api-list">${d.apis.map((a) => apiRow(d, a)).join('')}</div>
  </section>`;
}
function relayCard(r, i) {
  const steps = (r.steps || []).slice().sort((a, b) => a.order - b.order);
  return `<section class="relay" id="relay-${i + 1}">
    <h3><span class="rn">C${i + 1}</span> ${esc(r.name)} <span class="pill">${esc(r.project)}</span></h3>
    <p class="relay-one">${esc(RELAY_ONELINE[i] || '')}</p>
    <details class="relay-meta"><summary>트리거 · 전체 요약 보기</summary>
      <p><b>언제 시작되나</b> ${esc(r.trigger)}</p>
      <p><b>전체 흐름</b> ${esc(r.summary)}</p>
    </details>
    <ol class="steps">
      ${steps.map((s) => `<li>
        <div class="step-api"><span class="num">${s.order}</span><code>${esc(s.api)}</code></div>
        ${s.input ? `<div class="sk"><b>입력</b> ${esc(s.input)}</div>` : ''}
        ${s.output ? `<div class="sk"><b>출력</b> ${esc(s.output)}</div>` : ''}
        ${s.thenWhat ? `<div class="sk then"><b>→ 다음으로</b> ${esc(s.thenWhat)}</div>` : ''}
        ${s.caller ? `<div class="sk dim"><b>코드</b> <code>${esc(s.caller)}</code></div>` : ''}
      </li>`).join('')}
    </ol>
    ${r.notes ? `<div class="notes"><b>참고</b> ${esc(r.notes)}</div>` : ''}
  </section>`;
}

const navProjects = ['v13', 'topik-ai'].map((p) => {
  const ds = domains.filter((x) => x.project === p);
  return `<div class="nav-group"><div class="nav-proj">${p === 'v13' ? 'A · v13 (학습자 앱)' : 'B · topik-ai (어드민)'}</div>${
    ds.map((d) => `<a href="#dom-${slug(d.domain)}">${esc(d.domain.split(' (')[0])}<span>${d.apis.length}</span></a>`).join('')}</div>`;
}).join('');
const navRelays = `<div class="nav-group"><div class="nav-proj">C · 릴레이(연쇄 호출)</div>${
  relays.map((r, i) => `<a href="#relay-${i + 1}">C${i + 1}. ${esc(r.name.split('(')[0].slice(0, 30))}</a>`).join('')}</div>`;

const totalApis = domains.reduce((n, d) => n + d.apis.length, 0);
const countBy = (t) => domains.reduce((n, d) => n + d.apis.filter((a) => a.type === t).length, 0);

const BROWSER_JS = [
  "function tog(b){var d=b.parentElement,o=b.getAttribute('aria-expanded')==='true';b.setAttribute('aria-expanded',String(!o));d.classList.toggle('open',!o);}",
  "function setAll(open){document.querySelectorAll('.api').forEach(function(d){d.classList.toggle('open',open);var b=d.querySelector('.api-sum');if(b)b.setAttribute('aria-expanded',String(open));});}",
  "function filt(v){v=(v||'').trim().toLowerCase();document.querySelectorAll('.api').forEach(function(a){var hit=!v||a.getAttribute('data-s').indexOf(v)>-1;a.style.display=hit?'':'none';if(v&&hit)a.classList.add('open');});",
  "document.querySelectorAll('.domain').forEach(function(s){var any=s.querySelector('.api:not([style*=\"none\"])');s.style.display=(!v||any)?'':'none';});",
  "var c=document.getElementById('cnt');if(c)c.textContent=v?(document.querySelectorAll('.api:not([style*=\"none\"])').length+'개 검색됨'):'';}",
  "document.getElementById('q').addEventListener('input',function(e){filt(e.target.value);});",
].join('\n');

const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>API 안내서 — v13 · topik-ai (백엔드 전달용)</title>
<style>
:root{--bg:#f6f7f9;--card:#fff;--bd:#e5e8ee;--bd2:#eef1f5;--tx:#1f2733;--mut:#6b7686;--soft:#8a94a6;--ac:#4f46e5;--accent2:#0d9488;--code:#0f172a;--codebg:#f4f5f8;}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--tx);font:15px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Malgun Gothic","Apple SD Gothic Neo",sans-serif}
code{font-family:"SFMono-Regular",Consolas,"Liberation Mono",monospace;font-size:.86em;background:var(--codebg);padding:1px 5px;border-radius:4px;color:#3b3f51}
.layout{display:flex;align-items:flex-start}
nav{position:sticky;top:0;height:100vh;overflow-y:auto;width:264px;flex:0 0 264px;background:var(--card);border-right:1px solid var(--bd);padding:18px 12px}
nav h1{font-size:15px;margin:0 0 2px}
nav .sub{color:var(--soft);font-size:11px;margin-bottom:14px}
.nav-group{margin-bottom:12px}
.nav-proj{font-size:11px;letter-spacing:.04em;color:var(--ac);font-weight:700;padding:5px 8px;text-transform:uppercase}
nav a{display:flex;justify-content:space-between;gap:8px;color:var(--mut);text-decoration:none;padding:4px 8px;border-radius:7px;font-size:13px}
nav a:hover{background:#f1f2f6;color:var(--tx)}
nav a span{background:var(--bd2);color:var(--mut);border-radius:10px;padding:0 7px;font-size:10px;align-self:center}
main{flex:1;min-width:0;max-width:980px;margin:0 auto;padding:30px 34px 120px}
.hero h1{font-size:25px;margin:0 0 6px;letter-spacing:-.01em}
.hero .lead{color:var(--mut);margin:.2em 0 0;font-size:15px}
.howto{background:linear-gradient(180deg,#eef0ff,#f6f7ff);border:1px solid #dfe2ff;border-radius:12px;padding:14px 18px;margin:18px 0}
.howto b{color:var(--ac)}
.howto ul{margin:6px 0 0;padding-left:18px;color:#444b5c}
.howto li{margin:3px 0}
.stats{display:flex;flex-wrap:wrap;gap:10px;margin:18px 0}
.stat{background:var(--card);border:1px solid var(--bd);border-radius:11px;padding:9px 15px;min-width:84px}
.stat b{font-size:21px;display:block;color:var(--ac)}
.stat span{color:var(--soft);font-size:11px}
.bigpic{background:var(--card);border:1px solid var(--bd);border-radius:12px;padding:16px 20px;margin:6px 0 18px}
.bigpic table{width:100%;border-collapse:collapse;margin:8px 0;font-size:13.5px}
.bigpic th,.bigpic td{border:1px solid var(--bd);padding:7px 10px;text-align:left;vertical-align:top}
.bigpic th{background:#fafbfc;color:var(--mut);font-size:12.5px}
.bigpic .who{color:var(--tx)}
.toolbar{position:sticky;top:0;z-index:5;background:var(--bg);padding:12px 0;margin-bottom:4px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;border-bottom:1px solid var(--bd)}
#q{flex:1;min-width:200px;border:1px solid var(--bd);border-radius:9px;padding:9px 13px;font-size:14px;background:var(--card)}
.toolbar button{border:1px solid var(--bd);background:var(--card);color:var(--mut);border-radius:8px;padding:8px 12px;font-size:13px;cursor:pointer}
.toolbar button:hover{background:#f1f2f6}
#cnt{color:var(--ac);font-size:12.5px;font-weight:600}
h2.proj{font-size:20px;margin:40px 0 6px;padding-bottom:8px;border-bottom:2px solid var(--ac)}
h2.proj small{color:var(--soft);font-weight:400;font-size:13px}
.domain{margin:22px 0}
.domain>h3{font-size:16.5px;margin:26px 0 6px}
.domain>h3 .count{background:var(--bd2);color:var(--mut);border-radius:10px;font-size:11px;padding:1px 9px;margin-left:6px;font-weight:500}
.dom-intro{color:var(--mut);margin:0 0 12px;font-size:14px;background:#fafbfd;border-left:3px solid var(--accent2);padding:8px 12px;border-radius:0 8px 8px 0}
.api-list{display:flex;flex-direction:column;gap:8px}
.api{background:var(--card);border:1px solid var(--bd);border-radius:11px;overflow:hidden}
.api-sum{width:100%;border:0;background:none;cursor:pointer;display:flex;align-items:center;gap:11px;padding:11px 14px;text-align:left;font:inherit}
.api-sum:hover{background:#fafbfd}
.badge{color:#fff;font-size:10.5px;font-weight:700;padding:3px 8px;border-radius:6px;white-space:nowrap;flex:0 0 auto;min-width:46px;text-align:center}
.api-mid{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.api-name{font-size:13.5px;color:#111827;font-weight:600;background:none;padding:0;word-break:break-all}
.easy{font-size:13.5px;color:var(--mut)}
.api-right{display:flex;align-items:center;gap:8px;flex:0 0 auto}
.authchip{font-size:10.5px;color:var(--ac);border:1px solid color-mix(in srgb,var(--ac) 35%,#fff);background:color-mix(in srgb,var(--ac) 8%,#fff);border-radius:20px;padding:1px 9px;white-space:nowrap}
.authchip{--ac:#4f46e5;color:var(--ac);border-color:color-mix(in srgb,var(--ac) 40%,#fff);background:color-mix(in srgb,var(--ac) 9%,#fff)}
.op{color:var(--soft);font-size:10.5px;border:1px solid var(--bd);border-radius:5px;padding:1px 7px;text-transform:uppercase}
.chev{color:var(--soft);transition:transform .15s;font-size:12px}
.api.open .chev{transform:rotate(90deg)}
.api-det{display:none;padding:4px 16px 16px;border-top:1px solid var(--bd2)}
.api.open .api-det{display:block}
.easyresp{background:#f0fbf9;border:1px solid #cdeee8;border-radius:9px;padding:9px 13px;margin:12px 0;font-size:13.5px}
.easyresp b{color:var(--accent2)}
.block{margin:13px 0}
.block h5{margin:0 0 5px;font-size:11px;letter-spacing:.04em;color:var(--soft);text-transform:uppercase}
.purpose{margin:0;color:#3a4252;font-size:13.5px}
ul.usage{margin:0;padding-left:0;list-style:none}
ul.usage li{margin:2px 0}
ul.usage code{color:#0e7490;font-size:12px;background:#ecfeff}
.scroll{overflow-x:auto}
table.t{border-collapse:collapse;width:100%;font-size:12.5px;min-width:440px}
table.t th,table.t td{border:1px solid var(--bd);padding:6px 9px;text-align:left;vertical-align:top}
table.t th{background:#fafbfc;color:var(--mut);font-weight:600;white-space:nowrap}
table.t td.ty{color:#0e7490;white-space:nowrap}
table.t td.rq{text-align:center;color:#b45309}
pre{background:var(--code);border-radius:9px;padding:11px 13px;overflow-x:auto;margin:6px 0}
pre code{color:#e2e8f0;font-size:12px;white-space:pre;background:none;padding:0}
.notes{background:#fffbeb;border:1px solid #fde68a;border-radius:9px;padding:9px 13px;margin-top:12px;font-size:12.5px;color:#5b4a17}
.notes b{color:#92660a}
.relay{background:var(--card);border:1px solid var(--bd);border-radius:13px;padding:18px 20px;margin:16px 0}
.relay h3{margin:0 0 4px;font-size:17px;display:flex;align-items:center;gap:9px;flex-wrap:wrap}
.rn{background:var(--ac);color:#fff;font-size:13px;border-radius:7px;padding:2px 9px}
.pill{background:#eef2ff;color:var(--ac);font-size:11px;border-radius:10px;padding:2px 10px;font-weight:600}
.relay-one{color:#3a4252;margin:2px 0 8px;font-size:14.5px}
.relay-meta{margin:0 0 12px;font-size:13px}
.relay-meta summary{cursor:pointer;color:var(--ac);font-size:12.5px}
.relay-meta p{color:var(--mut);margin:7px 0}
.relay-meta b{color:var(--tx)}
ol.steps{list-style:none;padding:0;margin:6px 0 0}
ol.steps li{border:1px solid var(--bd);border-left:3px solid var(--ac);background:#fafbfd;border-radius:0 9px 9px 0;padding:10px 14px;margin:0 0 9px;position:relative}
ol.steps li:not(:last-child):after{content:'↓';position:absolute;left:13px;bottom:-16px;color:var(--soft);font-size:13px;z-index:1}
.step-api{display:flex;align-items:center;gap:9px;margin-bottom:5px}
.step-api .num{background:var(--ac);color:#fff;font-weight:800;width:22px;height:22px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:12px;flex:0 0 22px}
.step-api code{color:#111827;font-size:13px;font-weight:600;background:none}
.sk{font-size:12.5px;color:var(--mut);margin:2px 0 2px 31px}
.sk b{color:var(--tx);font-weight:600}
.sk.then b{color:var(--accent2)}
.sk.dim{color:var(--soft)}
.sk.dim code{color:#0e7490;font-size:11.5px}
footer{color:var(--soft);font-size:12px;margin-top:50px;border-top:1px solid var(--bd);padding-top:14px}
@media(max-width:880px){nav{display:none}main{padding:18px 14px 80px}.easy{display:none}.api.open .easy{display:block}}
</style></head><body>
<div class="layout">
<nav>
  <h1>API 안내서</h1>
  <div class="sub">v13 · topik-ai → 백엔드 전달용</div>
  <div class="nav-group"><a href="#top" style="color:var(--tx);font-weight:600">▸ 개요 · 읽는 법</a></div>
  ${navProjects}
  ${navRelays}
</nav>
<main id="top">
  <div class="hero">
    <h1>v13 · topik-ai API 안내서</h1>
    <p class="lead">학습자 앱(v13)과 어드민(topik-ai)이 쓰는 모든 API를 <b>쉬운 한 줄 설명</b>과 함께 정리했습니다. 클릭하면 자세한 내용(요청·응답·권한)이 펼쳐집니다.</p>
  </div>

  <div class="howto">
    <b>이 문서 읽는 법</b>
    <ul>
      <li>각 줄은 API 하나입니다. 색 배지(<span class="badge" style="background:#6366f1;font-size:9px">RPC</span> 등)는 종류, 가운데는 <b>이름 + 쉬운 설명</b>, 오른쪽은 <b>호출할 수 있는 권한</b>과 메서드입니다.</li>
      <li><b>줄을 클릭</b>하면 자세한 목적·요청 파라미터·<b>기대 Response(돌아오는 값)</b>·권한/예외가 펼쳐집니다.</li>
      <li>맨 위 <b>검색창</b>에 이름이나 단어를 입력하면 해당 API만 걸러서 보여줍니다.</li>
      <li>맨 아래 <b>C 섹션</b>은 여러 API가 순서대로 이어지는 "연쇄 호출(릴레이)" 흐름입니다 — 백엔드가 흐름을 이해할 때 먼저 보면 좋습니다.</li>
    </ul>
  </div>

  <div class="stats">
    <div class="stat"><b>${totalApis}</b><span>API</span></div>
    <div class="stat"><b>${countBy('supabase_rpc')}</b><span>RPC</span></div>
    <div class="stat"><b>${countBy('supabase_table')}</b><span>테이블</span></div>
    <div class="stat"><b>${countBy('next_api_route')}</b><span>라우트</span></div>
    <div class="stat"><b>${countBy('external_service')}</b><span>외부</span></div>
    <div class="stat"><b>${relays.length}</b><span>릴레이</span></div>
  </div>

  <div class="bigpic">
    <table>
      <tr><th>구분</th><th>v13 (talkpik-ai)</th><th>topik-ai</th></tr>
      <tr><td class="who">무엇</td><td>학습자가 쓰는 서비스 앱</td><td>운영자가 쓰는 어드민</td></tr>
      <tr><td class="who">기술</td><td>Next.js 16, React 19</td><td>Vite + React</td></tr>
      <tr><td class="who">백엔드</td><td colspan="2"><b>같은 Supabase 1개</b> (DB 함수=RPC + 테이블 + 로그인). 외부: AI 쓰기채점 서버, 메일(SMTP)</td></tr>
      <tr><td class="who">권한</td><td>로그인한 사용자가 <b>자기 데이터만</b> (RLS)</td><td>모든 변경은 <b>admin_* 함수</b>로만 (관리자 등급 확인)</td></tr>
    </table>
    <p style="font-size:12.5px;color:var(--soft);margin:6px 0 0">참고: <code>${(data.coverage?.missing || []).join('</code>, <code>')}</code> 는 직접 호출되는 API가 아니라 타입 참조/서버 기록용으로만 등장합니다.</p>
  </div>

  <div class="toolbar">
    <input id="q" type="search" placeholder="API 이름이나 단어로 검색… (예: 환불, notification, refund)" autocomplete="off">
    <button onclick="setAll(true)">전체 펼치기</button>
    <button onclick="setAll(false)">전체 접기</button>
    <span id="cnt"></span>
  </div>

  <h2 class="proj">A · v13 — 학습자 앱 <small>${ROOTS.v13}</small></h2>
  ${domains.filter((d) => d.project === 'v13').map(domainSection).join('')}

  <h2 class="proj">B · topik-ai — 어드민 <small>${ROOTS['topik-ai']}</small></h2>
  ${domains.filter((d) => d.project === 'topik-ai').map(domainSection).join('')}

  <h2 class="proj">C · 릴레이 — 여러 API가 이어지는 흐름</h2>
  <p class="lead" style="margin-bottom:8px">하나의 동작이 여러 API를 순서대로 호출하는 경우입니다. 각 단계의 <b>출력이 다음 단계의 입력</b>이 됩니다.</p>
  ${relays.map(relayCard).join('')}

  <footer>자동 생성 · 프론트엔드 서비스 코드 + Supabase 마이그레이션(RPC 정의) 교차 분석 · 기대 Response는 SQL RETURNS / json_build_object 근거</footer>
</main>
</div>
<script>${BROWSER_JS}</script>
</body></html>`;

fs.writeFileSync('docs/api-inventory-backend-handoff.html', html, 'utf8');
console.log('WROTE docs/api-inventory-backend-handoff.html', html.length, 'chars | apis', totalApis, '| relays', relays.length);

// ---------- Markdown (committable, now with plain one-liners) ----------
const mdEsc = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
const md = [];
md.push('# v13 · topik-ai API 안내서 (백엔드 전달용)');
md.push('');
md.push('> 학습자 앱(v13)과 어드민(topik-ai)이 쓰는 모든 API를 **쉬운 한 줄 설명**과 함께 정리했습니다. 각 API는 「쉬운 설명 → 자세한 목적 → 요청 → 기대 Response → 비고」 순서입니다. 기대 Response는 프론트가 실제로 받는 형태이며 RPC는 SQL `RETURNS`/`json_build_object` 정의가 근거입니다. 더 읽기 좋은 버전은 같은 폴더의 `.html`을 브라우저로 여세요.');
md.push('');
md.push('## 한눈에 보기');
md.push('');
md.push('| 구분 | v13 (talkpik-ai) | topik-ai |');
md.push('|---|---|---|');
md.push('| 무엇 | 학습자가 쓰는 서비스 앱 | 운영자가 쓰는 어드민 |');
md.push('| 기술 | Next.js 16, React 19 | Vite + React |');
md.push('| 백엔드 | 같은 Supabase 1개 (RPC + 테이블 + 로그인) · 외부: AI 쓰기채점, 메일(SMTP) | 동일 |');
md.push('| 권한 | 로그인 사용자가 자기 데이터만(RLS) | 모든 변경은 `admin_*` 함수로만(관리자 등급 확인) |');
md.push('');
md.push(`- 도메인 ${domains.length}개 · API ${totalApis}개 · 릴레이 ${relays.length}개. 참고: \`${(data.coverage?.missing || []).join('`, `')}\` 는 직접 호출 API가 아니라 타입참조/서버기록용.`);
md.push('');
function mdProj(project) {
  md.push(`\n---\n\n# ${project === 'v13' ? 'A. v13 (학습자 앱)' : 'B. topik-ai (어드민)'} — \`${ROOTS[project]}\``);
  for (const d of domains.filter((x) => x.project === project)) {
    md.push(`\n## ${d.domain}`);
    if (DOMAIN_INTRO[d.domain]) md.push(`_${DOMAIN_INTRO[d.domain]}_`);
    for (const a of d.apis) {
      md.push(`\n### \`${a.name}\` · ${TYPE_LABEL[a.type] || a.type} · ${a.op}`);
      md.push(`> 🟢 **쉬운 설명**: ${easyOf(d, a)}`);
      const er = easyRespOf(d, a);
      if (er) md.push(`> 🔵 **돌아오는 값(쉽게)**: ${er}`);
      md.push('');
      md.push(`**자세한 목적**: ${a.purpose}`);
      if (a.usage?.length) { md.push(''); md.push('**사용 위치**:'); a.usage.forEach((u) => md.push(`- \`${u}\``)); }
      if (a.request?.length) {
        md.push(''); md.push('**요청 파라미터**:');
        md.push('| 이름 | 타입 | 필수 | 설명 |'); md.push('|---|---|---|---|');
        a.request.forEach((p) => md.push(`| \`${mdEsc(p.name)}\` | ${mdEsc(p.type)} | ${p.required ? '필수' : '-'} | ${mdEsc(p.desc)} |`));
      }
      md.push(''); md.push('**기대 Response**:'); md.push('```ts'); md.push(a.responseShape || '(없음)'); md.push('```');
      if (a.responseFields?.length) {
        md.push('| 필드 | 타입 | 설명 |'); md.push('|---|---|---|');
        a.responseFields.forEach((f) => md.push(`| \`${mdEsc(f.name)}\` | ${mdEsc(f.type)} | ${mdEsc(f.desc)} |`));
      }
      if (a.notes) { md.push(''); md.push(`**비고(권한·예외)**: ${a.notes}`); }
    }
  }
}
mdProj('v13');
mdProj('topik-ai');
md.push('\n---\n\n# C. 릴레이 시퀀스 (여러 API가 이어지는 흐름)');
relays.forEach((r, i) => {
  md.push(`\n## C${i + 1}. ${r.name}  _(${r.project})_`);
  md.push(`**한 줄 요약**: ${RELAY_ONELINE[i] || ''}`);
  md.push(`- **언제 시작**: ${r.trigger}`);
  md.push(`- **전체 흐름**: ${r.summary}`);
  md.push('');
  (r.steps || []).slice().sort((a, b) => a.order - b.order).forEach((s) => {
    md.push(`**${s.order}. ${s.api}**`);
    if (s.input) md.push(`   - 입력: ${s.input}`);
    if (s.output) md.push(`   - 출력: ${s.output}`);
    if (s.thenWhat) md.push(`   - → 다음으로: ${s.thenWhat}`);
    if (s.caller) md.push(`   - 코드: \`${s.caller}\``);
    md.push('');
  });
  if (r.notes) md.push(`> 참고: ${r.notes}`);
});
fs.writeFileSync('docs/api-inventory-backend-handoff.md', md.join('\n'), 'utf8');
console.log('WROTE docs/api-inventory-backend-handoff.md', md.join('\n').length, 'chars');
