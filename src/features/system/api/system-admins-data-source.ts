import { resolveDataSource } from '@/shared/api/data-source';

export type SystemAdminsDataSource = 'mock' | 'supabase';

export function resolveSystemAdminsDataSource(): SystemAdminsDataSource {
  return resolveDataSource('VITE_SYSTEM_ADMINS_SOURCE');
}

export const systemAdminsDataSource = resolveSystemAdminsDataSource();
