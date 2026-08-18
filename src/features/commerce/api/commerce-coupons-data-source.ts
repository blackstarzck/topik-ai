import { resolveDataSource } from '@/shared/api/data-source';

export type CommerceCouponsDataSource = 'mock' | 'supabase';

export function resolveCommerceCouponsDataSource(): CommerceCouponsDataSource {
  return resolveDataSource('VITE_COMMERCE_COUPONS_SOURCE');
}

export const commerceCouponsDataSource = resolveCommerceCouponsDataSource();
