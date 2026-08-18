import type {
  BackupComponentStatus,
  BackupRun,
  BackupRunPage,
  BackupRunQuery,
  BackupRunStatus,
  BackupSummary,
  BackupValidationStatus,
  RestoreDrillStatus
} from '../model/backup-types';
import { requireClient, throwIfAborted } from '@/shared/api/supabase-service-utils';

type BackupSummaryRow = {
  latest_run_id: string | null;
  latest_status: BackupRunStatus | null;
  latest_started_at: string | null;
  latest_completed_at: string | null;
  next_scheduled_at: string | null;
  disk_used_percent: number | null;
  database_status: BackupComponentStatus | null;
  database_size_bytes: number | null;
  storage_status: BackupComponentStatus | null;
  storage_object_count: number | null;
  storage_size_bytes: number | null;
  last_success_at: string | null;
  recent_success_count: number;
  recent_terminal_count: number;
  last_restore_status: RestoreDrillStatus | null;
  last_restore_completed_at: string | null;
  last_report_received_at: string | null;
};

type BackupRunRow = {
  run_id: string;
  display_status: BackupRunStatus;
  started_at: string;
  completed_at: string | null;
  next_scheduled_at: string | null;
  disk_used_percent: number | null;
  error_code: string | null;
  database_status: BackupComponentStatus;
  database_size_bytes: number | null;
  database_validation_status: BackupValidationStatus;
  database_error_code: string | null;
  storage_status: BackupComponentStatus;
  storage_object_count: number | null;
  storage_size_bytes: number | null;
  storage_validation_status: BackupValidationStatus;
  storage_error_code: string | null;
  system_log_id: string | null;
  total_count: number;
};

export async function loadBackupSummaryFromSupabase(
  signal?: AbortSignal
): Promise<BackupSummary> {
  const request = requireClient().rpc('get_admin_backup_summary');
  const { data, error } = await (signal ? request.abortSignal(signal) : request);
  throwIfAborted(signal);
  if (error) throw new Error(error.message);
  const row = ((data ?? []) as BackupSummaryRow[])[0];
  if (!row) throw new Error('백업 요약 응답이 비어 있습니다.');
  return {
    latestRunId: row.latest_run_id,
    latestStatus: row.latest_status,
    latestStartedAt: row.latest_started_at,
    latestCompletedAt: row.latest_completed_at,
    nextScheduledAt: row.next_scheduled_at,
    diskUsedPercent: row.disk_used_percent === null ? null : Number(row.disk_used_percent),
    databaseStatus: row.database_status,
    databaseSizeBytes: row.database_size_bytes === null ? null : Number(row.database_size_bytes),
    storageStatus: row.storage_status,
    storageObjectCount: row.storage_object_count === null ? null : Number(row.storage_object_count),
    storageSizeBytes: row.storage_size_bytes === null ? null : Number(row.storage_size_bytes),
    lastSuccessAt: row.last_success_at,
    recentSuccessCount: Number(row.recent_success_count ?? 0),
    recentTerminalCount: Number(row.recent_terminal_count ?? 0),
    lastRestoreStatus: row.last_restore_status,
    lastRestoreCompletedAt: row.last_restore_completed_at,
    lastReportReceivedAt: row.last_report_received_at
  };
}

function mapBackupRun(row: BackupRunRow): BackupRun {
  return {
    runId: row.run_id,
    status: row.display_status,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    nextScheduledAt: row.next_scheduled_at,
    diskUsedPercent: row.disk_used_percent === null ? null : Number(row.disk_used_percent),
    errorCode: row.error_code,
    databaseStatus: row.database_status,
    databaseSizeBytes: row.database_size_bytes === null ? null : Number(row.database_size_bytes),
    databaseValidationStatus: row.database_validation_status,
    databaseErrorCode: row.database_error_code,
    storageStatus: row.storage_status,
    storageObjectCount: row.storage_object_count === null ? null : Number(row.storage_object_count),
    storageSizeBytes: row.storage_size_bytes === null ? null : Number(row.storage_size_bytes),
    storageValidationStatus: row.storage_validation_status,
    storageErrorCode: row.storage_error_code,
    systemLogId: row.system_log_id
  };
}

export async function loadBackupRunsFromSupabase(
  query: BackupRunQuery,
  signal?: AbortSignal
): Promise<BackupRunPage> {
  const request = requireClient().rpc('get_admin_backup_runs', {
    p_started_from: query.startedFrom ?? null,
    p_started_to: query.startedTo ?? null,
    p_result: query.result ?? null,
    p_target: query.target ?? null,
    p_keyword: query.keyword?.trim() || null,
    p_limit: query.pageSize,
    p_offset: (query.page - 1) * query.pageSize
  });
  const { data, error } = await (signal ? request.abortSignal(signal) : request);
  throwIfAborted(signal);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as BackupRunRow[];
  return {
    rows: rows.map(mapBackupRun),
    totalCount: Number(rows[0]?.total_count ?? 0)
  };
}
