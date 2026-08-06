import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';
import { describe, expect, it } from 'vitest';

/**
 * 2단계 2A — 시스템·회원 권한 정렬의 SQL 계약을 고정한다.
 *
 * 이 테스트가 검사하는 것은 "라이브가 정렬됐는가"가 아니다(그건 마이그레이션의 사후
 * 검증 do-block 과 db:permission-gate-parity 가 라이브에서 판정한다). 여기서는 파일이
 * 라이브를 어떻게 고치겠다고 선언했는지 — 강제 형태·PII 계약·앵커 규율·manifest 배선 —
 * 를 고정해 이후 편집이 계약을 조용히 바꾸지 못하게 한다.
 */
const FORWARD = 'supabase/migrations-admin/20260806120000_admin_permission_alignment_system_users.sql';
const DOWN = 'supabase/migrations-admin/down/20260806120000_admin_permission_alignment_system_users.sql';

const forward = readFileSync(join(cwd(), FORWARD), 'utf8');
const down = readFileSync(join(cwd(), DOWN), 'utf8');

// 주석에도 같은 낱말이 등장하므로 부재·개수 단정은 실행 코드에서만 센다.
const executable = (sql) => sql
  .split(/\r?\n/)
  .filter((line) => !line.trimStart().startsWith('--'))
  .join('\n');

const forwardCode = executable(forward);
const downCode = executable(down);

describe('강제 형태 — 역할 + 권한 키 2겹', () => {
  it('스키마를 public.admin_has_permission 으로 한정한다', () => {
    // private.admin_has_permission 오기는 2026-08-03 운영에서 노출 모드 쓰기 경로를
    // 42883 으로 죽였다. 같은 실수를 파일 단계에서 막는다.
    expect(forwardCode).toContain('public.admin_has_permission(uuid,text)');
    expect(forwardCode).not.toMatch(/private\.admin_has_permission/);
    expect(downCode).not.toMatch(/private\.admin_has_permission/);
  });

  it('역할 검사를 지우지 않고 그 뒤에 키 검사를 덧붙인다', () => {
    // platform 전용을 전환할 때도 is_admin 으로 낮추고 키를 얹는다 — 키만 남기면
    // org_admin 이 grant 하나로 콘솔 표면에 닿는다.
    expect(forwardCode).toContain("v_role_block || format(");
    expect(forwardCode).toMatch(/'platform'\s+then/);
  });

  it('사후 검증이 역할 검사 생존과 anon 실행 권한 부재를 함께 단정한다', () => {
    expect(forwardCode).toContain('lost its role check');
    expect(forwardCode).toContain("has_function_privilege('anon'");
  });

  it('platform 단독 게이트가 살아남지 않았는지 확인한다', () => {
    expect(forwardCode).toContain('platform-only guard survived');
  });
});

describe('회원 PII 화이트리스트', () => {
  it('원문 열람 조건을 platform 또는 users.export 로 정의한다', () => {
    expect(forwardCode).toContain('v_pii boolean := private.is_platform_admin(caller_id)');
    expect(forwardCode).toContain("public.admin_has_permission(caller_id, \\'users.export\\')");
  });

  it('원문 이메일과 원문 전화를 모두 가린다', () => {
    expect(forwardCode).toContain('case when v_pii then u.email::text else null::text end as email,');
    expect(forwardCode).toContain(
      'case when v_pii then private.admin_profile_phone(to_jsonb(p)) else null::text end as phone,'
    );
  });

  it('이메일 검색 분기도 같은 조건으로 닫는다', () => {
    // 반환값만 NULL 로 만들면 검색으로 이메일 존재 여부를 역추적할 수 있다.
    expect(forwardCode).toContain('v_pii and u.email ilike');
    expect(forwardCode).toContain('email search gate missing in get_admin_users');
  });

  it('목록 키 검사가 users.export 를 함의한다', () => {
    // admin_export_users 가 get_admin_users 를 내부 호출한다 — 함의가 없으면
    // users.export 단독 보유자가 자기 표면 안에서 막힌다.
    expect(forwardCode).toContain("or public.admin_has_permission(caller_id, \\'users.export\\')) then");
  });
});

describe('감사 로그 계약 보존', () => {
  it('platform 마스킹 계약을 사전·사후로 단정한다', () => {
    const literal = 'v_is_platform := private.is_platform_admin(caller_id);';
    expect(forwardCode).toContain(literal);
    expect(forwardCode).toContain('audit masking contract lost');
    // 원복도 마스킹을 휩쓸지 않는지 확인한다.
    expect(downCode).toContain('audit masking contract lost');
  });

  it('마스킹 투영이 정확히 2곳임을 세어 확인한다', () => {
    expect(forwardCode).toContain("'case when v_is_platform then counted.'");
  });
});

describe('정책 표면 — 교체와 삭제', () => {
  it('역할 정책을 남기지 않고 교체한다', () => {
    // RLS 는 permissive-OR 이므로 기존 정책을 남긴 채 키 정책을 추가하면
    // 아무것도 좁혀지지 않는다.
    for (const table of ['system_logs', 'system_metadata_groups', 'system_metadata_group_items']) {
      expect(forwardCode).toContain(`drop policy if exists ${table}_admin_select on public.${table};`);
      expect(forwardCode).toContain(`create policy ${table}_permission_select on public.${table}`);
    }
  });

  it('직접 조회를 닫는 11테이블을 모두 삭제 대상으로 둔다', () => {
    const closed = [
      'admin_accounts', 'admin_permission_grants', 'instructors', 'instructor_admin_notes',
      'referrals', 'referral_relations', 'referral_reward_ledgers', 'user_access_logs',
      'user_activity_events', 'user_payment_records', 'user_admin_memos'
    ];
    for (const table of closed) {
      expect(forwardCode).toContain(`drop policy if exists ${table}_admin_select on public.${table};`);
    }
    expect(closed).toHaveLength(11);
  });

  it('사후 검증이 삭제 테이블의 정책 0개를 단정한다', () => {
    expect(forwardCode).toContain('direct read must be closed');
  });

  it('down 이 삭제한 정책을 되살린다', () => {
    for (const table of ['admin_accounts', 'user_admin_memos', 'referral_relations']) {
      expect(downCode).toContain(`create policy ${table}_admin_select on public.${table}`);
    }
  });
});

describe('앵커 규율', () => {
  it('앵커 발생 횟수를 정확히 1회로 단정한다', () => {
    // 0회면 라이브가 예상과 다르고, 2회 이상이면 어느 쪽을 고치는지 정의되지 않는다.
    expect(forwardCode).toContain('must occur exactly once in');
    expect(downCode).toContain('must occur exactly once in');
  });

  it('이미 키가 있으면 재실행이 아니라 중단한다', () => {
    expect(forwardCode).toContain('already carries a permission key');
  });

  it('전문 재정의를 쓰지 않는다', () => {
    // create or replace 를 파일에 직접 쓰면 이후 수술 계약을 되덮는다.
    expect(forwardCode).toMatch(/pg_get_functiondef/);
    expect(forwardCode).not.toMatch(/create\s+or\s+replace\s+function/i);
    expect(downCode).not.toMatch(/create\s+or\s+replace\s+function/i);
  });

  it('drop function 을 쓰지 않는다', () => {
    // 확장 전용 게이트가 차단한다(기존 시그니처 변경 불가).
    expect(forwardCode).not.toMatch(/drop\s+function/i);
    expect(downCode).not.toMatch(/drop\s+function/i);
  });

  it('down 이 대상 20종을 forward 와 같은 집합으로 되돌린다', () => {
    const identities = (sql) => [...sql.matchAll(/'identity',\s*'([^']+)'/g)].map((m) => m[1]).sort();
    const forwardIds = identities(forwardCode);
    expect(forwardIds).toHaveLength(20);
    expect(identities(downCode)).toEqual(forwardIds);
  });
});

describe('manifest 배선', () => {
  const manifests = ['admin-development-reconciliation', 'admin-production-cutover'].map((name) => ({
    name,
    data: JSON.parse(readFileSync(join(cwd(), 'scripts', 'db', 'manifests', `${name}.json`), 'utf8'))
  }));

  it('expectedLocalCount 가 실제 forward 파일 수와 같다', () => {
    // 상수로 박아두면 파일이 늘 때마다 무관한 실패가 난다 — 파일 수와 비교한다.
    const { readdirSync } = require('node:fs');
    const files = readdirSync(join(cwd(), 'supabase', 'migrations-admin'))
      .filter((name) => /^\d{14}_[a-z0-9_]+\.sql$/.test(name));
    for (const { name, data } of manifests) {
      expect(data.expectedLocalCount, name).toBe(files.length);
    }
  });

  it('운영 cutover 배치가 이 마이그를 등재하고 정책 부재까지 기대한다', () => {
    const batch = manifests.find((m) => m.name === 'admin-production-cutover')
      .data.batches['permission-alignment-system-users'];
    expect(batch).toBeDefined();
    expect(batch.migrations).toEqual(['20260806120000_admin_permission_alignment_system_users.sql']);
    const absent = batch.expectAbsent.map((entry) => entry.identity);
    expect(absent).toContain('public.admin_accounts.admin_accounts_admin_select');
    expect(absent).toContain('public.system_logs.system_logs_admin_select');
    const present = batch.expectPresentAfter.map((entry) => entry.identity);
    expect(present).toContain('public.system_logs.system_logs_permission_select');
    expect(present).toContain('public.admin_has_permission(uuid,text)');
  });
});
