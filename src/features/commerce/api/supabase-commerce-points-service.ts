import type {
  CommercePointsSnapshot,
  PointExpiration,
  PointLedger,
  PointPolicy
} from '../model/point-types';
import type {
  CreateManualPointAdjustmentPayload,
  ExportPointExpirationsPayload,
  ReleasePointExpirationHoldPayload,
  SavePointExpirationHoldPayload,
  SavePointPolicyPayload,
  UpdatePointPolicyStatusPayload
} from './points-service';
import { requireClient, requireReason, throwIfAborted } from '@/shared/api/supabase-service-utils';
import {
  EXPIRATION_STATUS_PAIRS,
  LEDGER_STATUS_PAIRS,
  POLICY_STATUS_PAIRS,
  UI_EXPIRATION_STATUS_BY_DB,
  UI_LEDGER_SOURCE_TYPE_BY_DB as UI_SOURCE_TYPE_BY_DB,
  UI_LEDGER_STATUS_BY_DB,
  UI_LEDGER_TYPE_BY_DB,
  UI_POLICY_STATUS_BY_DB,
  UI_POLICY_TYPE_BY_DB,
  DB_POLICY_STATUS_BY_UI,
  DB_POLICY_TYPE_BY_UI
} from '../model/point-enum-codec';
import {
  applyPlan,
  planExpirationQuery,
  planLedgerQuery,
  planPolicyQuery
} from './supabase-points-page-queries';
import type { PointsQueryChain } from './supabase-points-page-queries';
import { POINTS_SORT_TIE_BREAKER } from '../model/point-page-contract';
import type { PointsOverview, PointsPageSlice } from '../model/point-page-contract';
import type {
  PointExpirationQuery,
  PointLedgerQuery,
  PointPolicyQuery
} from '../model/point-types';
import { toDateOnly as toDate, toDateTimeMinutes as toDateTime } from '@/shared/model/date-format';

type PointPolicyRow = {
  id: string;
  name: string;
  policy_type: string;
  category: string | null;
  amount: number | null;
  points: number | null;
  status: string;
  description: string | null;
  condition_summary: string | null;
  earn_debit_rule: string | null;
  expiration_rule: string | null;
  target_condition: string | null;
  trigger_source: string | null;
  duplication_rule: string | null;
  manual_adjustment_rule: string | null;
  note: string | null;
  created_at: string | null;
  updated_at: string | null;
  updated_by: string | null;
};

type PointLedgerRow = {
  id: string;
  user_id: string;
  user_name: string | null;
  entry_type: string;
  source_type: string | null;
  amount: number;
  balance_after: number;
  available_balance_after: number;
  status: string;
  expiration_at: string | null;
  source: string | null;
  source_id: string | null;
  source_label: string | null;
  policy_id: string | null;
  policy_name: string | null;
  reason: string | null;
  approval_memo: string | null;
  occurred_at: string | null;
  created_at: string | null;
  created_by: string | null;
};

type PointExpirationRow = {
  id: string;
  user_id: string;
  user_name: string | null;
  source_type: string | null;
  scheduled_amount: number;
  available_amount: number | null;
  expire_at: string | null;
  status: string;
  hold_reason: string | null;
  held_by: string | null;
  held_at: string | null;
  processed_at: string | null;
  related_ledger_id: string | null;
  policy_id: string | null;
  policy_name: string | null;
  calculation_memo: string | null;
  created_at: string | null;
};

// 변환 맵은 공용 코덱이 소유한다 — 쌍 목록 하나에서 양방향이 파생되므로 어긋날 수 없고,
// CHECK 제약과의 일치는 `tests/unit/point-enum-codec.test.ts` 가 고정한다.

const POLICY_COLUMNS = [
  'id',
  'name',
  'policy_type',
  'category',
  'amount',
  'points',
  'status',
  'description',
  'condition_summary',
  'earn_debit_rule',
  'expiration_rule',
  'target_condition',
  'trigger_source',
  'duplication_rule',
  'manual_adjustment_rule',
  'note',
  'created_at',
  'updated_at',
  'updated_by'
].join(', ');

const LEDGER_COLUMNS = [
  'id',
  'user_id',
  'user_name',
  'entry_type',
  'source_type',
  'amount',
  'balance_after',
  'available_balance_after',
  'status',
  'expiration_at',
  'source',
  'source_id',
  'source_label',
  'policy_id',
  'policy_name',
  'reason',
  'approval_memo',
  'occurred_at',
  'created_at',
  'created_by'
].join(', ');

const EXPIRATION_COLUMNS = [
  'id',
  'user_id',
  'user_name',
  'source_type',
  'scheduled_amount',
  'available_amount',
  'expire_at',
  'status',
  'hold_reason',
  'held_by',
  'held_at',
  'processed_at',
  'related_ledger_id',
  'policy_id',
  'policy_name',
  'calculation_memo',
  'created_at'
].join(', ');

function mapPolicyRow(row: PointPolicyRow): PointPolicy {
  return {
    id: row.id,
    name: row.name,
    policyType: UI_POLICY_TYPE_BY_DB[row.policy_type] ?? '적립',
    conditionSummary: row.condition_summary ?? row.description ?? '',
    earnDebitRule: row.earn_debit_rule ?? '',
    expirationRule: row.expiration_rule ?? '',
    status: UI_POLICY_STATUS_BY_DB[row.status] ?? '초안',
    updatedAt: toDateTime(row.updated_at ?? row.created_at),
    updatedBy: row.updated_by ?? 'system',
    targetCondition: row.target_condition ?? '',
    triggerSource: row.trigger_source ?? '',
    duplicationRule: row.duplication_rule ?? '',
    manualAdjustmentRule: row.manual_adjustment_rule ?? '',
    note: row.note ?? ''
  };
}

function mapLedgerRow(row: PointLedgerRow): PointLedger {
  return {
    id: row.id,
    occurredAt: toDateTime(row.occurred_at ?? row.created_at),
    userId: row.user_id,
    userName: row.user_name ?? row.user_id,
    ledgerType: UI_LEDGER_TYPE_BY_DB[row.entry_type] ?? '적립',
    sourceType: UI_SOURCE_TYPE_BY_DB[row.source_type ?? ''] ?? '관리자',
    pointDelta: row.amount,
    balanceAfter: row.balance_after,
    availableBalanceAfter: row.available_balance_after,
    status: UI_LEDGER_STATUS_BY_DB[row.status] ?? '완료',
    expirationAt: toDate(row.expiration_at),
    sourceId: row.source_id ?? row.source ?? '',
    sourceLabel: row.source_label ?? row.source ?? '',
    policyId: row.policy_id ?? '',
    policyName: row.policy_name ?? '',
    reason: row.reason ?? '',
    approvalMemo: row.approval_memo ?? '',
    actedBy: row.created_by ?? 'system'
  };
}

function mapExpirationRow(row: PointExpirationRow): PointExpiration {
  return {
    id: row.id,
    scheduledAt: toDateTime(row.expire_at ?? row.created_at),
    userId: row.user_id,
    userName: row.user_name ?? row.user_id,
    sourceType: UI_SOURCE_TYPE_BY_DB[row.source_type ?? ''] ?? '시스템',
    expiringPoint: row.scheduled_amount,
    availablePoint: row.available_amount ?? row.scheduled_amount,
    status: UI_EXPIRATION_STATUS_BY_DB[row.status] ?? '예정',
    holdReason: row.hold_reason ?? '',
    heldBy: row.held_by ?? '',
    processedAt: toDateTime(row.processed_at),
    relatedLedgerId: row.related_ledger_id ?? '',
    policyId: row.policy_id ?? '',
    policyName: row.policy_name ?? '',
    calculationMemo: row.calculation_memo ?? ''
  };
}

async function loadPointPolicy(policyId: string): Promise<PointPolicy> {
  const client = requireClient();
  const { data, error } = await client
    .from('commerce_point_policies')
    .select(POLICY_COLUMNS)
    .eq('id', policyId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    throw new Error('저장된 포인트 정책을 다시 불러오지 못했습니다.');
  }
  return mapPolicyRow(data as unknown as PointPolicyRow);
}

async function loadPointLedger(ledgerId: string): Promise<PointLedger> {
  const client = requireClient();
  const { data, error } = await client
    .from('commerce_point_ledgers')
    .select(LEDGER_COLUMNS)
    .eq('id', ledgerId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    throw new Error('저장된 포인트 원장을 다시 불러오지 못했습니다.');
  }
  return mapLedgerRow(data as unknown as PointLedgerRow);
}

async function loadPointExpiration(expirationId: string): Promise<PointExpiration> {
  const client = requireClient();
  const { data, error } = await client
    .from('commerce_point_expirations')
    .select(EXPIRATION_COLUMNS)
    .eq('id', expirationId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    throw new Error('저장된 포인트 소멸 건을 다시 불러오지 못했습니다.');
  }
  return mapExpirationRow(data as unknown as PointExpirationRow);
}

export async function loadPointsSnapshotFromSupabase(
  signal?: AbortSignal
): Promise<CommercePointsSnapshot> {
  const client = requireClient();
  const [policies, ledgers, expirations] = await Promise.all([
    client
      .from('commerce_point_policies')
      .select(POLICY_COLUMNS)
      .order('updated_at', { ascending: false }),
    client
      .from('commerce_point_ledgers')
      .select(LEDGER_COLUMNS)
      .order('occurred_at', { ascending: false }),
    client
      .from('commerce_point_expirations')
      .select(EXPIRATION_COLUMNS)
      .order('expire_at', { ascending: true })
  ]);

  throwIfAborted(signal);
  if (policies.error) throw new Error(policies.error.message);
  if (ledgers.error) throw new Error(ledgers.error.message);
  if (expirations.error) throw new Error(expirations.error.message);

  return {
    policies: ((policies.data ?? []) as unknown as PointPolicyRow[]).map(
      mapPolicyRow
    ),
    ledgers: ((ledgers.data ?? []) as unknown as PointLedgerRow[]).map(
      mapLedgerRow
    ),
    expirations: (
      (expirations.data ?? []) as unknown as PointExpirationRow[]
    ).map(mapExpirationRow)
  };
}


/**
 * 탭별 서버 페이징 조회.
 *
 * 조건 수립은 순수 함수(`supabase-points-page-queries`)가 하고 여기서는 실행만 한다 —
 * 그래야 라이브 DB 없이 **호출 조건을 단위 테스트로 검사**할 수 있다.
 *
 * 🚨 정렬에는 항상 `id` 후속 키를 붙인다. 열거형 정렬키는 값이 3~7종뿐이라 동률이 흔하고,
 * 동률 순서를 고정하지 않으면 **페이지 경계에서 행이 중복·누락**된다.
 */
function toSlice<TRow, TItem>(
  rows: TRow[] | null,
  count: number | null,
  map: (row: TRow) => TItem
): PointsPageSlice<TItem> {
  return { rows: (rows ?? []).map(map), total: count ?? 0 };
}

export async function loadPointPoliciesPageFromSupabase(
  query: PointPolicyQuery,
  signal?: AbortSignal
): Promise<PointsPageSlice<PointPolicy>> {
  const client = requireClient();
  const plan = planPolicyQuery(query);
  // 경계 단언 1회 — 이후 체인은 우리 타입으로만 다룬다(모듈 주석 참고).
  const base = client
    .from('commerce_point_policies')
    .select(POLICY_COLUMNS, { count: 'exact' }) as unknown as PointsQueryChain;
  const { data, count, error } = await applyPlan(base, plan)
    .order(plan.order.column, { ascending: plan.order.ascending })
    .order(POINTS_SORT_TIE_BREAKER, { ascending: true })
    .range(plan.window.from, plan.window.to);

  throwIfAborted(signal);
  if (error) throw new Error(error.message);
  return toSlice(data as unknown as PointPolicyRow[] | null, count, mapPolicyRow);
}

export async function loadPointLedgersPageFromSupabase(
  query: PointLedgerQuery,
  signal?: AbortSignal
): Promise<PointsPageSlice<PointLedger>> {
  const client = requireClient();
  const plan = planLedgerQuery(query);
  // 경계 단언 1회 — 이후 체인은 우리 타입으로만 다룬다(모듈 주석 참고).
  const base = client
    .from('commerce_point_ledgers')
    .select(LEDGER_COLUMNS, { count: 'exact' }) as unknown as PointsQueryChain;
  const { data, count, error } = await applyPlan(base, plan)
    .order(plan.order.column, { ascending: plan.order.ascending })
    .order(POINTS_SORT_TIE_BREAKER, { ascending: true })
    .range(plan.window.from, plan.window.to);

  throwIfAborted(signal);
  if (error) throw new Error(error.message);
  return toSlice(data as unknown as PointLedgerRow[] | null, count, mapLedgerRow);
}

export async function loadPointExpirationsPageFromSupabase(
  query: PointExpirationQuery,
  signal?: AbortSignal
): Promise<PointsPageSlice<PointExpiration>> {
  const client = requireClient();
  const plan = planExpirationQuery(query);
  // 경계 단언 1회 — 이후 체인은 우리 타입으로만 다룬다(모듈 주석 참고).
  const base = client
    .from('commerce_point_expirations')
    .select(EXPIRATION_COLUMNS, { count: 'exact' }) as unknown as PointsQueryChain;
  const { data, count, error } = await applyPlan(base, plan)
    .order(plan.order.column, { ascending: plan.order.ascending })
    .order(POINTS_SORT_TIE_BREAKER, { ascending: true })
    .range(plan.window.from, plan.window.to);

  throwIfAborted(signal);
  if (error) throw new Error(error.message);
  return toSlice(data as unknown as PointExpirationRow[] | null, count, mapExpirationRow);
}

/**
 * 소멸 보류 등록 모달의 **선택 후보**.
 *
 * 🚨 이 모달은 목록의 현재 페이지가 아니라 **보류 가능한 전체 후보**에서 대상을 고른다.
 * 페이지 행만 넘기면 다른 페이지의 건을 고를 수 없어 기능이 줄어든다.
 *
 * 상한을 두지 않는 이유: 후보는 종결되지 않은 상태(`예정`·`보류`)로 도메인상 제한되고,
 * 상한을 두면 목록에 없는 건이 조용히 빠진다(선택 UI 에서는 그 사실을 알 수 없다).
 */
export async function loadHoldableExpirationsFromSupabase(
  signal?: AbortSignal
): Promise<PointExpiration[]> {
  const client = requireClient();
  const { data, error } = await client
    .from('commerce_point_expirations')
    .select(EXPIRATION_COLUMNS)
    .in('status', ['scheduled', 'held'])
    .order('expire_at', { ascending: true })
    .order('id', { ascending: true });

  throwIfAborted(signal);
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as PointExpirationRow[]).map(mapExpirationRow);
}

/** 단건 조회 — 현재 페이지 밖에 있는 `selected` 를 URL 로 복원할 때 쓴다. */
async function loadOneById<TRow, TItem>(
  table: string,
  columns: string,
  id: string,
  map: (row: TRow) => TItem,
  signal?: AbortSignal
): Promise<TItem | null> {
  const client = requireClient();
  const { data, error } = await client
    .from(table)
    .select(columns)
    .eq('id', id)
    .maybeSingle();

  throwIfAborted(signal);
  if (error) throw new Error(error.message);
  return data ? map(data as unknown as TRow) : null;
}

export function loadPointPolicyByIdFromSupabase(id: string, signal?: AbortSignal) {
  return loadOneById<PointPolicyRow, PointPolicy>(
    'commerce_point_policies',
    POLICY_COLUMNS,
    id,
    mapPolicyRow,
    signal
  );
}

export function loadPointLedgerByIdFromSupabase(id: string, signal?: AbortSignal) {
  return loadOneById<PointLedgerRow, PointLedger>(
    'commerce_point_ledgers',
    LEDGER_COLUMNS,
    id,
    mapLedgerRow,
    signal
  );
}

export function loadPointExpirationByIdFromSupabase(id: string, signal?: AbortSignal) {
  return loadOneById<PointExpirationRow, PointExpiration>(
    'commerce_point_expirations',
    EXPIRATION_COLUMNS,
    id,
    mapExpirationRow,
    signal
  );
}

/**
 * 요약 카드·탭 라벨용 건수.
 *
 * 요약 카드는 **상태 필터 역할**이므로 필터를 적용해 세면 자기 자신이 0 이 된다 → 필터 무관
 * 전체 기준으로 센다(지금 화면과 같은 의미). `head: true` 라 행을 받지 않는다.
 */
async function countRows(
  table: string,
  column: string | null,
  value: string | null
): Promise<number> {
  const client = requireClient();
  let builder = client.from(table).select('id', { count: 'exact', head: true });
  if (column && value) {
    builder = builder.eq(column, value);
  }
  const { count, error } = await builder;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function loadPointsOverviewFromSupabase(
  signal?: AbortSignal
): Promise<PointsOverview> {
  const policyStatuses = POLICY_STATUS_PAIRS;
  const ledgerStatuses = LEDGER_STATUS_PAIRS;
  const expirationStatuses = EXPIRATION_STATUS_PAIRS;

  const [
    policyAll,
    ledgerAll,
    expirationAll,
    policyByStatus,
    ledgerByStatus,
    expirationByStatus
  ] = await Promise.all([
    countRows('commerce_point_policies', null, null),
    countRows('commerce_point_ledgers', null, null),
    countRows('commerce_point_expirations', null, null),
    Promise.all(
      policyStatuses.map(([dbCode]) => countRows('commerce_point_policies', 'status', dbCode))
    ),
    Promise.all(
      ledgerStatuses.map(([dbCode]) => countRows('commerce_point_ledgers', 'status', dbCode))
    ),
    Promise.all(
      expirationStatuses.map(([dbCode]) =>
        countRows('commerce_point_expirations', 'status', dbCode)
      )
    )
  ]);

  throwIfAborted(signal);

  const toCounts = (
    pairs: readonly (readonly [string, string])[],
    counts: number[],
    all: number
  ) => {
    const result: Record<string, number> = { all };
    pairs.forEach(([, ui], index) => {
      result[ui] = counts[index];
    });
    return result;
  };

  return {
    tabCounts: { policy: policyAll, ledger: ledgerAll, expiration: expirationAll },
    policyStatusCounts: toCounts(policyStatuses, policyByStatus, policyAll),
    ledgerStatusCounts: toCounts(ledgerStatuses, ledgerByStatus, ledgerAll),
    expirationStatusCounts: toCounts(expirationStatuses, expirationByStatus, expirationAll)
  };
}

export async function savePointPolicyViaRpc(
  payload: SavePointPolicyPayload
): Promise<PointPolicy> {
  const client = requireClient();
  const { data, error } = await client.rpc('admin_save_commerce_point_policy', {
    p_id: payload.policyId ?? null,
    p_policy: {
      name: payload.name,
      policy_type: DB_POLICY_TYPE_BY_UI[payload.policyType],
      condition_summary: payload.conditionSummary,
      earn_debit_rule: payload.earnDebitRule,
      expiration_rule: payload.expirationRule,
      target_condition: payload.targetCondition,
      trigger_source: payload.triggerSource,
      duplication_rule: payload.duplicationRule,
      manual_adjustment_rule: payload.manualAdjustmentRule,
      note: payload.note
    },
    p_reason: payload.note || '포인트 정책 저장'
  });

  if (error) {
    throw new Error(error.message);
  }
  return loadPointPolicy(String(data));
}

export async function updatePointPolicyStatusViaRpc(
  payload: UpdatePointPolicyStatusPayload
): Promise<PointPolicy> {
  const client = requireClient();
  const { error } = await client.rpc(
    'admin_update_commerce_point_policy_status',
    {
      p_policy_id: payload.policyId,
      p_next_status: DB_POLICY_STATUS_BY_UI[payload.nextStatus],
      p_reason: requireReason(payload.reason)
    }
  );

  if (error) {
    throw new Error(error.message);
  }
  return loadPointPolicy(payload.policyId);
}

export async function createManualPointAdjustmentViaRpc(
  payload: CreateManualPointAdjustmentPayload
): Promise<PointLedger> {
  const client = requireClient();
  const { data, error } = await client.rpc(
    'admin_create_manual_point_adjustment',
    {
      p_user_id: payload.userId,
      p_amount:
        payload.ledgerType === '차감' || payload.ledgerType === '회수'
          ? -Math.abs(payload.amount)
          : Math.abs(payload.amount),
      p_reason: requireReason(payload.reason)
    }
  );

  if (error) {
    throw new Error(error.message);
  }
  return loadPointLedger(String(data));
}

export async function savePointExpirationHoldViaRpc(
  payload: SavePointExpirationHoldPayload
): Promise<PointExpiration> {
  const client = requireClient();
  const { error } = await client.rpc('admin_hold_commerce_point_expiration', {
    p_expiration_id: payload.expirationId,
    p_reason: requireReason(payload.holdReason)
  });

  if (error) {
    throw new Error(error.message);
  }
  return loadPointExpiration(payload.expirationId);
}

export async function releasePointExpirationHoldViaRpc(
  payload: ReleasePointExpirationHoldPayload
): Promise<PointExpiration> {
  const client = requireClient();
  const { error } = await client.rpc('admin_release_commerce_point_expiration', {
    p_expiration_id: payload.expirationId,
    p_reason: requireReason(payload.reason)
  });

  if (error) {
    throw new Error(error.message);
  }
  return loadPointExpiration(payload.expirationId);
}

export async function exportPointExpirationsFromSupabase(
  payload: ExportPointExpirationsPayload
): Promise<{ exportedAt: string; itemCount: number }> {
  return {
    exportedAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
    itemCount: payload.itemCount
  };
}
