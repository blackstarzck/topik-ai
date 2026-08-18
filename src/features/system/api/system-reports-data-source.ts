import { resolveDataSource } from '@/shared/api/data-source';

export type SystemReportsDataSource = 'mock' | 'supabase';

export function resolveSystemReportsDataSource(): SystemReportsDataSource {
  return resolveDataSource('VITE_SYSTEM_REPORTS_SOURCE');
}

export const systemReportsDataSource = resolveSystemReportsDataSource();
