import { isSupabaseConfigured } from '../../../shared/api/supabase-client';

/**
 * Operation > 정책 관리 data source switch.
 *
 * - 'supabase' - operation_policies/operation_policy_histories read path
 *                plus admin RPC write path. Default when Supabase is configured.
 * - 'mock'     - existing deterministic Zustand seed path when Supabase is
 *                missing or `VITE_SUPABASE_DISABLED=true`. Can be forced with
 *                `VITE_OPERATION_POLICIES_SOURCE=mock`.
 */
export type OperationPoliciesDataSource = 'mock' | 'supabase';

const env = import.meta.env as unknown as Record<string, string | undefined>;

export function resolveOperationPoliciesDataSource(): OperationPoliciesDataSource {
  if (!isSupabaseConfigured) {
    return 'mock';
  }

  return env.VITE_OPERATION_POLICIES_SOURCE === 'mock' ? 'mock' : 'supabase';
}

export const operationPoliciesDataSource = resolveOperationPoliciesDataSource();
