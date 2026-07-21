import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const migrationPath = path.resolve(
  'supabase/migrations-admin/20260720150000_admin_backup_monitoring.sql'
);
const sql = fs.readFileSync(migrationPath, 'utf8');
const readFixPath = path.resolve(
  'supabase/migrations-admin/20260720150100_admin_backup_read_rpc_qualification.sql'
);
const readFixDownPath = path.resolve(
  'supabase/migrations-admin/down/20260720150100_admin_backup_read_rpc_qualification.sql'
);
const readFixSql = fs.readFileSync(readFixPath, 'utf8');
const mirrorSummaryPath = path.resolve(
  'supabase/migrations-admin/20260720150200_admin_backup_mirror_summary.sql'
);
const mirrorSummaryDownPath = path.resolve(
  'supabase/migrations-admin/down/20260720150200_admin_backup_mirror_summary.sql'
);
const mirrorSummarySql = fs.readFileSync(mirrorSummaryPath, 'utf8');

describe('admin backup monitoring migration contract', () => {
  it('forces row security and blocks authenticated direct table reads', () => {
    for (const table of [
      'admin_backup_runs',
      'admin_backup_component_results',
      'admin_restore_drills',
      'admin_backup_report_events'
    ]) {
      expect(sql).toContain(`alter table public.${table} force row level security`);
      expect(sql).toContain(`revoke all on table public.${table} from public, anon, authenticated`);
    }
  });

  it('keeps the write RPC service-role only and the detail RPC permission-gated', () => {
    expect(sql).toContain(
      'revoke all on function public.record_admin_backup_report(jsonb, text) from public, anon, authenticated'
    );
    expect(sql).toContain(
      'grant execute on function public.record_admin_backup_report(jsonb, text) to service_role'
    );
    expect(sql).toContain("admin_has_permission(caller_id, 'system.backups.read')");
  });

  it('writes automatic completions only to system logs and enforces metadata retention', () => {
    expect(sql).toContain("'backup-service'");
    expect(sql).not.toContain('insert into public.admin_audit_logs');
    expect(sql).toContain("now() - interval '90 days'");
    expect(sql).toContain("now() - interval '13 months'");
  });

  it('qualifies component result columns in the detail RPC and keeps a paired rollback', () => {
    expect(readFixSql).toContain('select candidate.*');
    expect(readFixSql).toContain('candidate.database_status');
    expect(readFixSql).toContain('candidate.storage_status');
    expect(fs.existsSync(readFixDownPath)).toBe(true);
  });

  it('adds the latest metadata delivery time to the summary with a paired rollback', () => {
    expect(mirrorSummarySql).toContain('last_report_received_at');
    expect(mirrorSummarySql).toContain('max(e.received_at)');
    expect(fs.existsSync(mirrorSummaryDownPath)).toBe(true);
  });
});
