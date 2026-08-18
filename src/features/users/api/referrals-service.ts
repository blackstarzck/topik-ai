import type {
  ReferralStatus,
  ReferralSummary
} from '../model/referrals-types';
import { mockReferrals } from './mock-referrals';
import { toSafeResult, withRetry } from '@/shared/api/safe-request';
import { referralsDataSource } from './referrals-data-source';
import {
  adjustReferralRewardViaRpc,
  loadReferralsFromSupabase,
  reviewReferralAnomalyViaRpc,
  setReferralStatusViaRpc
} from './supabase-referrals-service';
import { sleep } from '@/shared/api/supabase-service-utils';

const isSupabaseSource = referralsDataSource === 'supabase';

/** 추천인 관리 화면이 Supabase 실데이터 경로인지(목록/액션 분기용). */
export const isReferralsSupabase = isSupabaseSource;

export type SetReferralStatusPayload = {
  referralId: string;
  nextStatus: ReferralStatus;
  reason: string;
};

export type ReviewReferralAnomalyPayload = {
  referralId: string;
  reason: string;
};

export type AdjustReferralRewardPayload = {
  referralId: string;
  amount: number;
  reason: string;
};

async function loadReferrals(signal?: AbortSignal): Promise<ReferralSummary[]> {
  if (isSupabaseSource) {
    return loadReferralsFromSupabase(signal);
  }

  await sleep(320, signal);
  return mockReferrals;
}

export function fetchReferralsSafe(signal?: AbortSignal) {
  return toSafeResult(() =>
    withRetry(() => loadReferrals(signal), {
      maxRetries: 1
    })
  );
}

export function setReferralStatusSafe(
  payload: SetReferralStatusPayload,
  signal?: AbortSignal
) {
  return toSafeResult(() =>
    setReferralStatusViaRpc(
      payload.referralId,
      payload.nextStatus,
      payload.reason,
      signal
    )
  );
}

export function reviewReferralAnomalySafe(
  payload: ReviewReferralAnomalyPayload,
  signal?: AbortSignal
) {
  return toSafeResult(() =>
    reviewReferralAnomalyViaRpc(payload.referralId, payload.reason, signal)
  );
}

export function adjustReferralRewardSafe(
  payload: AdjustReferralRewardPayload,
  signal?: AbortSignal
) {
  return toSafeResult(() =>
    adjustReferralRewardViaRpc(
      payload.referralId,
      payload.amount,
      payload.reason,
      signal
    )
  );
}
