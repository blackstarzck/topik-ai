import fs from 'node:fs';

import { describe, expect, it } from 'vitest';

const script = fs.readFileSync('scripts/backup/topik-backup.sh', 'utf8');
const sender = fs.readFileSync('scripts/backup/send-report.py', 'utf8');
const settings = fs.readFileSync('scripts/backup/backup.env.example', 'utf8');
const runbook = fs.readFileSync('docs/runbooks/topik-prod-onprem-backup.md', 'utf8');
const backupTimer = fs.readFileSync('scripts/backup/systemd/topik-backup.timer', 'utf8');
const drillTimer = fs.readFileSync('scripts/backup/systemd/topik-backup-drill.timer', 'utf8');
const retryTimer = fs.readFileSync('scripts/backup/systemd/topik-backup-report-retry.timer', 'utf8');

describe('on-premise backup operating contract', () => {
  it('uses the fixed Korea schedules and catches up after a shutdown', () => {
    expect(backupTimer).toContain('OnCalendar=*-*-* 00,06,12,18:30:00 Asia/Seoul');
    expect(drillTimer).toContain('OnCalendar=Sun *-*-01..07 03:00:00 Asia/Seoul');
    expect(backupTimer).toContain('Persistent=true');
    expect(drillTimer).toContain('Persistent=true');
    expect(retryTimer).toContain('OnUnitActiveSec=5min');
  });

  it('backs up database roles, schema, data, and the dynamic storage root', () => {
    expect(script).toContain('--role-only');
    expect(script).toContain('--use-copy --data-only');
    expect(script).toContain('schema.sql');
    expect(script).toContain('rclone sync "${STORAGE_RCLONE_REMOTE}:"');
    expect(script).toContain('rclone size "${STORAGE_RCLONE_REMOTE}:"');
    expect(script).toContain('gzip -t');
    expect(script).toContain('zgrep -q "PostgreSQL database dump"');
  });

  it('prevents overlap, retains seven days, and performs an isolated restore check', () => {
    expect(script).toContain('flock -n 9');
    expect(script).toContain('--keep-within 7d --prune');
    expect(script).toContain('restic check --read-data');
    expect(script).toContain('.topik-backup-drill');
    expect(script).toContain('--single-transaction');
    expect(script).toContain('SET session_replication_role = replica');
    expect(script).toContain('DRILL_COMPOSE_PROJECT:-}" == topik-prod-backup-drill');
    expect(script).toContain('COMPOSE_PROJECT_NAME="${DRILL_COMPOSE_PROJECT}" sh run.sh start');
    expect(settings).toContain('DRILL_COMPOSE_PROJECT=topik-prod-backup-drill');
    expect(settings).toContain('@127.0.0.1:55432/postgres');
  });

  it('queues production and development-mirror reports independently', () => {
    expect(script).toContain('"${OUTBOX_DIR}/primary"');
    expect(script).toContain('"${OUTBOX_DIR}/mirror"');
    expect(script).toContain('queue_report_target "${payload}" "${report_id}" primary');
    expect(script).toContain('queue_report_target "${payload}" "${report_id}" mirror');
    expect(sender).toContain('"X-Backup-Destination": destination');
    expect(sender).toContain('+ destination.encode("ascii")');
  });

  it('keeps the existing AI stack and the TOPIK backup stack operationally separate', () => {
    expect(runbook).toContain('기존 AI 운영 환경과 분리');
    expect(runbook).toContain('`topik-ai`의 컨테이너·볼륨·예약 작업을 중지하거나 초기화하지 않습니다.');
    expect(runbook).toContain('127.0.0.1');
    expect(runbook).toContain('topik-prod-backup-drill');
    expect(runbook).toContain('외부 사본 전송 기능은 TOPIK 백업에 사용하지 않습니다.');
  });
});
