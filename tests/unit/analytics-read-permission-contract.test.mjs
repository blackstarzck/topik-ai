import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';
import { describe, expect, it } from 'vitest';

/**
 * analytics.read 권한 게이트 전환(20260805130000)의 SQL 계약 테스트.
 *
 * 이 마이그는 파일 전문 재정의가 아니라 라이브 정의 문자열 수술이다. 여기서 고정하는
 * 불변식은 ① 4함수 전부가 수술 대상이고 ② 앵커는 발생 횟수를 단정한 뒤 치환하며
 * ③ 존재하지 않는 private.admin_has_permission 을 부르지 않고(42883 재발 방지)
 * ④ down 이 정확히 역방향이라는 것이다.
 *
 * 🚨 주석을 먼저 걷어낸다(줄 주석 제거가 공백 정규화보다 먼저) — 선례 함정.
 */
const MIGRATION = '20260805130000_admin_analytics_read_permission.sql';

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

// 앵커 원문(들여쓰기 포함). 수술은 이 블록을 통째로 치환하므로 up·down·정의 원본
// 세 곳의 바이트가 일치해야 한다.
const GUARD_OLD = `  if not private.is_admin(caller_id) then
    raise exception 'forbidden: admin required';
  end if;`;
const GUARD_NEW = `  if not public.admin_has_permission(caller_id, 'analytics.read') then
    raise exception 'forbidden: missing permission analytics.read';
  end if;`;

const TARGET_IDENTITIES = [
  'public.get_admin_learning_analytics_filtered(date,date,smallint[],text,text,jsonb,boolean)',
  'public.get_admin_learning_analytics_filter_options()',
  'public.get_admin_learning_analytics(integer)',
  'public.get_admin_analytics_overview(integer)'
];

const manifests = {
  development: JSON.parse(readFileSync(
    join(cwd(), 'scripts', 'db', 'manifests', 'admin-development-reconciliation.json'), 'utf8'
  )),
  production: JSON.parse(readFileSync(
    join(cwd(), 'scripts', 'db', 'manifests', 'admin-production-cutover.json'), 'utf8'
  ))
};

describe('권한 검사 치환', () => {
  it('4함수 전부를 수술 대상으로 등재한다', () => {
    for (const identity of TARGET_IDENTITIES) {
      expect(up).toContain(identity.toLowerCase());
      expect(down).toContain(identity.toLowerCase());
    }
  });

  it('앵커 블록이 up·down 에서 바이트 단위로 같고, 정의 원본과도 일치한다', () => {
    // 앵커가 라이브 본문과 한 글자라도 다르면 발생 횟수 단정이 fail-closed 로 막지만,
    // 그 실패를 배포 시점이 아니라 여기서 먼저 잡는다: 앵커의 원천인 최신 전문
    // 재정의 파일(20260715173826)에 같은 블록이 실제로 존재해야 한다.
    // 🚨 toContain 은 부족하다 — 같은 앵커가 수술 블록과 검증 블록에 각각 있어,
    // 한쪽만 깨져도 다른 쪽에 걸려 통과한다(red 주입으로 실측). 발생 횟수를 단정한다.
    const countOf = (haystack, needle) => haystack.split(needle).length - 1;
    const restoreSource = readFileSync(
      join(
        cwd(), 'supabase', 'migrations-admin',
        '20260715173826_restore_learning_analytics_metadata_contract.sql'
      ),
      'utf8'
    );
    // 원본 전문 재정의에는 두 함수 본문에 하나씩, 정확히 2회.
    expect(countOf(restoreSource, GUARD_OLD)).toBe(2);
    // up = 수술 블록(구→신) 1회 + 검증 블록(신) 1회.
    expect(countOf(upRaw, GUARD_OLD)).toBe(1);
    expect(countOf(upRaw, GUARD_NEW)).toBe(2);
    // down = 역수술 블록(신→구) 1회 + 검증 블록(구) 1회.
    expect(countOf(downRaw, GUARD_NEW)).toBe(1);
    expect(countOf(downRaw, GUARD_OLD)).toBe(2);
  });

  it('존재가 아니라 발생 횟수를 단정한 뒤 치환한다', () => {
    expect(up).toContain('expected exactly one legacy guard');
    expect(up).toContain('already carries a permission check');
    expect(up).toContain('unexpected extra private.is_admin reference');
    expect(up).toContain('execute v_definition');
  });

  it('이후 수술이 심은 계약 리터럴을 사전·사후에 보존한다', () => {
    // pdf perTopic(20260715190000)·metadata coverage(20260715173826) 계약이
    // 이 수술을 통과한 뒤에도 남아 있어야 한다.
    for (const literal of [
      "'pertopic'",
      'pdf_per_topic as',
      'submission_metadata_facts as',
      'event_metadata_coverage as',
      'topic_total',
      "'questionno', t.question_no"
    ]) {
      expect(up).toContain(literal);
      expect(down).toContain(literal);
    }
    expect(up).toContain('contract literal % is missing');
    expect(up).toContain('contract literal % lost during rewrite');
  });

  it('존재하지 않는 private.admin_has_permission 을 부르지 않는다', () => {
    // 기관 노출 모드 쓰기 경로를 운영에서 42883 으로 죽였던 결함의 재발 방지.
    expect(up).not.toContain('private.admin_has_permission');
    expect(down).not.toContain('private.admin_has_permission');
    expect(up).toContain("to_regprocedure('public.admin_has_permission(uuid,text)') is null");
  });

  it('expand 계약을 지킨다 — drop·시그니처 변경 없이 검사식만 바꾼다', () => {
    for (const banned of ['drop function', 'drop table', 'drop type', 'truncate']) {
      expect(up).not.toContain(banned);
      expect(down).not.toContain(banned);
    }
    expect(up).not.toContain('create or replace function');
    expect(down).not.toContain('create or replace function');
  });

  it('실행 후 라이브 정의·anon 권한·주석을 다시 읽어 확정한다', () => {
    expect(up).toContain('verify_analytics_permission');
    expect(up).toContain("has_function_privilege('anon', v_identity, 'execute')");
    expect(up).toContain("obj_description(v_identity, 'pg_proc')");
    expect(up).toContain('legacy check survived');
  });
});

describe('down 역방향 계약', () => {
  it('신 가드를 구 가드로 되돌리고 권한 검사식을 소거한다', () => {
    expect(down).toContain('expected exactly one permission guard');
    expect(down).toContain('already carries the legacy check');
    expect(down).toContain('execute v_definition');
    expect(down).toContain('verify_analytics_revert');
    expect(down).toContain('permission check survived');
  });

  it('함수 주석을 마이그레이션 이전 원문으로 복원한다', () => {
    // 4개 주석 중 2개는 "private.is_admin 전용" 문구가 아니다 — 함수별 원문을 개별 복원.
    expect(down).toContain('private.is_admin 전용');
    expect(down).toContain('admin 공통 read 전용');
    expect(down).toContain('is_admin 전용');
    expect(down).toContain('comment was not restored');
  });
});

describe('manifest lockstep', () => {
  it.each([['development'], ['production']])(
    '%s 은 파일 수와 일치하고 권한 게이트 배치를 등재한다',
    (env) => {
      const manifest = manifests[env];
      // 상수를 박지 않는다 — 마이그가 추가될 때마다 무관한 테스트가 깨진다.
      const fileCount = readdirSync(join(cwd(), 'supabase', 'migrations-admin'))
        .filter((name) => name.endsWith('.sql')).length;
      expect(manifest.expectedLocalCount).toBe(fileCount);
      // `.to` 정확 일치 대신 범위 포함 — 검사할 불변식은 "범위가 이 마이그를 덮는다"다.
      expect(manifest.batches['release-all'].from <= MIGRATION).toBe(true);
      expect(manifest.batches['release-all'].to >= MIGRATION).toBe(true);
      expect(manifest.batches['baseline-all'].from <= MIGRATION).toBe(true);
      expect(manifest.batches['baseline-all'].to >= MIGRATION).toBe(true);

      const batch = manifest.batches['analytics-read-permission'];
      expect(batch.migrations).toEqual([MIGRATION]);
      expect(batch.reason).toMatch(/[가-힣]/);
      expect(batch.expectPresentAfter).toEqual(
        expect.arrayContaining([
          ...TARGET_IDENTITIES.map((identity) => ({ kind: 'function', identity })),
          { kind: 'function', identity: 'public.admin_has_permission(uuid,text)' }
        ])
      );
    }
  );
});
