import { resolveDataSource } from '@/shared/api/data-source';

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

export function resolveOperationPoliciesDataSource(): OperationPoliciesDataSource {
  return resolveDataSource('VITE_OPERATION_POLICIES_SOURCE');
}

export const operationPoliciesDataSource = resolveOperationPoliciesDataSource();
