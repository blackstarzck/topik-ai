import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';
import { describe, expect, it } from 'vitest';

const migrationName =
  '20260716003518_topik_writing_question_version_summary_view.sql';
const migration = readFileSync(
  join(cwd(), 'supabase', 'migrations', migrationName),
  'utf8'
).replace(/\s+/g, ' ').toLowerCase();
const downMigration = readFileSync(
  join(cwd(), 'supabase', 'migrations', 'down', migrationName),
  'utf8'
).replace(/\s+/g, ' ').trim().toLowerCase();
const importMigration = readFileSync(
  join(
    cwd(),
    'supabase',
    'migrations',
    '20260622160000_topik_writing_question_import.sql'
  ),
  'utf8'
).replace(/\s+/g, ' ').toLowerCase();
const rlsMigration = readFileSync(
  join(
    cwd(),
    'supabase',
    'migrations',
    '20260610201100_topik_writing_rls.sql'
  ),
  'utf8'
).replace(/\s+/g, ' ').toLowerCase();

describe('TOPIK 쓰기 문항 버전 요약 SQL 계약', () => {
  it('현재 버전은 source map canonical pointer만 사용한다', () => {
    expect(migration).toContain('source_map.canonical_import_id');
    expect(migration).not.toContain('is_latest');
  });

  it('승격 성공 버전만 집계하고 현재 버전 한 건을 수정 횟수에서 제외한다', () => {
    expect(migration).toContain(
      "question_import.mapping_status = 'promoted'"
    );
    expect(migration).toContain(
      'question_import.promoted_question_id = source_map.question_id'
    );
    expect(migration).toContain(
      'count(question_import.import_id)::bigint as version_count'
    );
    expect(migration).toContain(
      'greatest(count(question_import.import_id) - 1, 0)::bigint as revision_count'
    );
  });

  it('호출자 RLS를 적용하고 anon/PUBLIC을 차단하며 authenticated만 명시 허용한다', () => {
    expect(migration).toContain('with (security_invoker = true)');
    expect(migration).toContain(
      'revoke all on public.topik_writing_question_version_summary_view from public'
    );
    expect(migration).toContain(
      'revoke all on public.topik_writing_question_version_summary_view from anon'
    );
    expect(migration).toContain(
      'grant select on public.topik_writing_question_version_summary_view to authenticated'
    );
    expect(importMigration).toContain(
      'create policy topik_writing_question_import_admin_select'
    );
    expect(importMigration).toContain(
      'using (private.is_admin((select auth.uid())))'
    );
    expect(rlsMigration).toContain(
      'create policy topik_writing_question_source_map_admin_select'
    );
  });

  it('down migration이 읽기 전용 뷰만 제거한다', () => {
    expect(downMigration).toBe(
      'drop view if exists public.topik_writing_question_version_summary_view;'
    );
  });
});
