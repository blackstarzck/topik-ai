import { isSupabaseConfigured } from '../../../shared/api/supabase-client';

export type SystemLogsDataSource = 'mock' | 'supabase';

const env = import.meta.env as unknown as Record<string, string | undefined>;

export function resolveSystemLogsDataSource(): SystemLogsDataSource {
  if (!isSupabaseConfigured) {
    return 'mock';
  }

  return env.VITE_SYSTEM_LOGS_SOURCE === 'mock' ? 'mock' : 'supabase';
}

export const systemLogsDataSource = resolveSystemLogsDataSource();
