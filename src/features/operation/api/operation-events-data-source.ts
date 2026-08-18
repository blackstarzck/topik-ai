import { resolveDataSource } from '@/shared/api/data-source';

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

export function resolveOperationEventsDataSource(): OperationEventsDataSource {
  return resolveDataSource('VITE_OPERATION_EVENTS_SOURCE');
}

export const operationEventsDataSource = resolveOperationEventsDataSource();
