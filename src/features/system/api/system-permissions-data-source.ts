import { resolveDataSource } from '@/shared/api/data-source';

export type SystemPermissionsDataSource = 'mock' | 'supabase';

export function resolveSystemPermissionsDataSource(): SystemPermissionsDataSource {
  return resolveDataSource('VITE_SYSTEM_PERMISSIONS_SOURCE');
}

export const systemPermissionsDataSource = resolveSystemPermissionsDataSource();
