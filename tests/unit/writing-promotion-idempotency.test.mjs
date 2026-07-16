import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';

import { describe, expect, test } from 'vitest';

const root = cwd();
const migrationPath = join(
  root,
  'supabase',
  'migrations',
  '20260714130000_topik_writing_promotion_idempotency.sql'
);
const downPath = join(
  root,
  'supabase',
  'migrations',
  'down',
  '20260714130000_topik_writing_promotion_idempotency.sql'
);
const normalize = (value) => value.replace(/\s+/g, ' ').trim().toLowerCase();
const sql = normalize(readFileSync(migrationPath, 'utf8'));
const down = normalize(readFileSync(downPath, 'utf8'));

describe('writing promotion idempotency corrective migration', () => {
  test('recovers an exact pinned import without replacing canonical content', () => {
    const idempotentStart = sql.indexOf('if v_existing_import_id = v_row.import_id then');
    const idempotentEnd = sql.indexOf('if v_canonical_read_enabled', idempotentStart);
    const idempotentBranch = sql.slice(idempotentStart, idempotentEnd);

    expect(idempotentBranch).toContain(
      'v_learner_problem_id is distinct from md5(v_row.source_task_id)::uuid'
    );
    expect(idempotentBranch).toContain(
      'v_existing_payload_hash is distinct from v_row.payload_hash'
    );
    expect(idempotentBranch).toContain("set mapping_status = 'promoted'");
    expect(idempotentBranch).toContain('promoted_question_id = v_row.source_task_id');
    expect(idempotentBranch).toContain('set hold_reason = null');
    expect(idempotentBranch).toContain('v_idempotent_skipped := v_idempotent_skipped + 1');
    expect(idempotentBranch).toContain('continue');
    expect(idempotentBranch).not.toContain('delete from public');
  });

  test('keeps different hashes fail-closed and does not hold a pinned import in the handler', () => {
    expect(sql).toContain('canonical_question_payload_hash_frozen');
    expect(sql).toContain(
      'and not exists ( select 1 from public.topik_writing_question_source_map sm'
    );
    expect(sql).toContain('and sm.canonical_import_id = v_row.import_id');
    expect(sql).toContain("'idempotent_skipped', v_idempotent_skipped");
  });

  test('preserves service-role ownership and restores the previous definition on rollback', () => {
    expect(sql).toContain(
      'grant execute on function public.admin_promote_writing_questions(uuid, text[]) to service_role'
    );
    expect(sql).toContain(
      'revoke all on function public.admin_promote_writing_questions(uuid, text[]) from authenticated'
    );
    expect(down).toContain('create or replace function public.admin_promote_writing_questions');
    expect(down).not.toContain('idempotent_skipped');
    expect(down).toContain('canonical_question_payload_hash_frozen');
  });
});
