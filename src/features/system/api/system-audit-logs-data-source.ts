import { resolveDataSource } from '@/shared/api/data-source';

export type SystemAuditLogsDataSource = 'mock' | 'supabase';

export function resolveSystemAuditLogsDataSource(): SystemAuditLogsDataSource {
  return resolveDataSource('VITE_SYSTEM_AUDIT_LOGS_SOURCE');
}

export const systemAuditLogsDataSource = resolveSystemAuditLogsDataSource();
