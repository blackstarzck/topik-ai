import { isSupabaseConfigured } from '../../../shared/api/supabase-client';

export type SystemAuditLogsDataSource = 'mock' | 'supabase';

const env = import.meta.env as unknown as Record<string, string | undefined>;

export function resolveSystemAuditLogsDataSource(): SystemAuditLogsDataSource {
  if (!isSupabaseConfigured) {
    return 'mock';
  }

  return env.VITE_SYSTEM_AUDIT_LOGS_SOURCE === 'mock' ? 'mock' : 'supabase';
}

export const systemAuditLogsDataSource = resolveSystemAuditLogsDataSource();
