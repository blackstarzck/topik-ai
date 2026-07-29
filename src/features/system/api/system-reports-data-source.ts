import { isSupabaseConfigured } from '../../../shared/api/supabase-client';

export type SystemReportsDataSource = 'mock' | 'supabase';

const env = import.meta.env as unknown as Record<string, string | undefined>;

export function resolveSystemReportsDataSource(): SystemReportsDataSource {
  if (!isSupabaseConfigured) {
    return 'mock';
  }

  return env.VITE_SYSTEM_REPORTS_SOURCE === 'mock' ? 'mock' : 'supabase';
}

export const systemReportsDataSource = resolveSystemReportsDataSource();
