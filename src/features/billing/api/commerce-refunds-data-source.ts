import { isSupabaseConfigured } from '../../../shared/api/supabase-client';

export type CommerceRefundsDataSource = 'mock' | 'supabase';

const env = import.meta.env as unknown as Record<string, string | undefined>;

export function resolveCommerceRefundsDataSource(): CommerceRefundsDataSource {
  if (!isSupabaseConfigured) {
    return 'mock';
  }

  return env.VITE_COMMERCE_REFUNDS_SOURCE === 'mock' ? 'mock' : 'supabase';
}

export const commerceRefundsDataSource = resolveCommerceRefundsDataSource();
