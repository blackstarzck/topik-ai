import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';
import { describe, expect, it } from 'vitest';

const migrationName =
  '20260824120000_topik_writing_timestampless_content_versioning.sql';
const migration = readFileSync(
  join(cwd(), 'supabase', 'migrations', migrationName),
  'utf8'
).replace(/\s+/g, ' ').toLowerCase();
const downMigration = readFileSync(
  join(cwd(), 'supabase', 'migrations', 'down', migrationName),
  'utf8'
).replace(/\s+/g, ' ').toLowerCase();

describe('TOPIK 쓰기 무시각(timestampless) 수신 content 판정 SQL 계약', () => {
  it('updated_at 부재를 원문 기준으로 감지하고, 있는데 못 읽는 값은 계속 보류한다', () => {
    expect(migration).toContain(
      "v_updated_raw := nullif(btrim(p_raw_payload->>'updated_at'), '')"
    );
    expect(migration).toContain('v_timestampless := v_updated_raw is null');
    expect(migration).toContain(
      '(not v_timestampless and v_source_updated_at is null)'
    );
    expect(migration).toContain(
      '(v_source_updated_at is not null and v_source_updated_at < v_source_created_at)'
    );
  });

  it('문항군이 유효한 updated_at 을 관측했으면 이후 무시각 수신은 회귀로 보류한다', () => {
    expect(migration).toContain(
      "bool_or( private.try_parse_writing_source_time(raw_payload->>'updated_at') is not null )"
    );
    expect(migration).toContain('elsif v_timestampless and v_family_has_ordering then');
    expect(migration).toContain(
      'updated_at is missing although revision ordering was already established'
    );
  });

  it('무시각 수신은 content_hash 비교만으로 판정하고 엄격 사다리는 유지한다', () => {
    expect(migration).toContain('elsif v_timestampless then');
    const timestamplessBranch = migration.slice(
      migration.indexOf('elsif v_timestampless then')
    );
    expect(timestamplessBranch).toContain(
      "v_version_decision := 'content_changed'"
    );
    expect(timestamplessBranch).toContain(
      "v_version_decision := 'metadata_only'"
    );
    expect(migration).toContain("v_version_decision := 'out_of_order'");
    expect(migration).toContain("v_version_decision := 'timestamp_conflict'");
    expect(migration).toContain("v_version_decision := 'identity_conflict'");
  });

  it('무시각 수신의 유효 수정 시각은 created_at 으로 저장한다(legacy 백필과 동일 규약)', () => {
    expect(migration).toContain(
      'if v_timestampless then v_source_updated_at := v_source_created_at; end if;'
    );
  });

  it('보류 중이던 무시각 수신의 1회 재판정은 안전 가드를 전부 요구한다', () => {
    expect(migration).toContain('imp.is_latest');
    expect(migration).toContain("imp.version_decision = 'invalid_timestamp'");
    expect(migration).toContain(
      'on source_map.question_id = imp.source_task_id'
    );
    expect(migration).toContain('on ref.import_id = source_map.canonical_import_id');
    expect(migration).toContain(
      "private.try_parse_writing_source_time(imp.raw_payload->>'created_at') = imp.source_created_at"
    );
    expect(migration).toContain('family.source_created_at = imp.source_created_at');
    expect(migration).toContain('source_updated_at = imp.source_created_at');
  });

  it('service-role 실행 경계를 유지한다', () => {
    expect(migration).toContain(
      'revoke all on function public.admin_ingest_writing_task(uuid, text, jsonb, text, smallint, text) from public, anon, authenticated'
    );
    expect(migration).toContain(
      'grant execute on function public.admin_ingest_writing_task(uuid, text, jsonb, text, smallint, text) to service_role'
    );
  });

  it('down 은 미승격 무시각 수신을 재보류하고 엄격 전용 판정을 복원한다', () => {
    expect(downMigration).toContain(
      "nullif(btrim(raw_payload->>'updated_at'), '') is null"
    );
    expect(downMigration).toContain(
      "(mapping_status = 'raw' and version_decision in ('content_changed', 'initial'))"
    );
    expect(downMigration).toContain('source_updated_at = null');
    expect(downMigration).toContain(
      'or v_source_updated_at is null or v_source_updated_at < v_source_created_at'
    );
    expect(downMigration).not.toContain('v_timestampless');
  });
});
