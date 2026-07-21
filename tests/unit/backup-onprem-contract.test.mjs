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

  it('backs up database roles, schema, data, auth/storage data, and the dynamic storage root', () => {
    // supabase CLI 대신 버전 고정 컨테이너의 pg 도구를 직접 호출한다(SET ROLE postgres 회피).
    expect(script).toContain('pg_dumpall -d "${SUPABASE_DB_URL}" --roles-only --no-role-passwords');
    expect(script).toContain('pg_dump "${SUPABASE_DB_URL}" --schema-only');
    expect(script).toContain('pg_dump "${SUPABASE_DB_URL}" --data-only');
    expect(script).toContain('--pull never');
    // F1 재발 방지: 관리 스키마 제외로 빠지는 회원 인증·스토리지 메타를 별도 덤프로 강제한다.
    expect(script).toContain('pg_dump "${SUPABASE_DB_URL}" --data-only -n auth -n storage');
    expect(script).toContain('COPY "?auth"?\\."?users"? ');
    expect(script).toContain('COPY "?storage"?\\."?objects"? ');
    expect(script).toContain('rclone sync "${STORAGE_RCLONE_REMOTE}:"');
    expect(script).toContain('rclone size "${STORAGE_RCLONE_REMOTE}:"');
    expect(script).toContain('gzip -t');
    // zgrep -q는 systemd(IgnoreSIGPIPE) 아래에서 EPIPE 오탐을 내므로 금지한다.
    expect(script).not.toContain('zgrep -q');
    expect(script).toContain('grep -c "PostgreSQL database dump"');
  });

  it('prevents overlap, retains seven days, and performs an isolated restore check', () => {
    expect(script).toContain('flock -n 9');
    // 드릴은 백업 잠금을 공유 대기하고, flush는 별도 outbox 잠금을 쓴다.
    expect(script).toContain('flock -w 3600 9');
    expect(script).toContain('OUTBOX_LOCK_FILE');
    expect(script).toContain('--keep-within 7d --prune');
    expect(script).toContain('restic check --read-data');
    expect(script).toContain('.topik-backup-drill');
    expect(script).toContain('--single-transaction');
    expect(script).toContain('SET session_replication_role = replica');
    // 스택 이미지 기본 객체와의 충돌(publication/event trigger)을 복원 전에 정리한다.
    expect(script).toContain('prepare_drill_database');
    expect(script).toContain('DRILL_COMPOSE_PROJECT:-}" == topik-prod-backup-drill');
    expect(script).toContain('COMPOSE_PROJECT_NAME="${DRILL_COMPOSE_PROJECT}" sh run.sh start');
    expect(settings).toContain('DRILL_COMPOSE_PROJECT=topik-prod-backup-drill');
    // 55432는 기존 서비스가 점유하므로 드릴 기본 포트는 55433이다.
    expect(settings).toContain('@127.0.0.1:55433/postgres');
  });

  it('queues production and development-mirror reports independently', () => {
    expect(script).toContain('"${OUTBOX_DIR}/primary"');
    expect(script).toContain('"${OUTBOX_DIR}/mirror"');
    expect(script).toContain('queue_report_target "${payload}" "${report_id}" primary');
    expect(script).toContain('queue_report_target "${payload}" "${report_id}" mirror');
    expect(sender).toContain('"X-Backup-Destination": destination');
    expect(sender).toContain('+ destination.encode("ascii")');
  });

  it('keeps production read-only and the drill isolated per the current runbook', () => {
    expect(runbook).toContain('읽기만');
    expect(runbook).toContain('pg_read_all_data');
    expect(runbook).toContain('BYPASSRLS');
    expect(runbook).toContain('127.0.0.1');
    expect(runbook).toContain('55433');
    expect(runbook).toContain('COPY auth.users');
  });
});
