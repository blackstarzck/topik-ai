import type {
  BackupRun,
  BackupRunPage,
  BackupRunQuery,
  BackupRunStatus,
  BackupSummary
} from '../model/backup-types';

const HOUR = 60 * 60 * 1000;

function iso(hoursFromNow: number): string {
  return new Date(Date.now() + hoursFromNow * HOUR).toISOString();
}

function createRun(
  index: number,
  status: BackupRunStatus,
  databaseStatus: BackupRun['databaseStatus'],
  storageStatus: BackupRun['storageStatus']
): BackupRun {
  const startedAt = iso(-(index * 6 + 1));
  const completedAt = status === 'running' ? null : iso(-(index * 6 + 0.7));
  const runId = `10000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`;
  return {
    runId,
    status,
    startedAt,
    completedAt,
    nextScheduledAt: iso(5 - index * 6),
    diskUsedPercent: index === 4 ? 91 : 48 + index * 3,
    errorCode: status === 'delayed' ? 'BACKUP_LOCKED' : status === 'failed' ? 'DATABASE_DUMP_FAILED' : null,
    databaseStatus,
    databaseSizeBytes: databaseStatus === 'not_run' ? 0 : 284_000_000 + index * 1_000_000,
    databaseValidationStatus: databaseStatus === 'succeeded' ? 'passed' : databaseStatus === 'pending' ? 'pending' : databaseStatus === 'not_run' ? 'not_run' : 'failed',
    databaseErrorCode: databaseStatus === 'failed' ? 'DATABASE_VALIDATION_FAILED' : null,
    storageStatus,
    storageObjectCount: storageStatus === 'not_run' ? 0 : 12_480 + index * 12,
    storageSizeBytes: storageStatus === 'not_run' ? 0 : 4_280_000_000 + index * 15_000_000,
    storageValidationStatus: storageStatus === 'succeeded' ? 'passed' : storageStatus === 'pending' ? 'pending' : storageStatus === 'not_run' ? 'not_run' : 'failed',
    storageErrorCode: storageStatus === 'failed' ? 'STORAGE_VALIDATION_FAILED' : null,
    systemLogId: status === 'running' ? null : `BACKUP-20000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`
  };
}

export function createMockBackupRuns(): BackupRun[] {
  return [
    createRun(0, 'running', 'pending', 'pending'),
    createRun(1, 'succeeded', 'succeeded', 'succeeded'),
    createRun(2, 'partial_failure', 'succeeded', 'failed'),
    createRun(3, 'failed', 'failed', 'failed'),
    createRun(4, 'delayed', 'not_run', 'not_run'),
    createRun(5, 'succeeded', 'succeeded', 'succeeded'),
    createRun(6, 'succeeded', 'succeeded', 'succeeded'),
    createRun(7, 'succeeded', 'succeeded', 'succeeded')
  ];
}

export function createMockBackupSummary(): BackupSummary {
  const latest = createMockBackupRuns()[1];
  return {
    latestRunId: latest.runId,
    latestStatus: latest.status,
    latestStartedAt: latest.startedAt,
    latestCompletedAt: latest.completedAt,
    nextScheduledAt: iso(5),
    diskUsedPercent: latest.diskUsedPercent,
    databaseStatus: latest.databaseStatus,
    databaseSizeBytes: latest.databaseSizeBytes,
    storageStatus: latest.storageStatus,
    storageObjectCount: latest.storageObjectCount,
    storageSizeBytes: latest.storageSizeBytes,
    lastSuccessAt: latest.startedAt,
    recentSuccessCount: 4,
    recentTerminalCount: 6,
    lastRestoreStatus: 'succeeded',
    lastRestoreCompletedAt: iso(-24 * 12),
    lastReportReceivedAt: iso(-0.7)
  };
}

export function loadMockBackupRuns(query: BackupRunQuery): BackupRunPage {
  const keyword = query.keyword?.trim().toLowerCase() ?? '';
  const startedFrom = query.startedFrom ? Date.parse(query.startedFrom) : null;
  const startedTo = query.startedTo ? Date.parse(query.startedTo) : null;
  const filtered = createMockBackupRuns().filter((row) => {
    if (startedFrom !== null && Date.parse(row.startedAt) < startedFrom) return false;
    if (startedTo !== null && Date.parse(row.startedAt) >= startedTo) return false;
    if (keyword && !row.runId.toLowerCase().includes(keyword)) return false;
    if (!query.result) return true;
    if (query.target === 'database') return row.databaseStatus === query.result;
    if (query.target === 'storage') return row.storageStatus === query.result;
    return row.status === query.result;
  });
  const offset = (query.page - 1) * query.pageSize;
  return {
    rows: filtered.slice(offset, offset + query.pageSize),
    totalCount: filtered.length
  };
}
