import { isSupabaseConfigured } from '../../../shared/api/supabase-client';

export type SystemAdminsDataSource = 'mock' | 'supabase';

const env = import.meta.env as unknown as Record<string, string | undefined>;

export function resolveSystemAdminsDataSource(): SystemAdminsDataSource {
  if (!isSupabaseConfigured) {
    return 'mock';
  }

  return env.VITE_SYSTEM_ADMINS_SOURCE === 'mock' ? 'mock' : 'supabase';
}

export const systemAdminsDataSource = resolveSystemAdminsDataSource();
