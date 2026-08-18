import { supabaseClient } from '@/shared/api/supabase-client';
import { toSafeResult, withRetry } from '@/shared/api/safe-request';
import { questionBankDataSource } from './question-bank-data-source';
import type {
  ImportedTaskMappingStatus,
  ImportedTaskVersionDecision,
  ImportedWritingTask
} from '../model/imported-task-types';
import { toDateTimeMinutes as toDateTime } from '@/shared/model/date-format';

/**
 * 가져온 문항(인박스) 읽기 서비스. 인박스 테이블은 admin SELECT RLS가 열려 있어
 * 브라우저에서 직접 조회한다(쓰기는 서버 service-role/RPC 단일 경로 — 여기선 읽기만).
 * mock 모드(Supabase 미구성)에서는 결정적 픽스처를 반환한다.
 *
 * 표시값 일부(title/topic/generated_by/difficulty_level)는 raw_payload(원문)에서
 * 파생한다 — 목록 응답이 그 필드를 별도 컬럼이 아니라 원문 안에 담기 때문.
 */

const SELECT_COLUMNS =
  'import_id, source_task_id, item_number, raw_payload, mapping_status, is_latest, ' +
  'hold_reason, promoted_question_id, source_endpoint, ingest_count, first_seen_at, last_seen_at, ' +
  'source_created_at, source_updated_at, content_hash, version_decision';

type ImportRow = {
  import_id: number;
  source_task_id: string;
  item_number: number | null;
  raw_payload: unknown;
  mapping_status: string;
  is_latest: boolean;
  hold_reason: string | null;
  promoted_question_id: string | null;
  source_endpoint: string | null;
  ingest_count: number | null;
  first_seen_at: string | null;
  last_seen_at: string | null;
  source_created_at: string | null;
  source_updated_at: string | null;
  content_hash: string | null;
  version_decision: string;
};

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
const KNOWN_VERSION_DECISIONS: ImportedTaskVersionDecision[] = [
  'legacy',
  'initial',
  'content_changed',
  'metadata_only',
  'out_of_order',
  'timestamp_conflict',
  'identity_conflict',
  'invalid_timestamp'
];

function toMappingStatus(value: string): ImportedTaskMappingStatus {
  return (KNOWN_STATUSES as string[]).includes(value)
    ? (value as ImportedTaskMappingStatus)
    : 'raw';
}

function toVersionDecision(value: string): ImportedTaskVersionDecision {
  return (KNOWN_VERSION_DECISIONS as string[]).includes(value)
    ? (value as ImportedTaskVersionDecision)
    : 'legacy';
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
    isLatestReceived: row.is_latest,
    versionDecision: toVersionDecision(row.version_decision),
    holdReason: row.hold_reason ?? '',
    promotedQuestionId: row.promoted_question_id,
    sourceCreatedAt: toDateTime(row.source_created_at),
    sourceUpdatedAt: toDateTime(row.source_updated_at),
    contentHash: row.content_hash ?? '',
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
    isLatestReceived: true,
    versionDecision: 'initial',
    holdReason: '',
    promotedQuestionId: null,
    sourceCreatedAt: '2026-06-22 09:00',
    sourceUpdatedAt: '2026-06-22 10:00',
    contentHash: 'mock-content-hash-51',
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
    mappingStatus: 'held',
    isLatestReceived: true,
    versionDecision: 'metadata_only',
    holdReason: 'metadata_only: canonical learner/grading content is unchanged',
    promotedQuestionId: null,
    sourceCreatedAt: '2026-06-22 09:00',
    sourceUpdatedAt: '2026-06-22 10:00',
    contentHash: 'mock-content-hash-52',
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
    mappingStatus: 'held',
    isLatestReceived: true,
    versionDecision: 'out_of_order',
    holdReason: 'out_of_order: source updated_at is older than the latest observed source revision',
    promotedQuestionId: null,
    sourceCreatedAt: '2026-06-22 09:00',
    sourceUpdatedAt: '2026-06-22 09:30',
    contentHash: 'mock-content-hash-53',
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
    isLatestReceived: true,
    versionDecision: 'content_changed',
    holdReason: '',
    promotedQuestionId: null,
    sourceCreatedAt: '2026-06-22 09:00',
    sourceUpdatedAt: '2026-06-22 10:00',
    contentHash: 'mock-content-hash-54',
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
  metadata_only: number;
  held: number;
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

const INGEST_ERROR_MESSAGES: Record<string, string> = {
  upstream_login_failed: '외부 문항 공급 API 인증에 실패했습니다.',
  upstream_login_error: '외부 문항 공급 API 인증 중 통신 오류가 발생했습니다.',
  upstream_fetch_failed: '외부 문항 공급 API 조회에 실패했습니다.',
  upstream_fetch_error: '외부 문항 공급 API 조회 중 통신 오류가 발생했습니다.',
  upstream_contract_invalid: '외부 문항 응답 계약이 올바르지 않습니다. 중복 문항 ID를 확인해 주세요.',
  ingest_rpc_failed: '가져온 문항을 인박스에 저장하지 못했습니다.',
  ingest_partial_failure: '일부 문항을 인박스에 저장하지 못했습니다. 재시도해 주세요.',
  promotion_failed: '가져오기는 완료됐지만 정식 문항 승격에 실패했습니다.',
  promotion_partial_failure: '일부 문항이 승격되지 않았습니다. 보류 사유를 확인해 주세요.'
};

/**
 * "가져오기" 버튼 — 서버 라우트(/api/writing-tasks/ingest)를 관리자 access_token으로
 * 호출해 외부 목록을 무손실 적재한다. Management 토큰·상류 자격증명은 서버 전용이며
 * 브라우저는 자신의 토큰만 전달한다(auth-email sync와 동일 패턴). 프로덕션은 Vercel
 * 함수, 로컬 개발은 vite.config.ts의 API 어댑터가 같은 엔트리를 실행한다.
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

  // 플랫폼 함수가 시작 전에 실패하면 HTML/text 오류 응답이 올 수 있다. JSON이 아니면
  // 일반 HTTP 오류로 오해하지 않도록 서버 함수 응답 오류로 안내한다.
  const contentType = res.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    throw new Error(
      `가져오기 서버가 올바른 응답을 반환하지 않았습니다. 잠시 후 다시 시도하고 계속되면 서버 함수 로그를 확인하세요. (HTTP ${res.status})`
    );
  }

  const result = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    counts?: IngestCounts;
    promoted?: PromoteCounts;
    error?: string;
    error_ref?: string;
    correlation_id?: string;
  };
  if (!res.ok || !result.ok || !result.counts) {
    const message = result.error
      ? (INGEST_ERROR_MESSAGES[result.error] ?? '외부 문항 가져오기에 실패했습니다.')
      : `외부 문항 가져오기에 실패했습니다. (HTTP ${res.status})`;
    const reference = result.correlation_id ?? result.error_ref;
    throw new Error(reference ? `${message} 오류 참조: ${reference}` : message);
  }
  return { ingest: result.counts, promote: result.promoted ?? null };
}

export function triggerWritingTaskIngestSafe() {
  return toSafeResult(() => triggerWritingTaskIngest());
}
