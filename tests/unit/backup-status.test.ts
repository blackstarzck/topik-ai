import { describe, expect, it } from 'vitest';

import {
  isRestoreDrillWarning,
  resolveBackupHealth,
  resolveDiskStatus,
  type BackupSummary
} from '../../src/features/system/model/backup-types';

const NOW = new Date('2026-07-20T12:00:00.000Z');

function summary(overrides: Partial<BackupSummary> = {}): BackupSummary {
  return {
    latestRunId: '10000000-0000-4000-8000-000000000001',
    latestStatus: 'succeeded',
    latestStartedAt: '2026-07-20T11:00:00.000Z',
    latestCompletedAt: '2026-07-20T11:10:00.000Z',
    nextScheduledAt: '2026-07-20T17:30:00.000Z',
    diskUsedPercent: 50,
    databaseStatus: 'succeeded',
    databaseSizeBytes: 100,
    storageStatus: 'succeeded',
    storageObjectCount: 2,
    storageSizeBytes: 200,
    lastSuccessAt: '2026-07-20T11:00:00.000Z',
    recentSuccessCount: 4,
    recentTerminalCount: 4,
    lastRestoreStatus: 'succeeded',
    lastRestoreCompletedAt: '2026-07-01T00:00:00.000Z',
    lastReportReceivedAt: '2026-07-20T11:10:30.000Z',
    ...overrides
  };
}

describe('backup status thresholds', () => {
  it('shows no record before the first report', () => {
    expect(resolveBackupHealth(null, NOW)).toBe('기록 없음');
  });

  it('marks a running job delayed after two hours', () => {
    expect(resolveBackupHealth(summary({
      latestStatus: 'running',
      latestStartedAt: '2026-07-20T09:59:59.000Z'
    }), NOW)).toBe('지연');
  });

  it('keeps the first backup in progress before the delay threshold', () => {
    expect(resolveBackupHealth(summary({
      latestStatus: 'running',
      latestStartedAt: '2026-07-20T11:00:00.000Z',
      lastSuccessAt: null
    }), NOW)).toBe('진행 중');
  });

  it('marks last success age at eight hours warning and twelve hours failed', () => {
    expect(resolveBackupHealth(summary({ lastSuccessAt: '2026-07-20T04:00:00.000Z' }), NOW)).toBe('주의');
    expect(resolveBackupHealth(summary({ lastSuccessAt: '2026-07-20T00:00:00.000Z' }), NOW)).toBe('실패');
  });

  it('uses the agreed disk thresholds', () => {
    expect(resolveDiskStatus(79.99)).toBe('정상');
    expect(resolveDiskStatus(80)).toBe('주의');
    expect(resolveDiskStatus(90)).toBe('위험');
  });

  it('warns when restore success is older than thirty-five days or the last drill failed', () => {
    expect(isRestoreDrillWarning(summary({
      lastRestoreCompletedAt: '2026-06-15T12:00:00.000Z'
    }), NOW)).toBe(true);
    expect(isRestoreDrillWarning(summary({ lastRestoreStatus: 'failed' }), NOW)).toBe(true);
  });
});
