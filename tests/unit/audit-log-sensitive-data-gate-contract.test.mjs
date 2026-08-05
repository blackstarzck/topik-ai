import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';
import { describe, expect, it } from 'vitest';

/**
 * 감사 로그 민감정보 보호 복원(20260805160000)의 SQL 계약 테스트.
 *
 * 🚨 이 파일은 "이 함수를 정의하는 모든 마이그가 게이트를 포함해야 한다" 식의 전수 스캔을
 * 쓰지 않는다. 게이트를 드롭한 두 파일(20260623230000 · 20260720104000)이 이미 적용된
 * 불변 이력이라 그런 단정은 영구 실패한다. 최종 상태 검증은 shadow 재생 + dev 행동 프로브가
 * 담당하고, 여기서는 이 마이그 자체의 계약만 고정한다.
 *
 * 주석을 먼저 걷어낸다(줄 주석 제거가 공백 정규화보다 먼저) — 이 파일 헤더가 결함을 길게
 * 설명하므로 원문 검사는 그 설명에 걸린다.
 */
const MIGRATION = '20260805160000_audit_logs_sensitive_data_gate_restore.sql';

const stripComments = (text) => text
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/--[^\r\n]*/g, ' ');
const normalize = (text) => stripComments(text).replace(/\s+/g, ' ').toLowerCase();

const upRaw = readFileSync(join(cwd(), 'supabase', 'migrations-admin', MIGRATION), 'utf8');
const downRaw = readFileSync(
  join(cwd(), 'supabase', 'migrations-admin', 'down', MIGRATION), 'utf8'
);
const up = normalize(upRaw);
const down = normalize(downRaw);

const manifests = {
  development: JSON.parse(readFileSync(
    join(cwd(), 'scripts', 'db', 'manifests', 'admin-development-reconciliation.json'), 'utf8'
  )),
  production: JSON.parse(readFileSync(
    join(cwd(), 'scripts', 'db', 'manifests', 'admin-production-cutover.json'), 'utf8'
  ))
};

describe('조회 RPC 게이트 복원', () => {
  it('platform_admin 판정을 선언·대입한다', () => {
    expect(up).toContain('v_is_platform boolean;');
    expect(up).toContain('v_is_platform := private.is_platform_admin(caller_id);');
    expect(up).toContain("to_regprocedure('private.is_platform_admin(uuid)') is null");
  });

  it('diff·payload 를 마스킹하고 payload 키워드 검색을 조건부로 만든다', () => {
    expect(up).toContain('case when v_is_platform then counted.diff else null end');
    expect(up).toContain('case when v_is_platform then counted.payload else null end');
    expect(up).toContain("(v_is_platform and l.payload::text ilike '%' || v_keyword || '%')");
  });

  it('reason 은 계속 전체 관리자에게 노출한다(2026-06-18 결정 유지)', () => {
    // payload->>'reason' 은 마스킹 대상이 아니다. 마스킹으로 감싸면 사유가 사라진다.
    expect(up).not.toContain("case when v_is_platform then counted.payload ->> 'reason'");
  });

  it('전문 재정의가 아니라 라이브 정의 수술이며 이후 계약을 보존한다', () => {
    expect(up).not.toContain('create or replace function');
    expect(up).toContain('pg_get_functiondef');
    expect(up).toContain('execute v_definition');
    // User/Users projection 과 admin_accounts actor 조인은 이 수술을 통과해야 한다.
    // 🚨 마이그 안에서는 SQL 문자열 리터럴이라 홑따옴표가 두 번씩('' ) 이스케이프돼 있다 —
    // 따옴표까지 포함해 단정하면 실패한다(red 로 확인).
    expect(up).toContain('lower(counted.target_table) in (');
    expect(up).toContain('left join public.admin_accounts a on a.id = l.admin_user_id');
    expect(up).toContain('projection/actor contract lost during rewrite');
  });

  it('앵커는 존재가 아니라 발생 횟수를 단정한 뒤 치환한다', () => {
    expect(up).toContain('must occur exactly once');
    expect(up).toContain('already carries the platform gate');
  });
});

describe('원본 테이블 표면', () => {
  it('직접 조회를 platform_admin 전용으로 좁힌다', () => {
    // RPC 만 고치면 테이블로 우회된다 — 두 표면은 독립된 게이트다.
    expect(up).toContain('drop policy if exists admin_audit_logs_admin_select on public.admin_audit_logs');
    expect(up).toContain('create policy admin_audit_logs_platform_select on public.admin_audit_logs');
    expect(up).toContain('using (private.is_platform_admin((select auth.uid())))');
  });

  it('위조 가능한 직접 INSERT 정책을 없앤다', () => {
    expect(up).toContain('drop policy if exists admin_audit_logs_admin_insert on public.admin_audit_logs');
    // 대체 쓰기 정책을 만들지 않는다 — 감사 기록은 definer RPC 단일 경로다.
    expect(up).not.toContain('for insert to authenticated');
  });

  it('정책 축소가 쓰기 경로를 깨지 않는지 사후 단정한다', () => {
    expect(up).toContain('not pr.prosecdef or not r.rolbypassrls');
    expect(up).toContain('closing the table would break it');
  });

  it('사후 검증이 조회 정책 1개·쓰기 정책 0개를 확정한다', () => {
    expect(up).toContain('expected exactly one select policy on admin_audit_logs');
    expect(up).toContain('a direct write policy still exists on admin_audit_logs');
  });
});

describe('expand 계약과 down', () => {
  it('금지된 수축 연산을 쓰지 않는다', () => {
    // drop policy 는 expand 게이트 금지 목록에 없다. drop function/table 은 금지다.
    for (const banned of ['drop function', 'drop table', 'drop column', 'drop type', 'truncate']) {
      expect(up).not.toContain(banned);
      expect(down).not.toContain(banned);
    }
  });

  it('down 이 두 표면을 모두 원복하고 완화임을 명시한다', () => {
    expect(down).toContain('create policy admin_audit_logs_admin_select on public.admin_audit_logs');
    expect(down).toContain('create policy admin_audit_logs_admin_insert on public.admin_audit_logs');
    // normalize 가 소문자화하므로 기대값도 소문자로 둔다.
    expect(down).toContain('platform gate survived in the read rpc');
    expect(down).toContain('original insert policy was not restored');
    // 보안 완화라는 경고가 헤더에 남아 있어야 한다(주석이므로 원문에서 확인).
    expect(downRaw).toContain('보안 완화');
  });
});

describe('shadow 재생 검증 배선', () => {
  // 최종 상태 검증은 전체 재생 후 확인해야 한다. 파일 단위 스캔으로는 못 잡는다 —
  // 게이트를 드롭한 두 재정의가 이미 불변 이력이라 그런 단정은 영구 실패한다.
  const shadow = readFileSync(join(cwd(), 'scripts', 'ci', 'run-shadow-contract.mjs'), 'utf8');

  it('재생 후 최종 정의와 정책 상태를 단정하는 검증이 있다', () => {
    expect(shadow).toContain('function verifyAuditSensitiveDataGate(');
    expect(shadow).toContain('v_is_platform := private.is_platform_admin(caller_id);');
    expect(shadow).toContain('(v_is_platform and l.payload::text ilike');
    expect(shadow).toContain('raw table select is not platform_admin scoped after replay');
    expect(shadow).toContain('a direct write policy on admin_audit_logs survived replay');
  });

  it('그 검증이 실제로 호출된다', () => {
    // 함수만 있고 호출되지 않으면 가드가 아니다(게이트 통과 ≠ 검사가 돌았다).
    expect(shadow).toContain('verifyAuditSensitiveDataGate(dbContainer);');
  });
});

describe('manifest lockstep', () => {
  it.each([['development'], ['production']])(
    '%s 은 파일 수와 일치하고 감사 게이트 배치를 등재한다',
    (env) => {
      const manifest = manifests[env];
      // 상수를 박지 않는다 — 마이그가 추가될 때마다 무관한 테스트가 깨진다.
      const fileCount = readdirSync(join(cwd(), 'supabase', 'migrations-admin'))
        .filter((name) => name.endsWith('.sql')).length;
      expect(manifest.expectedLocalCount).toBe(fileCount);
      expect(manifest.batches['release-all'].from <= MIGRATION).toBe(true);
      expect(manifest.batches['release-all'].to >= MIGRATION).toBe(true);
      expect(manifest.batches['baseline-all'].from <= MIGRATION).toBe(true);
      expect(manifest.batches['baseline-all'].to >= MIGRATION).toBe(true);

      const batch = manifest.batches['audit-log-sensitive-data-gate'];
      expect(batch.migrations).toEqual([MIGRATION]);
      expect(batch.reason).toMatch(/[가-힣]/);
      expect(batch.expectPresentAfter).toEqual(
        expect.arrayContaining([
          {
            kind: 'function',
            identity:
              'public.admin_list_audit_logs(text,text,text,timestamptz,timestamptz,integer,integer)'
          }
        ])
      );
    }
  );
});
