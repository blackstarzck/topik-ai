import { resolveDataSource } from '@/shared/api/data-source';

/**
 * Operation > FAQ data source switch.
 *
 * - 'supabase' - operation_faq* tables read + admin RPC write path.
 *                Default when Supabase is configured.
 * - 'mock'     - existing deterministic seed path when Supabase is missing or
 *                `VITE_SUPABASE_DISABLED=true`. Can be forced with
 *                `VITE_OPERATION_FAQS_SOURCE=mock`.
 */
export type OperationFaqsDataSource = 'mock' | 'supabase';

export function resolveOperationFaqsDataSource(): OperationFaqsDataSource {
  return resolveDataSource('VITE_OPERATION_FAQS_SOURCE');
}

export const operationFaqsDataSource = resolveOperationFaqsDataSource();
