import { toSafeResult, withRetry } from '@/shared/api/safe-request';
import { backupDataSource } from './backup-data-source';
import {
  createMockBackupSummary,
  loadMockBackupRuns
} from './mock-backups';
import {
  loadBackupRunsFromSupabase,
  loadBackupSummaryFromSupabase
} from './supabase-backups-service';
import type { BackupRunQuery } from '../model/backup-types';

export function fetchBackupSummarySafe(signal?: AbortSignal) {
  return toSafeResult(() =>
    withRetry(
      () => backupDataSource === 'supabase'
        ? loadBackupSummaryFromSupabase(signal)
        : Promise.resolve(createMockBackupSummary()),
      { maxRetries: 1 }
    )
  );
}

export function fetchBackupRunsSafe(query: BackupRunQuery, signal?: AbortSignal) {
  return toSafeResult(() =>
    withRetry(
      () => backupDataSource === 'supabase'
        ? loadBackupRunsFromSupabase(query, signal)
        : Promise.resolve(loadMockBackupRuns(query)),
      { maxRetries: 1 }
    )
  );
}
