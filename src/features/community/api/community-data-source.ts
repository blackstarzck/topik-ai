import { resolveDataSource } from '@/shared/api/data-source';

/**
 * Community data source switch.
 *
 * - 'supabase' - community_posts/community_reports read path plus admin RPC write path.
 *                Default when Supabase is configured.
 * - 'mock'     - existing deterministic Zustand seed path when Supabase is missing or
 *                `VITE_SUPABASE_DISABLED=true`. Can be forced with `VITE_COMMUNITY_SOURCE=mock`.
 */
export type CommunityDataSource = 'mock' | 'supabase';

export function resolveCommunityDataSource(): CommunityDataSource {
  return resolveDataSource('VITE_COMMUNITY_SOURCE');
}

export const communityDataSource = resolveCommunityDataSource();
