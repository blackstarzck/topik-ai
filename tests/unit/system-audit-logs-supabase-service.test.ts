import { describe, expect, it } from 'vitest';

import { mapSupabaseAuditLogRow } from '../../src/features/system/api/supabase-system-audit-logs-service';

describe('mapSupabaseAuditLogRow', () => {
  it('maps admin_list_audit_logs rows to the SystemAuditLogRow contract', () => {
    expect(
      mapSupabaseAuditLogRow({
        log_id: '00000000-0000-0000-0000-000000000001',
        target_type: 'Users',
        target_id: 'U00001',
        action: 'custom_admin_action',
        actor: 'Admin Kim',
        reason: 'policy violation',
        diff: { before: { status: 'active' }, after: { status: 'blocked' } },
        payload: { reason: 'policy violation' },
        created_at: '2026-06-17T10:12:13+09:00',
        total_count: 7
      })
    ).toEqual({
      logId: '00000000-0000-0000-0000-000000000001',
      targetType: 'Users',
      targetId: 'U00001',
      action: 'custom_admin_action',
      actor: 'Admin Kim',
      reason: 'policy violation',
      createdAt: '2026-06-17 10:12:13'
    });
  });

  it('normalizes nullable actor and reason values', () => {
    const row = mapSupabaseAuditLogRow({
      log_id: '00000000-0000-0000-0000-000000000002',
      target_type: 'System',
      target_id: 'SYS-001',
      action: 'unknown',
      actor: null,
      reason: null,
      diff: null,
      payload: null,
      created_at: '2026-06-17T01:02:03Z',
      total_count: 1
    });

    expect(row.actor).toBe('');
    expect(row.reason).toBe('');
    expect(row.createdAt).toBe('2026-06-17 01:02:03');
  });
});
