import { isSupabaseConfigured } from '../../../shared/api/supabase-client';

export type CommerceCouponsDataSource = 'mock' | 'supabase';

const env = import.meta.env as unknown as Record<string, string | undefined>;

export function resolveCommerceCouponsDataSource(): CommerceCouponsDataSource {
  if (!isSupabaseConfigured) {
    return 'mock';
  }

  return env.VITE_COMMERCE_COUPONS_SOURCE === 'mock' ? 'mock' : 'supabase';
}

export const commerceCouponsDataSource = resolveCommerceCouponsDataSource();
