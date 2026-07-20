import { supabaseClient } from '../../../shared/api/supabase-client';
import { normalizeTargetType } from '../../../shared/model/target-type-label';
import type { SystemAuditLogRow } from '../model/system-log-types';
import { decorateAuditLogAction } from './system-audit-logs-service';

type AuditLogDbRow = {
  log_id: string;
  target_type: string;
  target_id: string;
  action: string;
  actor: string | null;
  reason: string | null;
  diff: unknown;
  payload: unknown;
  created_at: string;
  total_count: number;
};

function requireClient() {
  if (!supabaseClient) {
    throw new Error('Supabase client not configured');
  }
  return supabaseClient;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new DOMException('Request aborted', 'AbortError');
  }
}

function toDateTime(value: string): string {
  return value.slice(0, 19).replace('T', ' ');
}

export function mapSupabaseAuditLogRow(row: AuditLogDbRow): SystemAuditLogRow {
  return decorateAuditLogAction({
    logId: row.log_id,
    targetType: normalizeTargetType(row.target_type),
    targetId: row.target_id,
    action: row.action,
    actor: row.actor ?? '',
    reason: row.reason ?? '',
    createdAt: toDateTime(row.created_at),
    // platform_admin only; null for other admins (gated in admin_list_audit_logs).
    diff: row.diff ?? undefined,
    payload: row.payload ?? undefined
  });
}

export async function loadSystemAuditLogsFromSupabase(
  signal?: AbortSignal
): Promise<SystemAuditLogRow[]> {
  const client = requireClient();
  const { data, error } = await client.rpc('admin_list_audit_logs', {
    p_target_type: null,
    p_target_id: null,
    p_keyword: null,
    p_start: null,
    p_end: null,
    p_limit: 100,
    p_offset: 0
  });

  throwIfAborted(signal);
  if (error) throw new Error(error.message);

  return ((data ?? []) as unknown as AuditLogDbRow[]).map(mapSupabaseAuditLogRow);
}
