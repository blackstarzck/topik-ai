import { isSupabaseConfigured } from '../../../shared/api/supabase-client';

export type SystemPermissionsDataSource = 'mock' | 'supabase';

const env = import.meta.env as unknown as Record<string, string | undefined>;

export function resolveSystemPermissionsDataSource(): SystemPermissionsDataSource {
  if (!isSupabaseConfigured) {
    return 'mock';
  }

  return env.VITE_SYSTEM_PERMISSIONS_SOURCE === 'mock' ? 'mock' : 'supabase';
}

export const systemPermissionsDataSource = resolveSystemPermissionsDataSource();
