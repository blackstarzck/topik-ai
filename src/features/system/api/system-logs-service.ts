import { toSafeResult, withRetry } from '@/shared/api/safe-request';
import { createMockSystemLogs } from './mock-system-logs';
import { loadSystemLogsFromSupabase } from './supabase-system-logs-service';
import { systemLogsDataSource } from './system-logs-data-source';
import type { SystemLogRow } from '../model/system-log-types';
import { sleep } from '@/shared/api/supabase-service-utils';

async function loadSystemLogs(signal?: AbortSignal): Promise<SystemLogRow[]> {
  if (systemLogsDataSource === 'supabase') {
    return loadSystemLogsFromSupabase(signal);
  }

  await sleep(180, signal);
  return createMockSystemLogs();
}

export function fetchSystemLogsSafe(signal?: AbortSignal) {
  return toSafeResult(() =>
    withRetry(() => loadSystemLogs(signal), { maxRetries: 1 })
  );
}
