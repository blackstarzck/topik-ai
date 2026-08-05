import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';
import { describe, expect, it } from 'vitest';

/**
 * SQL 계약 테스트. 여기서 고정하는 것은 "이 줄이 사라지면 조용히 위험해지는" 성질이다.
 *
 * 🚨 주석을 먼저 걷어낸다 — 이 마이그는 헤더에서 `user_notifications` 를 쓰지 않는 이유를
 * 길게 설명하므로 원문 검사는 그 설명에 걸린다(같은 실수를 PR-B 에서 4번 했다).
 * 줄 주석 제거는 공백 정규화 **전에** 해야 한다(개행을 먼저 없애면 `--` 가 끝까지 먹는다).
 */
const MIGRATION = '20260805110000_admin_contract_expiry_notifications.sql';

const stripComments = (text) => text
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/--[^\r\n]*/g, ' ');
const normalize = (text) => stripComments(text).replace(/\s+/g, ' ').toLowerCase();

const up = normalize(
  readFileSync(join(cwd(), 'supabase', 'migrations-admin', MIGRATION), 'utf8')
);
const down = normalize(
  readFileSync(join(cwd(), 'supabase', 'migrations-admin', 'down', MIGRATION), 'utf8')
);

const manifests = {
  development: JSON.parse(readFileSync(
    join(cwd(), 'scripts', 'db', 'manifests', 'admin-development-reconciliation.json'), 'utf8'
  )),
  production: JSON.parse(readFileSync(
    join(cwd(), 'scripts', 'db', 'manifests', 'admin-production-cutover.json'), 'utf8'
  ))
};

describe('관리자 알림 원장', () => {
  it('학습자 알림함(v13 공유 객체)에 쓰지 않는다', () => {
    // user_notifications 는 v13 공유 객체다. 관리 도메인 알림을 넣으면 학습자 앱
    // 알림함에 관리 문구가 노출되고 남의 소유 테이블을 오염시킨다.
    expect(up).not.toContain('insert into public.user_notifications');
    expect(up).toContain('insert into public.admin_notifications');
    expect(up).toContain('contract_expiry_must_not_write_learner_notifications');
  });

  it('수신자 FK 는 admin_accounts 다', () => {
    expect(up).toContain(
      'recipient_admin_id uuid not null references public.admin_accounts(id) on delete cascade'
    );
  });

  it('영구 dedup 을 unique 제약으로 강제한다', () => {
    // tick 이 10분마다 도므로 이것이 없으면 같은 마일스톤이 하루 144번 쌓인다.
    expect(up).toContain(
      'constraint admin_notifications_event_unique unique (recipient_admin_id, event_key)'
    );
    expect(up).toContain('on conflict (recipient_admin_id, event_key) do nothing');
    expect(up).toContain('admin_notifications_dedup_constraint_missing');
  });

  it('본인 행만 읽도록 RLS 와 RPC 양쪽에서 좁힌다', () => {
    expect(up).toContain('using (recipient_admin_id = (select auth.uid()))');
    // definer 는 RLS 를 우회하므로 함수 본문에서도 좁혀야 한다.
    expect(up).toContain('where n.recipient_admin_id = caller_id');
  });

  it('목록 정렬에 tie-break 가 있다', () => {
    // 한 tick 의 적재는 단일 INSERT 라 created_at 이 전부 같다 → tie-break 없이는
    // 목록 순서가 조회마다 흔들리고 limit 경계에서 행이 누락·중복된다.
    expect(up).toContain('order by n.created_at desc, n.id');
  });
});

describe('만료 임박 적재', () => {
  it('버킷을 겹치지 않게 자른다', () => {
    // 단순히 `days_left <= 30` 이면 5일 남은 계약에도 D-30 문구가 나간다.
    expect(up).toContain("when (c.ends_on - v_today) <= 0 then 'expired'");
    expect(up).toContain("when (c.ends_on - v_today) <= 7 then 'd7'");
    expect(up).toContain("else 'd30'");
    expect(up).toContain('contract_expiry_bucket_labels_missing');
  });

  it('무기한·시작 전 계약을 제외한다', () => {
    expect(up).toContain('c.ends_on is not null');
    expect(up).toContain('c.starts_on <= v_today');
  });

  it('수신자를 profiles.app_role 로 판정하고 정지 계정을 제외한다', () => {
    // RBAC SoT 는 profiles.app_role 이다(admin_accounts.role 이 아니다).
    expect(up).toContain("p.app_role = 'platform_admin'");
    expect(up).toContain("not in ('suspended', 'revoked')");
  });

  it('계약 원장이 없으면 fail-open 한다', () => {
    // 계약 원장은 topik_writing 폴더 소유라 적용 순서가 보장되지 않는다.
    expect(up).toContain("to_regclass('public.topik_writing_institution_contracts') is null");
  });
});

describe('cron tick 배선', () => {
  it('신규 cron 을 만들지 않고 기존 tick 에 키를 더한다', () => {
    expect(up).not.toContain('cron.schedule');
    expect(up).toContain("'contract_expiry', private.enqueue_contract_expiry_notifications()");
    expect(up).toContain('contract_expiry_not_wired_into_tick');
  });

  it('기존 tick 키를 하나도 잃지 않는다', () => {
    // 되덮기 사고 방지 — 이 함수는 20260723011242 가 만든 것을 재정의한다.
    for (const key of [
      "'study_reminder', private.dispatch_scheduled_notifications('study_reminder', 'in_app')",
      "'admin', private.dispatch_admin_notifications()",
      "'email_retry', private.retry_failed_email_attempts()"
    ]) {
      expect(up).toContain(key);
    }
    expect(up).toContain('dispatch_notifications_lost_existing_keys');
  });

  it('down 은 키만 빼고 나머지 tick 을 유지하며 알림 원장을 남긴다', () => {
    // 🚨 down 파일 전체에는 `enqueue_contract_expiry_notifications` 가 정당하게 등장한다
    // (drop 대상이고, 사후 단정이 그 함수가 사라졌는지 확인한다). 따라서 **tick 본문으로
    // 좁혀서** 호출이 빠졌는지 검사해야 한다 — 파일 전체 검사는 오탐이다.
    const tickStart = down.indexOf('create or replace function private.dispatch_notifications');
    const tickEnd = down.indexOf('drop function if exists', tickStart);
    expect(tickStart).toBeGreaterThanOrEqual(0);
    expect(tickEnd).toBeGreaterThan(tickStart);
    const tickBody = down.slice(tickStart, tickEnd);

    expect(tickBody).not.toContain('enqueue_contract_expiry_notifications');
    expect(tickBody).toContain("'admin', private.dispatch_admin_notifications()");
    expect(tickBody).toContain("'email_retry', private.retry_failed_email_attempts()");

    // 원장 테이블은 남긴다(받은 알림·읽음 기록 보존, down→up 재적용 안전).
    expect(down).not.toContain('drop table');
    expect(down).toContain('dispatch_notifications_lost_existing_keys');
  });
});

describe('manifest lockstep', () => {
  it.each([['development'], ['production']])(
    '%s 은 파일 수와 일치하고 알림 배치를 등재한다',
    (env) => {
    const manifest = manifests[env];
    // 상수를 박지 않는다 — 마이그가 추가될 때마다 무관한 테스트가 깨진다.
    const fileCount = readdirSync(join(cwd(), 'supabase', 'migrations-admin'))
      .filter((name) => name.endsWith('.sql')).length;
    expect(manifest.expectedLocalCount).toBe(fileCount);
    expect(manifest.batches['release-all'].to).toBe(MIGRATION);
    expect(manifest.batches['baseline-all'].to).toBe(MIGRATION);

    const batch = manifest.batches['admin-contract-expiry-notifications'];
    expect(batch.migrations).toEqual([MIGRATION]);
    expect(batch.reason).toMatch(/[가-힣]/);
    expect(batch.expectPresentAfter).toEqual(
      expect.arrayContaining([
        { kind: 'table', identity: 'public.admin_notifications' },
        { kind: 'function', identity: 'private.enqueue_contract_expiry_notifications()' },
        { kind: 'function', identity: 'private.dispatch_notifications()' }
      ])
    );
  });
});
