export type BackupRunStatus =
  | 'running'
  | 'succeeded'
  | 'partial_failure'
  | 'failed'
  | 'delayed';

export type BackupComponentStatus =
  | 'pending'
  | 'succeeded'
  | 'failed'
  | 'not_run';

export type BackupValidationStatus = 'pending' | 'passed' | 'failed' | 'not_run';

export type RestoreDrillStatus = 'succeeded' | 'failed';

export type BackupSummary = {
  latestRunId: string | null;
  latestStatus: BackupRunStatus | null;
  latestStartedAt: string | null;
  latestCompletedAt: string | null;
  nextScheduledAt: string | null;
  diskUsedPercent: number | null;
  databaseStatus: BackupComponentStatus | null;
  databaseSizeBytes: number | null;
  storageStatus: BackupComponentStatus | null;
  storageObjectCount: number | null;
  storageSizeBytes: number | null;
  lastSuccessAt: string | null;
  recentSuccessCount: number;
  recentTerminalCount: number;
  lastRestoreStatus: RestoreDrillStatus | null;
  lastRestoreCompletedAt: string | null;
  lastReportReceivedAt: string | null;
};

export type BackupRun = {
  runId: string;
  status: BackupRunStatus;
  startedAt: string;
  completedAt: string | null;
  nextScheduledAt: string | null;
  diskUsedPercent: number | null;
  errorCode: string | null;
  databaseStatus: BackupComponentStatus;
  databaseSizeBytes: number | null;
  databaseValidationStatus: BackupValidationStatus;
  databaseErrorCode: string | null;
  storageStatus: BackupComponentStatus;
  storageObjectCount: number | null;
  storageSizeBytes: number | null;
  storageValidationStatus: BackupValidationStatus;
  storageErrorCode: string | null;
  systemLogId: string | null;
};

export type BackupRunQuery = {
  startedFrom?: string;
  startedTo?: string;
  result?: BackupRunStatus;
  target?: 'database' | 'storage';
  keyword?: string;
  page: number;
  pageSize: number;
};

export type BackupRunPage = {
  rows: BackupRun[];
  totalCount: number;
};

export type BackupDisplayStatus =
  | '진행 중'
  | '정상'
  | '부분 실패'
  | '실패'
  | '지연'
  | '기록 없음';

export type BackupHealthStatus = BackupDisplayStatus | '주의';

export const backupRunStatusLabels: Record<BackupRunStatus, BackupDisplayStatus> = {
  running: '진행 중',
  succeeded: '정상',
  partial_failure: '부분 실패',
  failed: '실패',
  delayed: '지연'
};

export const backupComponentStatusLabels: Record<BackupComponentStatus, BackupDisplayStatus> = {
  pending: '진행 중',
  succeeded: '정상',
  failed: '실패',
  not_run: '기록 없음'
};

export const backupValidationStatusLabels: Record<BackupValidationStatus, string> = {
  pending: '검사 중',
  passed: '통과',
  failed: '실패',
  not_run: '검사 안 함'
};

export function resolveBackupHealth(
  summary: BackupSummary | null,
  now = new Date()
): BackupHealthStatus {
  if (!summary?.latestRunId || !summary.latestStatus) return '기록 없음';
  if (summary.latestStatus === 'running') {
    if (
      summary.latestStartedAt &&
      now.getTime() - Date.parse(summary.latestStartedAt) >= 2 * 60 * 60 * 1000
    ) {
      return '지연';
    }
    return '진행 중';
  }
  if (!summary.lastSuccessAt) return '실패';
  const successAge = now.getTime() - Date.parse(summary.lastSuccessAt);
  if (successAge >= 12 * 60 * 60 * 1000) return '실패';
  if (successAge >= 8 * 60 * 60 * 1000) return '주의';
  return backupRunStatusLabels[summary.latestStatus];
}

export function resolveDiskStatus(percent: number | null): '정상' | '주의' | '위험' | '기록 없음' {
  if (percent === null) return '기록 없음';
  if (percent >= 90) return '위험';
  if (percent >= 80) return '주의';
  return '정상';
}

export function isRestoreDrillWarning(
  summary: BackupSummary | null,
  now = new Date()
): boolean {
  if (!summary?.lastRestoreCompletedAt || !summary.lastRestoreStatus) return true;
  if (summary.lastRestoreStatus === 'failed') return true;
  return now.getTime() - Date.parse(summary.lastRestoreCompletedAt) >= 35 * 24 * 60 * 60 * 1000;
}

export function formatBackupDateTime(value: string | null): string {
  if (!value) return '기록 없음';
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(new Date(value));
}

export function formatBackupBytes(value: number | null): string {
  if (value === null) return '기록 없음';
  if (value === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const unitIndex = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  const amount = value / 1024 ** unitIndex;
  return `${amount.toLocaleString('ko-KR', { maximumFractionDigits: unitIndex === 0 ? 0 : 1 })} ${units[unitIndex]}`;
}

export function formatBackupDuration(startedAt: string, completedAt: string | null): string {
  if (!completedAt) return '진행 중';
  const seconds = Math.max(0, Math.round((Date.parse(completedAt) - Date.parse(startedAt)) / 1000));
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return minutes > 0 ? `${minutes}분 ${remainder}초` : `${remainder}초`;
}

const backupErrorLabels: Record<string, string> = {
  BACKUP_LOCKED: '이전 백업이 끝나지 않아 이번 실행이 지연되었습니다.',
  DATABASE_DUMP_FAILED: '데이터베이스 내려받기에 실패했습니다.',
  DATABASE_VALIDATION_FAILED: '데이터베이스 백업 검사에 실패했습니다.',
  STORAGE_SYNC_FAILED: '파일 저장소 내려받기에 실패했습니다.',
  STORAGE_VALIDATION_FAILED: '파일 개수 또는 용량 검사에 실패했습니다.',
  BACKUP_REPOSITORY_FAILED: '암호화 백업 저장소 기록에 실패했습니다.',
  DISK_SPACE_LOW: '온프레미스 저장 공간이 부족합니다.',
  RESTORE_DATABASE_FAILED: '격리 환경 데이터베이스 복원에 실패했습니다.',
  RESTORE_STORAGE_FAILED: '격리 환경 파일 검사에 실패했습니다.'
};

export function formatBackupError(code: string | null): string {
  if (!code) return '오류 없음';
  return backupErrorLabels[code] ?? `분류된 오류가 발생했습니다. (${code})`;
}
