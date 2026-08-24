import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';
import { describe, expect, it } from 'vitest';

const migrationName =
  '20260824130000_topik_writing_canonical_guard_dynamic_check.sql';
const migration = readFileSync(
  join(cwd(), 'supabase', 'migrations', migrationName),
  'utf8'
).replace(/\s+/g, ' ').toLowerCase();
const downMigration = readFileSync(
  join(cwd(), 'supabase', 'migrations', 'down', migrationName),
  'utf8'
).replace(/\s+/g, ' ').toLowerCase();

describe('canonical 교체 guard 동적 호출 SQL 계약', () => {
  it('선택적 의존 호출을 동적 SQL 로만 실행한다(정적 참조 금지)', () => {
    expect(migration).toContain(
      "execute 'select private.is_writing_canonical_read_enabled()' into v_enabled"
    );
    expect(migration).toContain(
      "if to_regprocedure('private.is_writing_canonical_read_enabled()') is not null then"
    );
    // 정적 참조( and 로 이어지는 직접 호출)가 본문에 재발하면 안 된다.
    expect(migration).not.toContain(
      'is not null and private.is_writing_canonical_read_enabled()'
    );
  });

  it('advisory lock 키와 거부 의미론을 유지한다', () => {
    expect(migration).toContain('pg_advisory_xact_lock(731971029691967530::bigint)');
    expect(migration).toContain(
      "raise exception 'canonical_question_replacement_requires_noncanonical_mode'"
    );
    expect(migration).toContain('return old');
  });

  it('트리거 함수 실행 경계를 유지한다(직접 execute 전부 회수)', () => {
    for (const role of ['public', 'anon', 'authenticated', 'service_role']) {
      expect(migration).toContain(
        `revoke all on function private.guard_writing_canonical_question_replacement() from ${role}`
      );
    }
  });

  it('down 은 20260713082500 의 정적 참조 정의를 복원한다', () => {
    expect(downMigration).toContain(
      'is not null and private.is_writing_canonical_read_enabled()'
    );
    expect(downMigration).not.toContain('execute ');
    expect(downMigration).toContain('pg_advisory_xact_lock(731971029691967530::bigint)');
  });
});
