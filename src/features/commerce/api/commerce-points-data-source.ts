import { resolveDataSource } from '@/shared/api/data-source';

export type CommercePointsDataSource = 'mock' | 'supabase';

export function resolveCommercePointsDataSource(): CommercePointsDataSource {
  return resolveDataSource('VITE_COMMERCE_POINTS_SOURCE');
}

export const commercePointsDataSource = resolveCommercePointsDataSource();
