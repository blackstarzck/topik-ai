import { supabaseClient } from '../../../shared/api/supabase-client';
import { toSafeResult, withRetry } from '../../../shared/api/safe-request';
import { questionBankDataSource } from './question-bank-data-source';
import type {
  ImportedTaskMappingStatus,
  ImportedWritingTask
} from '../model/imported-task-types';

/**
 * 가져온 문항(인박스) 읽기 서비스. 인박스 테이블은 admin SELECT RLS가 열려 있어
 * 브라우저에서 직접 조회한다(쓰기는 서버 service-role/RPC 단일 경로 — 여기선 읽기만).
 * mock 모드(Supabase 미구성)에서는 결정적 픽스처를 반환한다.
 *
 * 표시값 일부(title/topic/generated_by/difficulty_level)는 raw_payload(원문)에서
 * 파생한다 — 목록 응답이 그 필드를 별도 컬럼이 아니라 원문 안에 담기 때문.
 */

const SELECT_COLUMNS =
  'import_id, source_task_id, item_number, raw_payload, mapping_status, ' +
  'promoted_question_id, source_endpoint, ingest_count, first_seen_at, last_seen_at';

type ImportRow = {
  import_id: number;
  source_task_id: string;
  item_number: number | null;
  raw_payload: unknown;
  mapping_status: string;
  promoted_question_id: string | null;
  source_endpoint: string | null;
  ingest_count: number | null;
  first_seen_at: string | null;
  last_seen_at: string | null;
};

function toDateTime(ts: string | null | undefined): string {
  return ts ? ts.slice(0, 16).replace('T', ' ') : '';
}

function payloadString(payload: unknown, key: string): string {
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const value = (payload as Record<string, unknown>)[key];
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return String(value);
  }
  return '';
}

function payloadNumber(payload: unknown, key: string): number | null {
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const value = (payload as Record<string, unknown>)[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return null;
}

const KNOWN_STATUSES: ImportedTaskMappingStatus[] = ['raw', 'mapped', 'promoted', 'held'];

function toMappingStatus(value: string): ImportedTaskMappingStatus {
  return (KNOWN_STATUSES as string[]).includes(value)
    ? (value as ImportedTaskMappingStatus)
    : 'raw';
}

function mapRow(row: ImportRow): ImportedWritingTask {
  return {
    importId: row.import_id,
    sourceTaskId: row.source_task_id,
    itemNumber: row.item_number,
    title: payloadString(row.raw_payload, 'title'),
    topic: payloadString(row.raw_payload, 'topic'),
    generatedBy: payloadString(row.raw_payload, 'generated_by'),
    difficultyLevel: payloadNumber(row.raw_payload, 'difficulty_level'),
    mappingStatus: toMappingStatus(row.mapping_status),
    promotedQuestionId: row.promoted_question_id,
    sourceEndpoint: row.source_endpoint ?? '',
    ingestCount: row.ingest_count ?? 1,
    fetchedAt: toDateTime(row.first_seen_at),
    lastSeenAt: toDateTime(row.last_seen_at)
  };
}

const MOCK_IMPORTED_TASKS: ImportedWritingTask[] = [
  {
    importId: 9901,
    sourceTaskId: 'mock-task-51-0001',
    itemNumber: 51,
    title: '[모크] 동아리 모집 안내 글',
    topic: '학교생활',
    generatedBy: 'seed',
    difficultyLevel: 3,
    mappingStatus: 'raw',
    promotedQuestionId: null,
    sourceEndpoint: '/api/writing/tasks',
    ingestCount: 1,
    fetchedAt: '2026-06-22 10:00',
    lastSeenAt: '2026-06-22 10:00'
  },
  {
    importId: 9902,
    sourceTaskId: 'mock-task-52-0001',
    itemNumber: 52,
    title: '[모크] 잔디 보호 설명문',
    topic: '공원',
    generatedBy: 'seed',
    difficultyLevel: 4,
    mappingStatus: 'raw',
    promotedQuestionId: null,
    sourceEndpoint: '/api/writing/tasks',
    ingestCount: 1,
    fetchedAt: '2026-06-22 10:00',
    lastSeenAt: '2026-06-22 10:00'
  },
  {
    importId: 9903,
    sourceTaskId: 'mock-task-53-0001',
    itemNumber: 53,
    title: '[모크] 도서관 이용 목적 그래프',
    topic: '교육',
    generatedBy: 'seed',
    difficultyLevel: 5,
    mappingStatus: 'raw',
    promotedQuestionId: null,
    sourceEndpoint: '/api/writing/tasks',
    ingestCount: 1,
    fetchedAt: '2026-06-22 10:00',
    lastSeenAt: '2026-06-22 10:00'
  },
  {
    importId: 9904,
    sourceTaskId: 'mock-task-54-0001',
    itemNumber: 54,
    title: '[모크] 일터의 책임감',
    topic: '직장',
    generatedBy: 'seed',
    difficultyLevel: 5,
    mappingStatus: 'raw',
    promotedQuestionId: null,
    sourceEndpoint: '/api/writing/tasks',
    ingestCount: 1,
    fetchedAt: '2026-06-22 10:00',
    lastSeenAt: '2026-06-22 10:00'
  }
];

async function loadImportedTasks(
  signal?: AbortSignal
): Promise<ImportedWritingTask[]> {
  if (questionBankDataSource === 'mock') {
    return MOCK_IMPORTED_TASKS;
  }

  if (!supabaseClient) {
    throw new Error('Supabase client not configured');
  }

  const { data, error } = await supabaseClient
    .from('topik_writing_question_import')
    .select(SELECT_COLUMNS)
    .eq('is_latest', true)
    .order('item_number', { ascending: true, nullsFirst: false })
    .order('last_seen_at', { ascending: false });

  if (signal?.aborted) {
    throw new DOMException('Request aborted', 'AbortError');
  }
  if (error) {
    throw new Error(error.message);
  }
  return ((data ?? []) as unknown as ImportRow[]).map(mapRow);
}

export function fetchImportedTasksSafe(signal?: AbortSignal) {
  return toSafeResult(() =>
    withRetry(() => loadImportedTasks(signal), { maxRetries: 1 })
  );
}

export type IngestCounts = {
  inserted: number;
  new_version: number;
  unchanged: number;
  failed: number;
  total: number;
};

export type PromoteCounts = {
  promoted_new: number;
  promoted_updated: number;
  held: number;
};

export type IngestResult = {
  ingest: IngestCounts;
  promote: PromoteCounts | null;
};

/**
 * "가져오기" 버튼 — 서버 라우트(/api/writing-tasks/ingest)를 관리자 access_token으로
 * 호출해 외부 목록을 무손실 적재한다. Management 토큰·상류 자격증명은 서버 전용이며
 * 브라우저는 자신의 토큰만 전달한다(auth-email sync와 동일 패턴). 라우트는 Vercel
 * 함수이므로 vite dev에는 /api 프록시가 없어 실서버(또는 vercel dev)에서만 동작한다.
 */
async function triggerWritingTaskIngest(): Promise<IngestResult> {
  if (questionBankDataSource === 'mock' || !supabaseClient) {
    throw new Error('모크 모드에서는 가져오기를 실행할 수 없습니다(실모드에서만 가능).');
  }

  const { data: sessionData } = await supabaseClient.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) {
    throw new Error('로그인 세션이 없습니다. 다시 로그인 후 시도하세요.');
  }

  let res: Response;
  try {
    res = await fetch('/api/writing-tasks/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({})
    });
  } catch (networkError) {
    throw new Error(
      networkError instanceof Error ? networkError.message : '네트워크 오류로 가져오기에 실패했습니다.'
    );
  }

  // dev(vite)에는 /api 프록시가 없어 SPA fallback(HTML, 200)이 올 수 있다 — JSON이
  // 아니면 라우트 미가용으로 보고 명확히 안내(오해 소지의 'HTTP 200' 메시지 방지).
  const contentType = res.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    throw new Error(
      '가져오기 엔드포인트에 접근할 수 없습니다. 이 기능은 배포 환경(프로덕션/vercel dev)에서만 동작합니다.'
    );
  }

  const result = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    counts?: IngestCounts;
    promoted?: PromoteCounts;
    error?: string;
  };
  if (!res.ok || !result.ok || !result.counts) {
    throw new Error(result.error ?? `가져오기 실패 (HTTP ${res.status})`);
  }
  return { ingest: result.counts, promote: result.promoted ?? null };
}

export function triggerWritingTaskIngestSafe() {
  return toSafeResult(() => triggerWritingTaskIngest());
}
