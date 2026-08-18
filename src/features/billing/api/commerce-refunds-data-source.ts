import { resolveDataSource } from '@/shared/api/data-source';

export type CommerceRefundsDataSource = 'mock' | 'supabase';

export function resolveCommerceRefundsDataSource(): CommerceRefundsDataSource {
  return resolveDataSource('VITE_COMMERCE_REFUNDS_SOURCE');
}

export const commerceRefundsDataSource = resolveCommerceRefundsDataSource();
