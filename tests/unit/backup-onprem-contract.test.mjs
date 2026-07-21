import fs from 'node:fs';

import { describe, expect, it } from 'vitest';

const script = fs.readFileSync('scripts/backup/topik-backup.sh', 'utf8');
const sender = fs.readFileSync('scripts/backup/send-report.py', 'utf8');
const settings = fs.readFileSync('scripts/backup/backup.env.example', 'utf8');
const runbook = fs.readFileSync('docs/runbooks/topik-prod-onprem-backup.md', 'utf8');
const compose = fs.readFileSync('scripts/backup/drill-stack/docker-compose.yml', 'utf8');
const backupTimer = fs.readFileSync('scripts/backup/systemd-user/topik-backup.timer', 'utf8');
const drillTimer = fs.readFileSync('scripts/backup/systemd-user/topik-backup-drill.timer', 'utf8');
const retryTimer = fs.readFileSync('scripts/backup/systemd-user/topik-backup-report-retry.timer', 'utf8');

describe('on-premise backup operating contract', () => {
  it('uses the fixed Korea schedules and catches up after a shutdown', () => {
    expect(backupTimer).toContain('OnCalendar=*-*-* 00,06,12,18:30:00');
    expect(drillTimer).toContain('OnCalendar=Sun *-*-01..07 03:00:00');
    expect(backupTimer).toContain('Persistent=true');
    expect(drillTimer).toContain('Persistent=true');
    expect(retryTimer).toContain('OnCalendar=*:0/5');
  });

  it('backs up roles, application data, auth data, and storage objects', () => {
    expect(script).toContain('--roles-only --no-role-passwords');
    expect(script).toContain('--schema-only');
    expect(script).toContain('--data-only -n auth -n storage');
    expect(script).toContain('public.profiles COPY missing from dump');
    expect(script).toContain('auth.users COPY missing from dump');
    expect(script).toContain('storage.objects COPY missing from dump');
    expect(script).toContain('rclone sync "${STORAGE_RCLONE_REMOTE}:"');
    expect(script).toContain('gzip -t');
    expect(script).toContain('zgrep -q "PostgreSQL database dump"');
  });

  it('uses a read-only production role and a loopback-only restore drill', () => {
    expect(runbook).toContain('전용 롤 `topik_backup`');
    expect(runbook).toContain('pg_read_all_data');
    expect(runbook).toContain('쓰기 권한이 없다');
    expect(script).toContain('DRILL_COMPOSE_PROJECT:-}" == topik-prod-backup-drill');
    expect(script).toContain('@127.0.0.1:');
    expect(script).toContain('prepare_drill_database');
    expect(settings).toContain('DRILL_COMPOSE_PROJECT=topik-prod-backup-drill');
    expect(settings).toContain('@127.0.0.1:55433/postgres');
  });

  it('pins restore images and points reports at the admin production domain', () => {
    expect(compose).toContain('supabase/gotrue:v2.193.1');
    expect(compose).toContain(
      'supabase/storage-api@sha256:32ef6705783ee2289f38a55845c346c78c29fb26a9e02d0abebdd7e6ae88697a'
    );
    expect(settings).toContain('REPORT_URL=https://topik-admin.vercel.app/api/backups/report');
  });

  it('prevents overlap, bounds external work, and retains seven days', () => {
    expect(script).toContain('flock -n 9');
    expect(script).toContain('flock -w 3600 9');
    expect(script).toContain('timeout --kill-after=30');
    expect(script).toContain('--keep-within 7d --prune');
    expect(script).toContain('restic check --read-data');
  });

  it('queues production and development-mirror reports independently', () => {
    expect(script).toContain('"${OUTBOX_DIR}/primary"');
    expect(script).toContain('"${OUTBOX_DIR}/mirror"');
    expect(script).toContain('queue_report_target "${payload}" "${report_id}" primary');
    expect(script).toContain('queue_report_target "${payload}" "${report_id}" mirror');
    expect(sender).toContain('"X-Backup-Destination": destination');
    expect(sender).toContain('+ destination.encode("ascii")');
  });
});
