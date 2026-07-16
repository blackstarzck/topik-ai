import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';
import { describe, expect, it } from 'vitest';

const migrationName =
  '20260716052957_topik_writing_source_updated_at_version_tracking.sql';
const migration = readFileSync(
  join(cwd(), 'supabase', 'migrations', migrationName),
  'utf8'
).replace(/\s+/g, ' ').toLowerCase();
const downMigration = readFileSync(
  join(cwd(), 'supabase', 'migrations', 'down', migrationName),
  'utf8'
).replace(/\s+/g, ' ').toLowerCase();

describe('TOPIK 쓰기 원본 updated_at 버전 판정 SQL 계약', () => {
  it('원본 시각·content hash·판정 필드와 문항별 시각 인덱스를 추가한다', () => {
    expect(migration).toContain('add column if not exists source_created_at timestamptz');
    expect(migration).toContain('add column if not exists source_updated_at timestamptz');
    expect(migration).toContain('add column if not exists content_hash text');
    expect(migration).toContain('add column if not exists version_decision text');
    expect(migration).toContain(
      'on public.topik_writing_question_import (source_task_id, source_updated_at desc, import_id desc)'
    );
  });

  it('legacy 기준선을 만들고 원본 UTC 시각을 엄격하게 검증한다', () => {
    expect(migration).toContain("version_decision = 'legacy'");
    expect(migration).toContain("raw_payload->>'updated_at'");
    expect(migration).toContain("raw_payload->>'created_at'");
    expect(migration).toContain('reject timezone-less values');
    expect(migration).toContain('v_source_updated_at < v_source_created_at');
    expect(migration).toContain("v_version_decision := 'invalid_timestamp'");
  });

  it('payload hash 재수신은 행을 추가하지 않고 content hash로 실제 변경을 분리한다', () => {
    expect(migration).toContain('where source_task_id = v_sid and payload_hash = v_payload_hash');
    expect(migration).toContain('ingest_count = ingest_count + 1');
    expect(migration).toContain("v_version_decision := 'metadata_only'");
    expect(migration).toContain("v_version_decision := 'content_changed'");
    expect(migration).toContain("v_version_decision := 'timestamp_conflict'");
    expect(migration).toContain("v_version_decision := 'out_of_order'");
    expect(migration).toContain("v_version_decision := 'identity_conflict'");
    expect(migration).toContain(
      "nullif(btrim(p_raw_payload->>'question_id'), '') is null"
    );
    expect(migration).toContain(
      "question_import.version_decision in ('legacy', 'initial', 'content_changed', 'metadata_only')"
    );
    expect(migration).toContain(
      'v_reference_content_hash := coalesce(v_canonical_content_hash, v_reference_content_hash)'
    );
    expect(migration).toContain(
      "version_decision not in ('invalid_timestamp', 'identity_conflict')"
    );
  });

  it('학습·채점 projection에서 식별·시각·운영 메타데이터를 제외한다', () => {
    for (const excluded of [
      'question_id',
      'item_number',
      'created_at',
      'updated_at',
      'service_status',
      'content_team_memo',
      'auto_checks_passed'
    ]) {
      expect(migration).toContain(`'${excluded}'`);
    }
    expect(migration).toContain('writing_question_content_projection');
    expect(migration).toContain('writing_question_content_hash');
  });

  it('문항별 advisory lock으로 판정과 승격을 직렬화하고 포인터는 source map만 전환한다', () => {
    expect(migration.match(/pg_advisory_xact_lock/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(migration).toContain(
      "imp.version_decision in ('initial', 'content_changed')"
    );
    expect(migration).toContain('canonical_import_id = excluded.canonical_import_id');
    expect(migration).toContain(
      "v_mapping_status := 'held'; v_event := case when v_version_decision = 'metadata_only'"
    );
    expect(migration).toContain(
      "'metadata_only', v_metadata_only, 'held', v_held"
    );
  });

  it('service-role RPC 경계를 유지하고 롤백은 메타데이터 행의 오승격을 막는다', () => {
    expect(migration).toContain(
      'revoke all on function public.admin_ingest_writing_task(uuid, text, jsonb, text, smallint, text) from public, anon, authenticated'
    );
    expect(migration).toContain(
      'grant execute on function public.admin_promote_writing_questions(uuid, text[]) to service_role'
    );
    expect(downMigration).toContain(
      "where version_decision in ('legacy', 'initial', 'content_changed')"
    );
    expect(downMigration).toContain('drop column if exists version_decision');
    expect(downMigration).toContain('drop function if exists private.writing_question_content_hash');
    expect(downMigration).toContain('where imp.is_latest');
  });
});
