import { isSupabaseConfigured } from '../../../shared/api/supabase-client';

/**
 * Users > 추천인 관리 데이터 소스 스위치.
 *
 * - 'supabase' — referrals/referral_relations/referral_reward_ledgers 읽기 +
 *                admin RPC(목록/상태/이상치검토/보상조정) 호출. Supabase 구성 시 기본값.
 * - 'mock'     — Supabase 미구성/`VITE_SUPABASE_DISABLED` 시 기존 결정적 시드
 *                (mock 회귀 e2e 경로). `VITE_REFERRALS_SOURCE=mock`으로 강제 가능.
 */
export type ReferralsDataSource = 'mock' | 'supabase';

const env = import.meta.env as unknown as Record<string, string | undefined>;

export function resolveReferralsDataSource(): ReferralsDataSource {
  if (!isSupabaseConfigured) {
    return 'mock';
  }

  return env.VITE_REFERRALS_SOURCE === 'mock' ? 'mock' : 'supabase';
}

export const referralsDataSource = resolveReferralsDataSource();
