import { isSupabaseConfigured } from '../../../shared/api/supabase-client';

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

const env = import.meta.env as unknown as Record<string, string | undefined>;

export function resolveOperationFaqsDataSource(): OperationFaqsDataSource {
  if (!isSupabaseConfigured) {
    return 'mock';
  }

  return env.VITE_OPERATION_FAQS_SOURCE === 'mock' ? 'mock' : 'supabase';
}

export const operationFaqsDataSource = resolveOperationFaqsDataSource();
