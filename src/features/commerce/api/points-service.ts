import { toSafeResult, withRetry } from '@/shared/api/safe-request';
import {
  createInitialPointExpirations,
  createInitialPointLedgers,
  createInitialPointPolicies
} from './mock-points';
import { commercePointsDataSource } from './commerce-points-data-source';
import {
  createManualPointAdjustmentViaRpc,
  exportPointExpirationsFromSupabase,
  loadHoldableExpirationsFromSupabase,
  loadPointExpirationByIdFromSupabase,
  loadPointExpirationsPageFromSupabase,
  loadPointLedgerByIdFromSupabase,
  loadPointLedgersPageFromSupabase,
  loadPointPolicyByIdFromSupabase,
  loadPointPoliciesPageFromSupabase,
  loadPointsOverviewFromSupabase,
  loadPointsSnapshotFromSupabase,
  releasePointExpirationHoldViaRpc,
  savePointExpirationHoldViaRpc,
  savePointPolicyViaRpc,
  updatePointPolicyStatusViaRpc
} from './supabase-commerce-points-service';
import {
  filterExpirations,
  filterLedgers,
  filterPolicies,
  paginateItems,
  sortExpirations,
  sortLedgers,
  sortPolicies
} from '../model/commerce-points-page-schema';
import type { PointsOverview, PointsPageSlice } from '../model/point-page-contract';
import type {
  PointExpirationQuery,
  PointLedgerQuery,
  PointPolicyQuery
} from '../model/point-types';
import type {
  CommercePointsSnapshot,
  PointExpiration,
  PointExpirationStatus,
  PointLedger,
  PointLedgerType,
  PointPolicy,
  PointPolicyStatus,
  PointPolicyType
} from '../model/point-types';
import { sleep } from '@/shared/api/supabase-service-utils';
import { formatNowMinutes as formatNow } from '@/shared/model/date-format';

export type SavePointPolicyPayload = {
  policyId?: string;
  name: string;
  policyType: PointPolicyType;
  conditionSummary: string;
  earnDebitRule: string;
  expirationRule: string;
  targetCondition: string;
  triggerSource: string;
  duplicationRule: string;
  manualAdjustmentRule: string;
  note: string;
  actedBy?: string;
};

export type UpdatePointPolicyStatusPayload = {
  policyId: string;
  nextStatus: Exclude<PointPolicyStatus, '초안'>;
  reason: string;
  actedBy?: string;
};

export type CreateManualPointAdjustmentPayload = {
  userId: string;
  userName: string;
  ledgerType: Extract<PointLedgerType, '적립' | '차감' | '회수' | '복구'>;
  amount: number;
  reason: string;
  approvalMemo: string;
  actedBy?: string;
};

export type SavePointExpirationHoldPayload = {
  expirationId: string;
  holdReason: string;
  actedBy?: string;
};

export type ReleasePointExpirationHoldPayload = {
  expirationId: string;
  reason: string;
  actedBy?: string;
};

export type ExportPointExpirationsPayload = {
  itemCount: number;
};

function clonePolicies(items: PointPolicy[]): PointPolicy[] {
  return items.map((item) => ({ ...item }));
}

function cloneLedgers(items: PointLedger[]): PointLedger[] {
  return items.map((item) => ({ ...item }));
}

function cloneExpirations(items: PointExpiration[]): PointExpiration[] {
  return items.map((item) => ({ ...item }));
}

let pointPolicies = createInitialPointPolicies();
let pointLedgers = createInitialPointLedgers();
let pointExpirations = createInitialPointExpirations();
const isSupabaseSource = commercePointsDataSource === 'supabase';

function cloneSnapshot(): CommercePointsSnapshot {
  return {
    policies: clonePolicies(pointPolicies),
    ledgers: cloneLedgers(pointLedgers),
    expirations: cloneExpirations(pointExpirations)
  };
}

function createSequenceId(prefix: string, items: Array<{ id: string }>): string {
  const numeric = items
    .map((item) => Number(item.id.replace(/[^0-9]/g, '')))
    .filter((value) => Number.isFinite(value));
  const nextNumber = (numeric.length ? Math.max(...numeric) : 0) + 1;
  return `${prefix}-${String(nextNumber).padStart(4, '0')}`;
}

function getLatestUserBalance(userId: string): number {
  const latestLedger = pointLedgers.find((item) => item.userId === userId);
  return latestLedger?.availableBalanceAfter ?? 0;
}

function appendReasonLog(
  baseNote: string,
  actedBy: string,
  reason: string
): string {
  const nextEntry = `[${formatNow()} / ${actedBy}] ${reason}`;
  const trimmedBase = baseNote.trim();
  return trimmedBase ? `${trimmedBase}\n${nextEntry}` : nextEntry;
}

async function loadPointsSnapshot(
  signal?: AbortSignal
): Promise<CommercePointsSnapshot> {
  await sleep(320, signal);
  return cloneSnapshot();
}

async function savePointPolicy(
  payload: SavePointPolicyPayload
): Promise<PointPolicy> {
  await sleep(180);

  const actedBy = payload.actedBy ?? 'ops.kim';
  const updatedAt = formatNow();

  if (payload.policyId) {
    const current = pointPolicies.find((item) => item.id === payload.policyId);
    if (!current) {
      throw new Error('포인트 정책을 찾을 수 없습니다.');
    }

    const updatedPolicy: PointPolicy = {
      ...current,
      name: payload.name,
      policyType: payload.policyType,
      conditionSummary: payload.conditionSummary,
      earnDebitRule: payload.earnDebitRule,
      expirationRule: payload.expirationRule,
      targetCondition: payload.targetCondition,
      triggerSource: payload.triggerSource,
      duplicationRule: payload.duplicationRule,
      manualAdjustmentRule: payload.manualAdjustmentRule,
      note: payload.note.trim(),
      updatedAt,
      updatedBy: actedBy
    };

    pointPolicies = pointPolicies.map((item) =>
      item.id === payload.policyId ? updatedPolicy : item
    );

    return { ...updatedPolicy };
  }

  const nextPolicy: PointPolicy = {
    id: createSequenceId('POL', pointPolicies),
    name: payload.name,
    policyType: payload.policyType,
    conditionSummary: payload.conditionSummary,
    earnDebitRule: payload.earnDebitRule,
    expirationRule: payload.expirationRule,
    status: '초안',
    updatedAt,
    updatedBy: actedBy,
    targetCondition: payload.targetCondition,
    triggerSource: payload.triggerSource,
    duplicationRule: payload.duplicationRule,
    manualAdjustmentRule: payload.manualAdjustmentRule,
    note: payload.note.trim()
  };

  pointPolicies = [nextPolicy, ...pointPolicies];
  return { ...nextPolicy };
}

async function updatePointPolicyStatus(
  payload: UpdatePointPolicyStatusPayload
): Promise<PointPolicy> {
  await sleep(160);

  const current = pointPolicies.find((item) => item.id === payload.policyId);
  if (!current) {
    throw new Error('포인트 정책을 찾을 수 없습니다.');
  }

  const actedBy = payload.actedBy ?? 'ops.kim';
  const nextPolicy: PointPolicy = {
    ...current,
    status: payload.nextStatus,
    updatedAt: formatNow(),
    updatedBy: actedBy,
    note: appendReasonLog(
      current.note,
      actedBy,
      `${payload.nextStatus} 전환 - ${payload.reason}`
    )
  };

  pointPolicies = pointPolicies.map((item) =>
    item.id === payload.policyId ? nextPolicy : item
  );

  return { ...nextPolicy };
}

function updateExpirationsForManualAdjustment(
  userId: string,
  pointDelta: number
): void {
  if (pointDelta >= 0) {
    return;
  }

  let remaining = Math.abs(pointDelta);

  pointExpirations = pointExpirations.map((item) => {
    if (item.userId !== userId || item.status !== '예정' || remaining <= 0) {
      return item;
    }

    const deducted = Math.min(item.availablePoint, remaining);
    remaining -= deducted;

    return {
      ...item,
      availablePoint: Math.max(item.availablePoint - deducted, 0),
      calculationMemo: appendReasonLog(
        item.calculationMemo,
        'system',
        `수동 조정 반영 - 사용 가능 포인트 ${deducted}P 차감`
      )
    };
  });
}

async function createManualPointAdjustment(
  payload: CreateManualPointAdjustmentPayload
): Promise<PointLedger> {
  await sleep(220);

  const actedBy = payload.actedBy ?? 'ops.kim';
  const occurredAt = formatNow();
  const pointDelta =
    payload.ledgerType === '차감' || payload.ledgerType === '회수'
      ? -Math.abs(payload.amount)
      : Math.abs(payload.amount);
  const availableBalanceBefore = getLatestUserBalance(payload.userId);
  const nextBalance = availableBalanceBefore + pointDelta;

  const nextLedger: PointLedger = {
    id: createSequenceId('PL', pointLedgers),
    occurredAt,
    userId: payload.userId,
    userName: payload.userName,
    ledgerType: payload.ledgerType,
    sourceType: '관리자',
    pointDelta,
    balanceAfter: nextBalance,
    availableBalanceAfter: nextBalance,
    status: '완료',
    expirationAt: pointDelta > 0 ? '2026-06-30' : '',
    sourceId: createSequenceId('MANUAL', pointLedgers),
    sourceLabel: '운영 수동 조정',
    policyId: 'POL-1002',
    policyName: '운영 수동 조정',
    reason: payload.reason.trim(),
    approvalMemo: payload.approvalMemo.trim(),
    actedBy
  };

  pointLedgers = [nextLedger, ...pointLedgers];
  updateExpirationsForManualAdjustment(payload.userId, pointDelta);

  return { ...nextLedger };
}

async function savePointExpirationHold(
  payload: SavePointExpirationHoldPayload
): Promise<PointExpiration> {
  await sleep(180);

  const current = pointExpirations.find((item) => item.id === payload.expirationId);
  if (!current) {
    throw new Error('소멸 예정 건을 찾을 수 없습니다.');
  }

  const actedBy = payload.actedBy ?? 'ops.kim';
  const nextStatus: PointExpirationStatus =
    current.status === '완료' ? '완료' : '보류';
  const nextExpiration: PointExpiration = {
    ...current,
    status: nextStatus,
    holdReason: payload.holdReason.trim(),
    heldBy: actedBy,
    calculationMemo: appendReasonLog(
      current.calculationMemo,
      actedBy,
      `보류 등록 - ${payload.holdReason}`
    )
  };

  pointExpirations = pointExpirations.map((item) =>
    item.id === payload.expirationId ? nextExpiration : item
  );

  return { ...nextExpiration };
}

async function releasePointExpirationHold(
  payload: ReleasePointExpirationHoldPayload
): Promise<PointExpiration> {
  await sleep(180);

  const current = pointExpirations.find((item) => item.id === payload.expirationId);
  if (!current) {
    throw new Error('소멸 예정 건을 찾을 수 없습니다.');
  }

  const actedBy = payload.actedBy ?? 'ops.kim';
  const nextExpiration: PointExpiration = {
    ...current,
    status: '예정',
    holdReason: '',
    heldBy: '',
    calculationMemo: appendReasonLog(
      current.calculationMemo,
      actedBy,
      `보류 해제 - ${payload.reason}`
    )
  };

  pointExpirations = pointExpirations.map((item) =>
    item.id === payload.expirationId ? nextExpiration : item
  );

  return { ...nextExpiration };
}

async function exportPointExpirations(
  payload: ExportPointExpirationsPayload
): Promise<{ exportedAt: string; itemCount: number }> {
  await sleep(120);
  return {
    exportedAt: formatNow(),
    itemCount: payload.itemCount
  };
}


/**
 * mock 경로의 탭별 페이지 조회.
 *
 * 🔑 **기존 화면 로직(`filterX` → `sortX` → `paginateItems`)을 그대로 재사용한다.** 서버
 * 전환에서 가장 위험한 것이 "필터·정렬·페이징 의미가 미묘하게 달라지는 것"인데, mock 경로가
 * 같은 함수를 쓰면 그 경로에서는 **구조적으로** 동등하다. Supabase 경로의 동등성은
 * `tests/unit/points-page-queries.test.ts` 가 조건 수립을 검사해 지킨다.
 */
function slicePolicies(query: PointPolicyQuery): PointsPageSlice<PointPolicy> {
  const filtered = filterPolicies(clonePolicies(pointPolicies), query);
  const sorted = sortPolicies(filtered, query);
  return { rows: paginateItems(sorted, query.page, query.pageSize), total: filtered.length };
}

function sliceLedgers(query: PointLedgerQuery): PointsPageSlice<PointLedger> {
  const filtered = filterLedgers(cloneLedgers(pointLedgers), query);
  const sorted = sortLedgers(filtered, query);
  return { rows: paginateItems(sorted, query.page, query.pageSize), total: filtered.length };
}

function sliceExpirations(query: PointExpirationQuery): PointsPageSlice<PointExpiration> {
  const filtered = filterExpirations(cloneExpirations(pointExpirations), query);
  const sorted = sortExpirations(filtered, query);
  return { rows: paginateItems(sorted, query.page, query.pageSize), total: filtered.length };
}

function countByStatus<T extends { status: string }>(items: T[]): Record<string, number> {
  const counts: Record<string, number> = { all: items.length };
  for (const item of items) {
    counts[item.status] = (counts[item.status] ?? 0) + 1;
  }
  return counts;
}

function buildMockOverview(): PointsOverview {
  return {
    tabCounts: {
      policy: pointPolicies.length,
      ledger: pointLedgers.length,
      expiration: pointExpirations.length
    },
    policyStatusCounts: countByStatus(pointPolicies),
    ledgerStatusCounts: countByStatus(pointLedgers),
    expirationStatusCounts: countByStatus(pointExpirations)
  };
}

export function fetchPointsOverviewSafe(signal?: AbortSignal) {
  return toSafeResult(() =>
    withRetry(
      async () => {
        if (isSupabaseSource) {
          return loadPointsOverviewFromSupabase(signal);
        }
        await sleep(200, signal);
        return buildMockOverview();
      },
      { maxRetries: 1 }
    )
  );
}

export function fetchPointPoliciesPageSafe(query: PointPolicyQuery, signal?: AbortSignal) {
  return toSafeResult(() =>
    withRetry(
      async () => {
        if (isSupabaseSource) {
          return loadPointPoliciesPageFromSupabase(query, signal);
        }
        await sleep(220, signal);
        return slicePolicies(query);
      },
      { maxRetries: 1 }
    )
  );
}

export function fetchPointLedgersPageSafe(query: PointLedgerQuery, signal?: AbortSignal) {
  return toSafeResult(() =>
    withRetry(
      async () => {
        if (isSupabaseSource) {
          return loadPointLedgersPageFromSupabase(query, signal);
        }
        await sleep(220, signal);
        return sliceLedgers(query);
      },
      { maxRetries: 1 }
    )
  );
}

export function fetchPointExpirationsPageSafe(
  query: PointExpirationQuery,
  signal?: AbortSignal
) {
  return toSafeResult(() =>
    withRetry(
      async () => {
        if (isSupabaseSource) {
          return loadPointExpirationsPageFromSupabase(query, signal);
        }
        await sleep(220, signal);
        return sliceExpirations(query);
      },
      { maxRetries: 1 }
    )
  );
}

/** 소멸 보류 모달의 선택 후보(보류 가능 상태 전체). */
export function fetchHoldableExpirationsSafe(signal?: AbortSignal) {
  return toSafeResult(() =>
    withRetry(
      async () => {
        if (isSupabaseSource) {
          return loadHoldableExpirationsFromSupabase(signal);
        }
        await sleep(160, signal);
        return cloneExpirations(pointExpirations).filter(
          (item) => item.status === '예정' || item.status === '보류'
        );
      },
      { maxRetries: 1 }
    )
  );
}

/**
 * 현재 페이지 밖에 있는 `selected` 를 URL 로 복원한다.
 *
 * 🚨 서버 페이징에서는 상세 대상이 현재 페이지에 없을 수 있다. 이전 배선은 목록에서 못 찾으면
 * URL 의 `selected` 를 **지웠다** — 전량 조회에서는 "없는 id"만 그랬지만 페이징에서는
 * "다른 페이지의 id"까지 지워진다. 그래서 단건 조회로 복원한다.
 */
export function fetchPointRecordByIdSafe(
  tab: 'policy' | 'ledger' | 'expiration',
  id: string,
  signal?: AbortSignal
) {
  return toSafeResult(async () => {
    if (isSupabaseSource) {
      if (tab === 'policy') return loadPointPolicyByIdFromSupabase(id, signal);
      if (tab === 'ledger') return loadPointLedgerByIdFromSupabase(id, signal);
      return loadPointExpirationByIdFromSupabase(id, signal);
    }
    await sleep(120, signal);
    if (tab === 'policy') {
      return clonePolicies(pointPolicies).find((item) => item.id === id) ?? null;
    }
    if (tab === 'ledger') {
      return cloneLedgers(pointLedgers).find((item) => item.id === id) ?? null;
    }
    return cloneExpirations(pointExpirations).find((item) => item.id === id) ?? null;
  });
}

export function fetchPointsSnapshotSafe(signal?: AbortSignal) {
  return toSafeResult(() =>
    withRetry(
      () =>
        isSupabaseSource
          ? loadPointsSnapshotFromSupabase(signal)
          : loadPointsSnapshot(signal),
      { maxRetries: 1 }
    )
  );
}

export function savePointPolicySafe(payload: SavePointPolicyPayload) {
  return toSafeResult(() =>
    isSupabaseSource ? savePointPolicyViaRpc(payload) : savePointPolicy(payload)
  );
}

export function updatePointPolicyStatusSafe(
  payload: UpdatePointPolicyStatusPayload
) {
  return toSafeResult(() =>
    isSupabaseSource
      ? updatePointPolicyStatusViaRpc(payload)
      : updatePointPolicyStatus(payload)
  );
}

export function createManualPointAdjustmentSafe(
  payload: CreateManualPointAdjustmentPayload
) {
  return toSafeResult(() =>
    isSupabaseSource
      ? createManualPointAdjustmentViaRpc(payload)
      : createManualPointAdjustment(payload)
  );
}

export function savePointExpirationHoldSafe(
  payload: SavePointExpirationHoldPayload
) {
  return toSafeResult(() =>
    isSupabaseSource
      ? savePointExpirationHoldViaRpc(payload)
      : savePointExpirationHold(payload)
  );
}

export function releasePointExpirationHoldSafe(
  payload: ReleasePointExpirationHoldPayload
) {
  return toSafeResult(() =>
    isSupabaseSource
      ? releasePointExpirationHoldViaRpc(payload)
      : releasePointExpirationHold(payload)
  );
}

export function exportPointExpirationsSafe(
  payload: ExportPointExpirationsPayload
) {
  return toSafeResult(() =>
    isSupabaseSource
      ? exportPointExpirationsFromSupabase(payload)
      : exportPointExpirations(payload)
  );
}
