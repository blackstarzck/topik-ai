import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';
import { describe, expect, it } from 'vitest';

import { findOutOfOrderApplyBlockers } from '../../scripts/db/migrate-core.mjs';
import {
  diffGates,
  parseDeclaredGates,
  resolveExpectedGates
} from '../../scripts/db/verify-permission-gate-parity.mjs';

/**
 * 2026-08-06 dev 감사: 관리자 RPC 47개가 권한 키 없이 역할 검사만으로 돌고 있었다.
 * 파일과 운영은 처음부터 옳았다 — 20260617211000 이 대기 중인 동안 20260623283000
 * 블록이 먼저 적용되고, 뒤늦게 그 오래된 파일이 실행되면서 CREATE OR REPLACE 본문이
 * 새 정의를 덮어 게이트를 지웠다. 아무것도 실패하지 않았고, 클린 재생은 정상 상태를
 * 만들기 때문에 shadow 계약으로는 영원히 볼 수 없었다.
 *
 * 그래서 두 가지가 필요하다: 역순 forward 적용을 막는 러너 가드(뿌리),
 * 그리고 "파일이 요구하는 게이트가 라이브에 있는가"를 환경마다 재단정하는 검사(탐지).
 */
describe('정순 적용 가드', () => {
  const applied = [
    '20260623283000_phase8_system_metadata.sql',
    '20260805130000_admin_analytics_read_permission.sql'
  ];

  it('적용하려는 파일보다 나중에 이미 적용된 파일을 찾아낸다', () => {
    expect(
      findOutOfOrderApplyBlockers({
        migrationName: '20260617211000_system_metadata.sql',
        appliedNames: applied
      })
    ).toEqual(applied);
  });

  it('최신 파일을 적용할 때는 걸리지 않는다', () => {
    expect(
      findOutOfOrderApplyBlockers({
        migrationName: '20260806100000_next.sql',
        appliedNames: applied
      })
    ).toEqual([]);
  });

  it('러너가 이 검사를 apply 경로에 배선하고 override 를 명시 플래그로만 허용한다', () => {
    // 함수만 있고 호출되지 않으면 가드가 아니다(게이트 통과 ≠ 검사가 돌았다).
    const source = readFileSync(join(cwd(), 'scripts', 'db', 'migrate-core.mjs'), 'utf8');
    expect(source).toContain('findOutOfOrderApplyBlockers({');
    expect(source).toContain('allowOutOfOrderApply');
    expect(source).toContain("args.includes('--allow-out-of-order-apply')");
    expect(source).toContain('Refusing to apply ');
    // applyRecords 가 플래그를 받지 못하면 가드가 항상 켜진 채 정상 릴리스를 막는다.
    expect(source).toContain('allowOutOfOrderApply: options.allowOutOfOrderApply');
  });
});

describe('선언된 게이트 파싱', () => {
  it('한 파일 안의 함수별로 키를 분리한다', () => {
    const sql = [
      "create or replace function public.admin_save_thing(p text) returns void as $$",
      "begin",
      "  if not private.is_admin(caller_id) then raise exception 'forbidden'; end if;",
      "  if not public.admin_has_permission(caller_id, 'system.metadata.manage') then raise exception 'x'; end if;",
      "end $$;",
      "create or replace function public.admin_read_thing(p text) returns void as $$",
      "begin",
      "  if not private.is_admin(caller_id) then raise exception 'forbidden'; end if;",
      "end $$;"
    ].join('\n');

    const declared = parseDeclaredGates(sql);
    expect(declared.get('admin_save_thing')).toEqual(['system.metadata.manage']);
    // 슬라이스가 새지 않아야 한다 — phase8 파일은 한 파일에 십수 개 함수를 담고
    // 그중 일부만 게이트를 갖는다.
    expect(declared.get('admin_read_thing')).toEqual([]);
  });

  it('OR 로 묶인 여러 키를 모두 수집한다', () => {
    const sql = [
      "CREATE OR REPLACE FUNCTION public.admin_send_notification(p jsonb) RETURNS void AS $$",
      "begin",
      "  if not (public.admin_has_permission(caller_id, 'message.mail.manage')",
      "       or public.admin_has_permission(caller_id, 'message.push.manage')) then",
      "    raise exception 'x';",
      "  end if;",
      "end $$;"
    ].join('\n');

    expect(parseDeclaredGates(sql).get('admin_send_notification')).toEqual([
      'message.mail.manage',
      'message.push.manage'
    ]);
  });
});

describe('기대 게이트 해석', () => {
  const gated = [
    "create or replace function public.admin_save_thing(p text) returns void as $$",
    "begin",
    "  if not public.admin_has_permission(caller_id, 'system.metadata.manage') then raise exception 'x'; end if;",
    "end $$;"
  ].join('\n');
  const ungated = [
    "create or replace function public.admin_save_thing(p text) returns void as $$",
    "begin",
    "  if not private.is_admin(caller_id) then raise exception 'forbidden'; end if;",
    "end $$;"
  ].join('\n');

  const files = [
    { name: '20260617211000_system_metadata.sql', sql: ungated },
    { name: '20260623283000_phase8_system_metadata.sql', sql: gated }
  ];

  it('실제 사고 시나리오: 적용 순서가 뒤집혀도 기대는 이름 순 최신 파일이다', () => {
    // dev 는 오래된 파일을 나중에 적용해 게이트를 잃었다. 기대값이 적용 시각을 따라가면
    // 드리프트가 정상으로 보이므로, 이름 순으로 해석해야 검사가 성립한다.
    const expected = resolveExpectedGates({
      files,
      appliedNames: files.map((file) => file.name)
    });
    expect(expected.get('admin_save_thing')).toEqual({
      keys: ['system.metadata.manage'],
      file: '20260623283000_phase8_system_metadata.sql'
    });
  });

  it('아직 적용되지 않은 파일은 기대에 넣지 않는다', () => {
    // 단순히 뒤처진 환경을 드리프트로 오진하면 검사가 신뢰를 잃는다.
    const expected = resolveExpectedGates({
      files,
      appliedNames: ['20260617211000_system_metadata.sql']
    });
    expect(expected.get('admin_save_thing')).toEqual({
      keys: [],
      file: '20260617211000_system_metadata.sql'
    });
  });

  it('관리자 표면이 아닌 함수는 무시한다', () => {
    const expected = resolveExpectedGates({
      files: [{
        name: '20260101000000_other.sql',
        sql: gated.replace('admin_save_thing', 'learner_save_thing')
      }],
      appliedNames: ['20260101000000_other.sql']
    });
    expect(expected.has('learner_save_thing')).toBe(false);
  });
});

describe('드리프트 판정', () => {
  const expected = new Map([
    ['admin_save_thing', { keys: ['system.metadata.manage'], file: 'phase8.sql' }]
  ]);

  it('파일이 요구하는 키가 라이브에 없으면 실패로 잡는다', () => {
    const { missing } = diffGates({
      expected,
      live: new Map([['admin_save_thing', { keys: [] }]])
    });
    expect(missing).toHaveLength(1);
    expect(missing[0].fname).toBe('admin_save_thing');
    expect(missing[0].declaredBy).toBe('phase8.sql');
  });

  it('라이브에만 있는 키는 실패시키지 않는다', () => {
    // 이 저장소의 게이트 다수는 do-block 안 pg_get_functiondef 수술로 들어간다.
    // 정적 파서로는 읽을 수 없으므로 이 방향을 실패로 다루면 항상 빨간불이 된다.
    const { missing, extra } = diffGates({
      expected: new Map(),
      live: new Map([['admin_list_audit_logs', { keys: ['system.audit.read'] }]])
    });
    expect(missing).toEqual([]);
    expect(extra).toHaveLength(1);
  });

  it('라이브에 함수 자체가 없으면 이 검사의 관심사가 아니다', () => {
    const { missing } = diffGates({ expected, live: new Map() });
    expect(missing).toEqual([]);
  });
});

describe('복구 도구 안전장치', () => {
  const source = readFileSync(
    join(cwd(), 'scripts', 'db', 'repair-permission-gate-drift.mjs'),
    'utf8'
  );

  it('참조 환경이 스스로 옳지 않으면 복구를 거부한다', () => {
    expect(source).toContain('reference is also missing');
    expect(source).toContain('Refusing to repair while blockers remain');
  });

  it('시그니처가 다르면 거부한다', () => {
    // CREATE OR REPLACE 가 오버로드를 추가해버리면 게이트 없는 본문이 계속 호출 가능하다.
    expect(source).toContain('signature differs');
  });

  it('쓰기 대상 계약을 마이그레이션과 동일하게 요구한다', () => {
    expect(source).toContain('SUPABASE_EXPECTED_PROJECT_REF');
    expect(source).toContain('SUPABASE_PRODUCTION_CONFIRM');
  });

  it('pg_get_functiondef 에 종결 세미콜론이 없다는 사실을 처리한다', () => {
    expect(source).toContain("replace(/;\\s*$/, '')");
  });
});
