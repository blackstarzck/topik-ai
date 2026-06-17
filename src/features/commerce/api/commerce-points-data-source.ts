import { isSupabaseConfigured } from '../../../shared/api/supabase-client';

export type CommercePointsDataSource = 'mock' | 'supabase';

const env = import.meta.env as unknown as Record<string, string | undefined>;

export function resolveCommercePointsDataSource(): CommercePointsDataSource {
  if (!isSupabaseConfigured) {
    return 'mock';
  }

  return env.VITE_COMMERCE_POINTS_SOURCE === 'mock' ? 'mock' : 'supabase';
}

export const commercePointsDataSource = resolveCommercePointsDataSource();
