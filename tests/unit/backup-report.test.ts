import { createHmac } from 'node:crypto';

import { describe, expect, it, vi } from 'vitest';

import {
  handleBackupReport,
  isValidMonitoringTarget,
  resolveBackupAlert
} from '../../api/backups/report';

const SECRET = 'unit-test-backup-report-secret';
const RUN_ID = '10000000-0000-4000-8000-000000000001';
const REPORT_ID = '20000000-0000-4000-8000-000000000001';

function startedPayload() {
  return {
    report_type: 'backup_started',
    report_id: REPORT_ID,
    run_id: RUN_ID,
    source_project: 'topik-prod',
    started_at: '2026-07-20T00:30:00+09:00',
    next_scheduled_at: '2026-07-20T06:30:00+09:00',
    disk_used_percent: 42.5
  };
}

function signedRequest(
  payload: unknown,
  options?: {
    timestampOffset?: number;
    signature?: string;
    destination?: 'primary' | 'mirror';
  }
): Request {
  const body = JSON.stringify(payload);
  const destination = options?.destination ?? 'primary';
  const timestamp = String(Math.floor(Date.now() / 1000) + (options?.timestampOffset ?? 0));
  const signature = options?.signature ?? createHmac('sha256', SECRET)
    .update(`${timestamp}.${destination}.${body}`)
    .digest('hex');
  return new Request('https://admin.example.com/api/backups/report', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-backup-timestamp': timestamp,
      'x-backup-signature': signature,
      'x-backup-destination': destination
    },
    body
  });
}

describe('backup report receiver', () => {
  it('accepts one valid signed start report', async () => {
    const recorder = vi.fn().mockResolvedValue('accepted' as const);
    const response = await handleBackupReport(
      signedRequest(startedPayload()),
      SECRET,
      recorder,
      'primary'
    );

    expect(response.status).toBe(202);
    expect(recorder).toHaveBeenCalledOnce();
    expect(await response.json()).toEqual({ ok: true, result: 'accepted' });
  });

  it('returns success for an exact duplicate so the on-premise queue can stop retrying', async () => {
    const recorder = vi.fn().mockResolvedValue('duplicate' as const);
    const response = await handleBackupReport(
      signedRequest(startedPayload()),
      SECRET,
      recorder,
      'primary'
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, result: 'duplicate' });
  });

  it('rejects an invalid signature and a stale timestamp', async () => {
    const recorder = vi.fn().mockResolvedValue('accepted' as const);
    const invalid = await handleBackupReport(
      signedRequest(startedPayload(), { signature: '0'.repeat(64) }),
      SECRET,
      recorder,
      'primary'
    );
    const stale = await handleBackupReport(
      signedRequest(startedPayload(), { timestampOffset: -301 }),
      SECRET,
      recorder,
      'primary'
    );

    expect(invalid.status).toBe(401);
    expect(stale.status).toBe(401);
    expect(recorder).not.toHaveBeenCalled();
  });

  it('rejects a report when its signature is replayed for the other destination', async () => {
    const recorder = vi.fn().mockResolvedValue('accepted' as const);
    const response = await handleBackupReport(
      signedRequest(startedPayload(), { destination: 'primary' }),
      SECRET,
      recorder,
      'mirror'
    );

    expect(response.status).toBe(401);
    expect(recorder).not.toHaveBeenCalled();
  });

  it('rejects unexpected sensitive fields instead of storing them', async () => {
    const recorder = vi.fn().mockResolvedValue('accepted' as const);
    const response = await handleBackupReport(
      signedRequest({ ...startedPayload(), file_path: '/srv/topik-backup/member-export.sql' }),
      SECRET,
      recorder,
      'primary'
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ ok: false, error: 'unexpected_field' });
    expect(recorder).not.toHaveBeenCalled();
  });

  it('rejects a body larger than the fixed report limit', async () => {
    const recorder = vi.fn().mockResolvedValue('accepted' as const);
    const response = await handleBackupReport(
      signedRequest({ ...startedPayload(), padding: 'x'.repeat(33 * 1024) }),
      SECRET,
      recorder,
      'primary'
    );

    expect(response.status).toBe(413);
    expect(recorder).not.toHaveBeenCalled();
  });

  it('rejects a completion whose overall result contradicts its components', async () => {
    const recorder = vi.fn().mockResolvedValue('accepted' as const);
    const response = await handleBackupReport(
      signedRequest({
        report_type: 'backup_completed',
        report_id: REPORT_ID,
        run_id: RUN_ID,
        source_project: 'topik-prod',
        started_at: '2026-07-20T00:30:00+09:00',
        completed_at: '2026-07-20T00:35:00+09:00',
        next_scheduled_at: '2026-07-20T06:30:00+09:00',
        status: 'succeeded',
        database: {
          status: 'succeeded',
          size_bytes: 1000,
          validation_status: 'passed'
        },
        storage: {
          status: 'failed',
          size_bytes: 2000,
          object_count: 3,
          validation_status: 'failed',
          error_code: 'STORAGE_VALIDATION_FAILED'
        },
        disk_used_percent: 43
      }),
      SECRET,
      recorder,
      'primary'
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ ok: false, error: 'inconsistent_overall_status' });
  });

  it('maps an immutable or conflicting database transition to conflict', async () => {
    const recorder = vi.fn().mockRejectedValue(new Error('completed backup is immutable'));
    const response = await handleBackupReport(
      signedRequest(startedPayload()),
      SECRET,
      recorder,
      'primary'
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ ok: false, error: 'report_conflict' });
  });

  it('accepts a failed first restore drill even when no source backup exists yet', async () => {
    const recorder = vi.fn().mockResolvedValue('accepted' as const);
    const response = await handleBackupReport(
      signedRequest({
        report_type: 'restore_drill_completed',
        report_id: REPORT_ID,
        drill_id: '30000000-0000-4000-8000-000000000001',
        source_project: 'topik-prod',
        started_at: '2026-07-20T03:00:00+09:00',
        completed_at: '2026-07-20T03:01:00+09:00',
        status: 'failed',
        database_validation_status: 'failed',
        storage_validation_status: 'failed',
        error_code: 'RESTORE_DATABASE_FAILED'
      }),
      SECRET,
      recorder,
      'primary'
    );

    expect(response.status).toBe(202);
    expect(recorder.mock.calls[0]?.[0]).not.toHaveProperty('source_run_id');
  });

  it('binds each signed report to an allowlisted primary or mirror project', async () => {
    expect(isValidMonitoringTarget(
      'https://eymlabowhfgtxbiqwxqh.supabase.co',
      'eymlabowhfgtxbiqwxqh',
      'eymlabowhfgtxbiqwxqh',
      'primary'
    )).toBe(true);
    expect(isValidMonitoringTarget(
      'https://fglggyfvzjdsbyckinqa.supabase.co',
      'fglggyfvzjdsbyckinqa',
      'fglggyfvzjdsbyckinqa',
      'mirror'
    )).toBe(true);
    expect(isValidMonitoringTarget(
      'https://fglggyfvzjdsbyckinqa.supabase.co',
      'fglggyfvzjdsbyckinqa',
      'fglggyfvzjdsbyckinqa',
      'primary'
    )).toBe(false);
  });
});

describe('resolveBackupAlert', () => {
  const base = {
    report_type: 'backup_completed',
    report_id: 'r',
    run_id: 'run-1',
    source_project: 'topik-prod',
    started_at: '2026-07-21T00:00:00Z',
    completed_at: '2026-07-21T00:10:00Z',
    status: 'succeeded',
    disk_used_percent: 57
  } as never;

  it('alerts on failed and partial backup completions', () => {
    expect(resolveBackupAlert({ ...(base as object), status: 'failed' } as never)?.subject).toContain('백업 실패');
    expect(resolveBackupAlert({ ...(base as object), status: 'partial_failure' } as never)?.subject).toContain('부분 실패');
  });

  it('alerts on failed restore drills', () => {
    const drill = {
      ...(base as object),
      report_type: 'restore_drill_completed',
      drill_id: 'd-1',
      status: 'failed'
    } as never;
    expect(resolveBackupAlert(drill)?.subject).toContain('드릴');
  });

  it('alerts on dangerous disk usage even when the run succeeded', () => {
    const alert = resolveBackupAlert({ ...(base as object), disk_used_percent: 91 } as never);
    expect(alert?.subject).toContain('디스크');
  });

  it('stays silent for healthy reports', () => {
    expect(resolveBackupAlert(base)).toBeNull();
    expect(resolveBackupAlert({ ...(base as object), report_type: 'backup_started', status: undefined } as never)).toBeNull();
  });
});
