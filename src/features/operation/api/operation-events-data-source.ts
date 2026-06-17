import { isSupabaseConfigured } from '../../../shared/api/supabase-client';

/**
 * Operation > 이벤트 data source switch.
 *
 * - 'supabase' - operation_events table read + admin RPC write path.
 *                Default when Supabase is configured.
 * - 'mock'     - existing deterministic seed path when Supabase is missing or
 *                `VITE_SUPABASE_DISABLED=true`. Can be forced with
 *                `VITE_OPERATION_EVENTS_SOURCE=mock`.
 */
export type OperationEventsDataSource = 'mock' | 'supabase';

const env = import.meta.env as unknown as Record<string, string | undefined>;

export function resolveOperationEventsDataSource(): OperationEventsDataSource {
  if (!isSupabaseConfigured) {
    return 'mock';
  }

  return env.VITE_OPERATION_EVENTS_SOURCE === 'mock' ? 'mock' : 'supabase';
}

export const operationEventsDataSource = resolveOperationEventsDataSource();
