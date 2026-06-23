import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { extractTasks } from './ingest-mapper';

declare const process: {
  env: Record<string, string | undefined>;
};

/**
 * /api/writing-tasks/ingest — 외부 공급 API(/api/writing/tasks) 목록을 무손실
 * 인박스에 적재한다. (docs/plans/question-bank-ingest-flow-plan.html, P6/P7)
 *
 * 두 트리거:
 *  - POST: 관리자 화면 "가져오기" 버튼. 관리자 JWT 검증 → app_role 게이트 →
 *          actor = 그 관리자. (수동 동기화)
 *  - GET : Vercel cron 자동 동기화. Authorization: Bearer ${CRON_SECRET} 검증 →
 *          actor = INGEST_SYSTEM_ACTOR_ID(시스템 content_admin). (정기 동기화)
 *
 * 공통 흐름: 상류 로그인 → 목록 전체 페이지네이션 수신 → 방어적 추출 →
 *           admin_ingest_writing_tasks_bulk 1회 호출(서버측 루프, 멱등·버전·감사).
 * 멱등이라 재실행 시 새 문항만 추가되고 기존은 unchanged.
 *
 * 보안: Service Role 키·상류 자격증명·시스템 actor는 서버 전용. 브라우저는 자신의
 *       access_token만 전달하며, actor는 본문에서 받지 않는다.
 */

const ADMIN_ROLES = new Set(['content_admin', 'platform_admin']);
const ERROR_SNIPPET_MAX = 200;
const PAGE = 50; // 상류 목록 limit 상한(라이브 확인: limit<=50)
const SOURCE_ENDPOINT = '/api/writing/tasks';
const LOG_PREFIX = '[writing-tasks/ingest]';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// 검수 완료 게이트(fail-closed): 받아올 데이터는 반드시 검수 완료여야 한다.
// review_status가 정확히 이 값이 아니면(누락·다른 값 포함) 적재 제외.
const REVIEW_COMPLETE = '검수 완료';

// 서버리스 함수 최대 실행 시간(상류 페이지네이션 + 벌크 RPC 1회 여유).
export const maxDuration = 60;

type IngestRequestBody = { task_type?: unknown; limit?: unknown; dry_run?: unknown };
type ServerEnv = {
  supabaseUrl: string;
  serviceRoleKey: string;
  upstreamBase: string;
  upstreamEmail: string;
  upstreamPassword: string;
};

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return Response.json(body, init);
}

function normalizeTaskType(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const match = /(51|52|53|54)/.exec(value);
  return match ? `Q${match[1]}` : null;
}

function resolveServerEnv(): { env?: ServerEnv; error?: Response } {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return { error: jsonResponse({ ok: false, error: 'server_misconfigured' }, { status: 500 }) };
  }
  const upstreamBase = process.env.API_BASE_URL;
  const upstreamEmail = process.env.API_ACCOUNT_INFO_EMAIL;
  const upstreamPassword = process.env.API_ACCOUNT_INFO_PASSWORD;
  if (!upstreamBase || !upstreamEmail || !upstreamPassword) {
    return { error: jsonResponse({ ok: false, error: 'upstream_not_configured' }, { status: 503 }) };
  }
  return {
    env: {
      supabaseUrl,
      serviceRoleKey,
      upstreamBase: upstreamBase.replace(/\/$/, ''),
      upstreamEmail,
      upstreamPassword
    }
  };
}

async function upstreamLogin(env: ServerEnv): Promise<string> {
  const res = await fetch(`${env.upstreamBase}/api/eval/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: env.upstreamEmail, password: env.upstreamPassword })
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`upstream_login_failed: ${res.status} ${text.slice(0, ERROR_SNIPPET_MAX)}`);
  }
  const body = JSON.parse(text) as { token?: unknown; access_token?: unknown };
  const token = typeof body.token === 'string' ? body.token : typeof body.access_token === 'string' ? body.access_token : '';
  if (!token) throw new Error('upstream_login_no_token');
  return token;
}

// 응답 봉투에서 task 배열을 꺼낸다 — ingest-mapper의 봉투 집합과 동일
// (상류 형태 미확정: items/tasks/data/results/배열 루트 모두 수용). 비배열 값은 무시.
const ENVELOPE_KEYS = ['items', 'tasks', 'data', 'results'] as const;
function pageItemsOf(body: unknown): unknown[] {
  if (Array.isArray(body)) return body;
  if (body && typeof body === 'object') {
    for (const key of ENVELOPE_KEYS) {
      const value = (body as Record<string, unknown>)[key];
      if (Array.isArray(value)) return value;
    }
  }
  return [];
}

const MAX_PAGES = 200; // 무한 루프 안전장치(상류가 offset을 무시할 경우의 상한).
const TASK_TYPES = ['Q51', 'Q52', 'Q53', 'Q54'];

/**
 * 상류 "상세(full §7)"를 타입별로 페이지네이션 수신한다 — /api/writing/tasks/{Q5x}.
 * 목록(/api/writing/tasks)은 요약뿐이라 §7 승격에 불충분 → 본문·정답 포함 상세를 받는다.
 * 종료 조건: 짧은(마지막) 페이지 / 새 항목 없음(offset 무시 감지) / maxLimit / MAX_PAGES.
 * 파생 total에 의존하지 않는다. maxLimit은 누적 항목 수의 클라이언트측 상한이다.
 */
async function fetchAllTasks(
  env: ServerEnv,
  token: string,
  taskType: string | null,
  maxLimit: number | null
) {
  const items: unknown[] = [];
  const seen = new Set<string>();
  const types = taskType ? [taskType] : TASK_TYPES;
  for (const type of types) {
    let offset = 0;
    for (let pageNo = 0; pageNo < MAX_PAGES; pageNo += 1) {
      const res = await fetch(
        `${env.upstreamBase}${SOURCE_ENDPOINT}/${type}?limit=${PAGE}&offset=${offset}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const text = await res.text();
      if (!res.ok) {
        throw new Error(`upstream_fetch_failed: ${res.status} ${text.slice(0, ERROR_SNIPPET_MAX)}`);
      }
      const page = pageItemsOf(JSON.parse(text));

      let newInPage = 0;
      for (const item of page) {
        const id =
          item && typeof item === 'object'
            ? String(
                (item as Record<string, unknown>).question_id ??
                  (item as Record<string, unknown>).id ??
                  (item as Record<string, unknown>).source_task_id ??
                  ''
              )
            : '';
        if (id && !seen.has(id)) {
          seen.add(id);
          newInPage += 1;
        }
      }
      items.push(...page);

      if (maxLimit && items.length >= maxLimit) {
        items.length = maxLimit;
        return extractTasks(items);
      }
      if (page.length < PAGE) break; // 마지막(짧은) 페이지
      if (newInPage === 0) break; // 새 항목 없음 → offset 무시 → 다음 타입으로
      offset += PAGE;
    }
  }
  return extractTasks(items);
}

type IngestOptions = {
  actorId: string;
  taskType?: string | null;
  maxLimit?: number | null;
  dryRun?: boolean;
};

async function runIngest(
  supabase: SupabaseClient,
  env: ServerEnv,
  opts: IngestOptions
): Promise<Response> {
  let token: string;
  try {
    token = await upstreamLogin(env);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'upstream_login_error';
    console.error(`${LOG_PREFIX} upstream login failed:`, message);
    return jsonResponse({ ok: false, error: message }, { status: 502 });
  }

  let tasks;
  let warnings: string[];
  try {
    const extracted = await fetchAllTasks(env, token, opts.taskType ?? null, opts.maxLimit ?? null);
    tasks = extracted.tasks;
    warnings = extracted.warnings;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'upstream_fetch_error';
    console.error(`${LOG_PREFIX} upstream fetch failed:`, message);
    return jsonResponse({ ok: false, error: message }, { status: 502 });
  }

  // 검수 완료 게이트: review_status가 정확히 '검수 완료'인 항목만 적재한다(나머지 제외).
  const reviewComplete = tasks.filter(
    (task) => (task.raw as Record<string, unknown>).review_status === REVIEW_COMPLETE
  );
  const skippedReview = tasks.length - reviewComplete.length;
  if (skippedReview > 0) {
    console.log(`${LOG_PREFIX} skipped ${skippedReview} non-review-complete item(s)`);
  }

  if (opts.dryRun) {
    return jsonResponse({
      ok: true,
      dry_run: true,
      candidate_count: reviewComplete.length,
      skipped_review: skippedReview,
      warnings
    });
  }

  const payload = reviewComplete.map((task) => ({
    source_task_id: task.sourceTaskId,
    raw_payload: task.raw,
    raw_response_text: JSON.stringify(task.raw),
    item_number: task.itemNumber
  }));

  const { data, error } = await supabase.rpc('admin_ingest_writing_tasks_bulk', {
    p_actor_id: opts.actorId,
    p_source_endpoint: SOURCE_ENDPOINT,
    p_tasks: payload
  });
  if (error) {
    console.error(`${LOG_PREFIX} bulk ingest RPC failed:`, error.message);
    return jsonResponse({ ok: false, error: error.message }, { status: 500 });
  }

  // 적재 직후 자동 승격: 인박스(is_latest raw/held) → §7 upsert(노출·태그 보존).
  const { data: promoted, error: promoteError } = await supabase.rpc('admin_promote_writing_questions', {
    p_actor_id: opts.actorId,
    p_question_ids: null
  });
  if (promoteError) {
    // 적재는 성공, 승격만 실패 — 인박스에 보존돼 다음 실행에서 재승격된다.
    console.error(`${LOG_PREFIX} promote RPC failed:`, promoteError.message);
    return jsonResponse({ ok: true, counts: data, promote_error: promoteError.message, warnings });
  }

  // 성공 요약을 로그로 — cron(GET)은 응답 본문을 버리므로 가시화에 필요.
  console.log(`${LOG_PREFIX} ingest ok:`, JSON.stringify(data), '| promote:', JSON.stringify(promoted), '| skipped_review:', skippedReview);
  return jsonResponse({ ok: true, counts: data, promoted, skipped_review: skippedReview, warnings });
}

// ---------------------------------------------------------------------------
// POST — 관리자 화면 "가져오기" 버튼 (관리자 JWT → actor = 그 관리자)
// ---------------------------------------------------------------------------
async function handleManualIngest(request: Request): Promise<Response> {
  const { env, error: envError } = resolveServerEnv();
  if (envError) return envError;
  const serverEnv = env as ServerEnv;

  const authHeader = request.headers.get('authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) {
    return jsonResponse({ ok: false, error: 'unauthenticated' }, { status: 401 });
  }

  const supabase = createClient(serverEnv.supabaseUrl, serverEnv.serviceRoleKey, {
    auth: { persistSession: false }
  });
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  const userId = userData?.user?.id;
  if (userError || !userId) {
    return jsonResponse({ ok: false, error: 'invalid_session' }, { status: 401 });
  }

  const profileResult = await supabase
    .from('profiles')
    .select('app_role')
    .eq('id', userId)
    .maybeSingle();
  if (profileResult.error) {
    return jsonResponse({ ok: false, error: 'role_check_failed' }, { status: 500 });
  }
  const profile = profileResult.data as { app_role: string | null } | null;
  if (!profile || !ADMIN_ROLES.has(String(profile.app_role ?? ''))) {
    return jsonResponse({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  let body: IngestRequestBody;
  try {
    body = (await request.json()) as IngestRequestBody;
  } catch {
    body = {};
  }
  const maxLimit =
    typeof body.limit === 'number' && Number.isFinite(body.limit)
      ? Math.max(1, Math.floor(body.limit))
      : null;

  return runIngest(supabase, serverEnv, {
    actorId: userId,
    taskType: normalizeTaskType(body.task_type),
    maxLimit,
    dryRun: body.dry_run === true
  });
}

// ---------------------------------------------------------------------------
// GET — Vercel cron 자동 동기화 (CRON_SECRET → actor = INGEST_SYSTEM_ACTOR_ID)
// ---------------------------------------------------------------------------
async function handleCronIngest(request: Request): Promise<Response> {
  const cronSecret = process.env.CRON_SECRET;
  const provided = request.headers.get('authorization');
  if (!cronSecret || provided !== `Bearer ${cronSecret}`) {
    return jsonResponse({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const systemActorId = process.env.INGEST_SYSTEM_ACTOR_ID;
  if (!systemActorId) {
    console.error(`${LOG_PREFIX} cron: INGEST_SYSTEM_ACTOR_ID not set — sync skipped.`);
    return jsonResponse({ ok: false, error: 'system_actor_not_configured' }, { status: 500 });
  }
  if (!UUID_RE.test(systemActorId)) {
    console.error(`${LOG_PREFIX} cron: INGEST_SYSTEM_ACTOR_ID is not a valid uuid — sync skipped.`);
    return jsonResponse({ ok: false, error: 'system_actor_invalid' }, { status: 500 });
  }

  const { env, error: envError } = resolveServerEnv();
  if (envError) {
    console.error(`${LOG_PREFIX} cron: server/upstream env missing — sync skipped.`);
    return envError;
  }
  const serverEnv = env as ServerEnv;

  const supabase = createClient(serverEnv.supabaseUrl, serverEnv.serviceRoleKey, {
    auth: { persistSession: false }
  });

  // actor가 실제 content_admin인지는 RPC가 검증한다(forbidden 시 그대로 반영).
  return runIngest(supabase, serverEnv, { actorId: systemActorId });
}

export function POST(request: Request): Promise<Response> | Response {
  return handleManualIngest(request);
}

export function GET(request: Request): Promise<Response> | Response {
  return handleCronIngest(request);
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method === 'POST') return POST(request);
    if (request.method === 'GET') return GET(request);
    return jsonResponse(
      { error: 'Method Not Allowed', allow: ['GET', 'POST'] },
      { status: 405, headers: { Allow: 'GET, POST' } }
    );
  }
};
