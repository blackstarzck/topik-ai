import type {
  CommercePointsSnapshot,
  PointExpiration,
  PointExpirationStatus,
  PointLedger,
  PointLedgerSourceType,
  PointLedgerStatus,
  PointLedgerType,
  PointPolicy,
  PointPolicyStatus,
  PointPolicyType
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

const DB_POLICY_STATUS_BY_UI: Record<PointPolicyStatus, string> = {
  초안: 'draft',
  '운영 중': 'active',
  중지: 'inactive'
};

const UI_POLICY_STATUS_BY_DB: Record<string, PointPolicyStatus> = {
  draft: '초안',
  active: '운영 중',
  inactive: '중지'
};

const DB_POLICY_TYPE_BY_UI: Record<PointPolicyType, string> = {
  적립: 'earn',
  차감: 'debit',
  소멸: 'expire'
};

const UI_POLICY_TYPE_BY_DB: Record<string, PointPolicyType> = {
  earn: '적립',
  debit: '차감',
  expire: '소멸'
};

const UI_LEDGER_TYPE_BY_DB: Record<string, PointLedgerType> = {
  earn: '적립',
  debit: '차감',
  revoke: '회수',
  restore: '복구',
  expire: '소멸'
};

const UI_SOURCE_TYPE_BY_DB: Record<string, PointLedgerSourceType> = {
  referral: '추천',
  mission: '미션',
  event: '이벤트',
  payment: '결제',
  refund: '환불',
  admin: '관리자',
  system: '시스템'
};

const UI_LEDGER_STATUS_BY_DB: Record<string, PointLedgerStatus> = {
  completed: '완료',
  held: '보류',
  cancelled: '취소'
};

const UI_EXPIRATION_STATUS_BY_DB: Record<string, PointExpirationStatus> = {
  scheduled: '예정',
  held: '보류',
  completed: '완료',
  cancelled: '취소'
};

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
