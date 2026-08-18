import type {
  ReferralAnomalyStatus,
  ReferralPolicySnapshot,
  ReferralRelation,
  ReferralRewardLedgerEntry,
  ReferralStatus,
  ReferralSummary
} from '../model/referrals-types';
import { requireClient, requireReason, throwIfAborted } from '@/shared/api/supabase-service-utils';

/**
 * Users > 추천인 관리 Supabase 어댑터.
 * admin_list_referrals(전체 상세)/admin_set_referral_status/admin_review_referral_anomaly/
 * admin_adjust_referral_reward RPC 호출 + ReferralSummary 매핑. 모두 private.is_admin 가드.
 * 보상 정책(확정 시점/수단/회수 규칙)은 미확정 → 보상 조정은 감사 원장 기록만(stub).
 */
type ReferralRow = {
  id: string;
  code: string;
  referrer_user_id: string | null;
  referrer_name: string | null;
  referrer_email: string | null;
  created_at: string | null;
  expires_at: string | null;
  last_used_at: string | null;
  last_action_at: string | null;
  status: string;
  anomaly_status: string;
  anomaly_flags: unknown;
  referred_count: number | null;
  confirmed_count: number | null;
  total_reward_amount: number | null;
  admin_memo: string | null;
  relations: unknown;
  reward_ledger: unknown;
  policy_snapshot: unknown;
};

const DEFAULT_POLICY: ReferralPolicySnapshot = {
  version: '정책 초안 v0',
  confirmationTiming: '미확정',
  rewardMethod: '미확정',
  manualAdjustmentAuthority: '미확정',
  rollbackRule: '미확정',
  note: '추천 정책이 확정되지 않았습니다.'
};

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function mapReferralRow(row: ReferralRow): ReferralSummary {
  const policy = (row.policy_snapshot ?? null) as ReferralPolicySnapshot | null;
  return {
    id: row.id,
    code: row.code,
    referrerUserId: row.referrer_user_id ?? '',
    referrerName: row.referrer_name ?? '',
    referrerEmail: row.referrer_email ?? '',
    createdAt: row.created_at ?? '',
    expiresAt: row.expires_at ?? '',
    lastUsedAt: row.last_used_at ?? '',
    lastActionAt: row.last_action_at ?? '',
    status: row.status as ReferralStatus,
    anomalyStatus: row.anomaly_status as ReferralAnomalyStatus,
    anomalyFlags: asArray(row.anomaly_flags).map((item) => String(item)),
    referredCount: row.referred_count ?? 0,
    confirmedCount: row.confirmed_count ?? 0,
    totalRewardAmount: row.total_reward_amount ?? 0,
    adminMemo: row.admin_memo ?? '',
    relations: asArray(row.relations) as ReferralRelation[],
    rewardLedger: asArray(row.reward_ledger) as ReferralRewardLedgerEntry[],
    policySnapshot: policy ?? DEFAULT_POLICY
  };
}

export async function loadReferralsFromSupabase(
  signal?: AbortSignal
): Promise<ReferralSummary[]> {
  const client = requireClient();
  const { data, error } = await client.rpc('admin_list_referrals', {
    p_search: null,
    p_status: null,
    p_anomaly_status: null
  });

  throwIfAborted(signal);
  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as unknown as ReferralRow[]).map(mapReferralRow);
}

export async function setReferralStatusViaRpc(
  referralId: string,
  nextStatus: ReferralStatus,
  reason: string | undefined,
  signal?: AbortSignal
): Promise<void> {
  const client = requireClient();
  const confirmedReason = requireReason(reason);
  const { error } = await client.rpc('admin_set_referral_status', {
    p_referral_id: referralId,
    p_status: nextStatus,
    p_reason: confirmedReason
  });

  throwIfAborted(signal);
  if (error) {
    throw new Error(error.message);
  }
}

export async function reviewReferralAnomalyViaRpc(
  referralId: string,
  reason: string | undefined,
  signal?: AbortSignal
): Promise<void> {
  const client = requireClient();
  const confirmedReason = requireReason(reason);
  const { error } = await client.rpc('admin_review_referral_anomaly', {
    p_referral_id: referralId,
    p_reason: confirmedReason
  });

  throwIfAborted(signal);
  if (error) {
    throw new Error(error.message);
  }
}

export async function adjustReferralRewardViaRpc(
  referralId: string,
  amount: number,
  reason: string | undefined,
  signal?: AbortSignal
): Promise<string> {
  const client = requireClient();
  const confirmedReason = requireReason(reason);
  const { data, error } = await client.rpc('admin_adjust_referral_reward', {
    p_referral_id: referralId,
    p_amount: amount,
    p_reason: confirmedReason
  });

  throwIfAborted(signal);
  if (error) {
    throw new Error(error.message);
  }

  return String(data);
}
