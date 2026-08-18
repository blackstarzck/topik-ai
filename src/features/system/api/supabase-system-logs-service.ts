import type { SystemLogLevel, SystemLogRow } from '../model/system-log-types';
import { requireClient, throwIfAborted } from '@/shared/api/supabase-service-utils';
import { toDateTimeSeconds as toDateTime } from '@/shared/model/date-format';

type SystemLogDbRow = {
  id: string;
  level: string;
  component: string;
  message: string;
  trace_id: string | null;
  context: unknown;
  created_at: string;
};

const SYSTEM_LOG_COLUMNS = [
  'id',
  'level',
  'component',
  'message',
  'trace_id',
  'context',
  'created_at'
].join(', ');

function toLogLevel(value: string): SystemLogLevel {
  if (value === 'WARN' || value === 'ERROR') {
    return value;
  }
  return 'INFO';
}

function mapSystemLogRow(row: SystemLogDbRow): SystemLogRow {
  return {
    id: row.id,
    level: toLogLevel(row.level),
    component: row.component,
    message: row.message,
    traceId: row.trace_id ?? undefined,
    context: row.context,
    createdAt: toDateTime(row.created_at)
  };
}

export async function loadSystemLogsFromSupabase(
  signal?: AbortSignal
): Promise<SystemLogRow[]> {
  const client = requireClient();
  const { data, error } = await client
    .from('system_logs')
    .select(SYSTEM_LOG_COLUMNS)
    .order('created_at', { ascending: false });

  throwIfAborted(signal);
  if (error) throw new Error(error.message);

  return ((data ?? []) as unknown as SystemLogDbRow[]).map(mapSystemLogRow);
}
