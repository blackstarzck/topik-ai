import { resolveDataSource } from '@/shared/api/data-source';

export type SystemLogsDataSource = 'mock' | 'supabase';

export function resolveSystemLogsDataSource(): SystemLogsDataSource {
  return resolveDataSource('VITE_SYSTEM_LOGS_SOURCE');
}

export const systemLogsDataSource = resolveSystemLogsDataSource();
