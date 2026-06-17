import { isSupabaseConfigured } from '../../../shared/api/supabase-client';

/**
 * Community data source switch.
 *
 * - 'supabase' - community_posts/community_reports read path plus admin RPC write path.
 *                Default when Supabase is configured.
 * - 'mock'     - existing deterministic Zustand seed path when Supabase is missing or
 *                `VITE_SUPABASE_DISABLED=true`. Can be forced with `VITE_COMMUNITY_SOURCE=mock`.
 */
export type CommunityDataSource = 'mock' | 'supabase';

const env = import.meta.env as unknown as Record<string, string | undefined>;

export function resolveCommunityDataSource(): CommunityDataSource {
  if (!isSupabaseConfigured) {
    return 'mock';
  }

  return env.VITE_COMMUNITY_SOURCE === 'mock' ? 'mock' : 'supabase';
}

export const communityDataSource = resolveCommunityDataSource();
