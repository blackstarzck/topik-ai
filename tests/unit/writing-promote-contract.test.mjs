import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(
  join(
    cwd(),
    'supabase',
    'migrations',
    '20260713080015_topik_writing_canonical_read_contract.sql'
  ),
  'utf8'
)
  .replace(/\s+/g, ' ')
  .toLowerCase();
const downSql = readFileSync(
  join(
    cwd(),
    'supabase',
    'migrations',
    'down',
    '20260713080015_topik_writing_canonical_read_contract.sql'
  ),
  'utf8'
)
  .replace(/\s+/g, ' ')
  .toLowerCase();

const promoteStart = sql.indexOf(
  'create or replace function public.admin_promote_writing_questions'
);
const promoteSql = sql.slice(promoteStart);

describe('canonical writing promotion contract', () => {
  it('locks inbox and official/source-map identities before promotion', () => {
    expect(promoteStart).toBeGreaterThanOrEqual(0);
    expect(promoteSql).toContain('for update skip locked');
    expect(promoteSql).toContain(
      "select service_status, created_at from public.%i where question_id = $1 for update"
    );
    expect(promoteSql).toContain(
      'from public.topik_writing_question_source_map sm where sm.question_id = v_row.source_task_id for update'
    );
  });

  it('rejects payload identity drift and overwrites payload identity from inbox keys', () => {
    expect(promoteSql).toContain(
      "raw_payload->>'review_status' is distinct from '검수 완료'"
    );
    expect(promoteSql).toContain('review_status<>검수 완료');
    expect(promoteSql).toContain('question_id mismatch between inbox key and payload');
    expect(promoteSql).toContain('item_number mismatch between inbox key and payload');
    expect(promoteSql).toContain(
      'promoted_question_id mismatch between inbox and source task'
    );
    expect(promoteSql).toContain("'question_id', v_row.source_task_id");
    expect(promoteSql).toContain("'item_number', v_row.item_number");
    expect(promoteSql).toContain('source map item_number collision');
    expect(promoteSql).toContain(
      'item_number = public.topik_writing_question_source_map.item_number'
    );
  });

  it('freezes existing payload hashes only after shared canonical mode exists and is active', () => {
    expect(promoteSql).toContain(
      "to_regprocedure('private.is_writing_canonical_read_enabled()') is not null"
    );
    expect(promoteSql).toContain(
      'select coalesce(private.is_writing_canonical_read_enabled(), false)'
    );
    expect(promoteSql).toContain(
      'if v_canonical_read_enabled and v_existing_status is not null then'
    );
    expect(promoteSql).toContain('canonical_question_version_not_pinned');
    expect(promoteSql).toContain('canonical_question_version_parity_not_proven');
    expect(promoteSql).toContain('canonical_question_payload_hash_frozen');
    expect(promoteSql).toContain(
      'if v_existing_payload_hash is distinct from v_row.payload_hash then'
    );
  });

  it('completes official, version map, anchor, import state, and audit in one subtransaction', () => {
    const officialWrite = promoteSql.indexOf("insert into public.%i select * from jsonb_populate_record");
    const sourceMapWrite = promoteSql.indexOf(
      'insert into public.topik_writing_question_source_map'
    );
    const anchorWrite = promoteSql.indexOf(
      'perform private.ensure_writing_problem_anchor'
    );
    const promotedState = promoteSql.indexOf("set mapping_status = 'promoted'");
    const auditWrite = promoteSql.indexOf('insert into public.admin_audit_logs');

    expect(officialWrite).toBeGreaterThanOrEqual(0);
    expect(sourceMapWrite).toBeGreaterThan(officialWrite);
    expect(anchorWrite).toBeGreaterThan(sourceMapWrite);
    expect(promotedState).toBeGreaterThan(anchorWrite);
    expect(auditWrite).toBeGreaterThan(promotedState);
    expect(promoteSql).toContain('exception when others then');
    expect(promoteSql).toContain("set mapping_status = 'held'");
  });

  it('uses the generated learner UUID without overwriting legacy provenance', () => {
    expect(promoteSql).toContain(
      'select sm.learner_problem_id, sm.item_number, sm.canonical_import_id'
    );
    expect(promoteSql).toContain(
      'returning learner_problem_id into v_learner_problem_id'
    );
    expect(promoteSql).toContain(
      'perform private.ensure_writing_problem_anchor( v_learner_problem_id'
    );
    expect(promoteSql).not.toContain('legacy_problem_id =');
    expect(promoteSql).not.toContain('returning legacy_problem_id');
    expect(promoteSql).toContain(
      'grant execute on function public.admin_promote_writing_questions(uuid, text[]) to service_role'
    );
    expect(promoteSql).toContain(
      'revoke all on function public.admin_promote_writing_questions(uuid, text[]) from authenticated'
    );
  });

  it('restores the previous promotion interface on rollback', () => {
    expect(downSql).toContain(
      'create or replace function public.admin_promote_writing_questions'
    );
    expect(downSql).not.toContain('perform private.ensure_writing_problem_anchor');
    expect(downSql).not.toContain('canonical_import_id = excluded.canonical_import_id');
    expect(downSql).toContain(
      'grant execute on function public.admin_promote_writing_questions(uuid, text[]) to service_role'
    );
  });
});
