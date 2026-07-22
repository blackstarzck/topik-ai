import { describe, expect, it } from 'vitest';

import { isBackupReportStale } from '../../api/notifications/dispatch-email';

describe('isBackupReportStale', () => {
  const now = new Date('2026-07-21T12:00:00Z');

  it('treats missing or unparsable timestamps as stale', () => {
    expect(isBackupReportStale(null, now, 26)).toBe(true);
    expect(isBackupReportStale('not-a-date', now, 26)).toBe(true);
  });

  it('stays fresh within the threshold window', () => {
    expect(isBackupReportStale('2026-07-21T06:00:00Z', now, 26)).toBe(false);
    expect(isBackupReportStale('2026-07-20T11:00:00Z', now, 26)).toBe(false);
  });

  it('alerts once the threshold is exceeded', () => {
    expect(isBackupReportStale('2026-07-20T09:59:00Z', now, 26)).toBe(true);
    expect(isBackupReportStale('2026-07-18T12:00:00Z', now, 26)).toBe(true);
  });
});
