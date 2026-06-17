import { isSupabaseConfigured } from '../../../shared/api/supabase-client';

export type SystemMetadataDataSource = 'mock' | 'supabase';

const env = import.meta.env as unknown as Record<string, string | undefined>;

export function resolveSystemMetadataDataSource(): SystemMetadataDataSource {
  if (!isSupabaseConfigured) {
    return 'mock';
  }

  return env.VITE_SYSTEM_METADATA_SOURCE === 'mock' ? 'mock' : 'supabase';
}

export const systemMetadataDataSource = resolveSystemMetadataDataSource();
