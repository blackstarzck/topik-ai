import { resolveDataSource } from '@/shared/api/data-source';

export type SystemMetadataDataSource = 'mock' | 'supabase';

export function resolveSystemMetadataDataSource(): SystemMetadataDataSource {
  return resolveDataSource('VITE_SYSTEM_METADATA_SOURCE');
}

export const systemMetadataDataSource = resolveSystemMetadataDataSource();
