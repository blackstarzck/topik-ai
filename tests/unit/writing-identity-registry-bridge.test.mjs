import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';

import { describe, expect, test } from 'vitest';

const root = cwd();
const migrationPath = join(
  root,
  'supabase',
  'migrations',
  '20260714150000_topik_writing_identity_registry_bridge.sql'
);
const downPath = join(
  root,
  'supabase',
  'migrations',
  'down',
  '20260714150000_topik_writing_identity_registry_bridge.sql'
);
const rawSql = readFileSync(migrationPath, 'utf8');
const rawDown = readFileSync(downPath, 'utf8');
const normalize = (value) => value.replace(/\s+/g, ' ').trim().toLowerCase();
const sql = normalize(rawSql);
const down = normalize(rawDown);

const functionDefinition = (value) => {
  const start = value.indexOf('create or replace function');
  expect(start).toBeGreaterThanOrEqual(0);
  return normalize(value.slice(start));
};

describe('writing identity registry bridge migration', () => {
  test('fails closed when the v13-owned registry function is absent', () => {
    expect(sql).toContain(
      "to_regprocedure('private.ensure_writing_problem_identity(uuid,text,smallint)') is null"
    );
    expect(sql).toContain(
      'missing v13 dependency: writing problem identity registry function'
    );
  });

  test('reconciles pinned canonical identities through the owned function boundary', () => {
    expect(sql).toContain(
      'join public.topik_writing_question_import imp on imp.import_id = sm.canonical_import_id'
    );
    expect(sql).toContain('and imp.source_task_id = sm.question_id');
    expect(sql).toContain('and imp.promoted_question_id = sm.question_id');
    expect(sql).toContain('and imp.item_number = sm.item_number');
    expect(sql).toContain("and imp.mapping_status = 'promoted'");

    const registryCalls = sql.match(
      /perform private\.ensure_writing_problem_identity\(/g
    );
    expect(registryCalls).toHaveLength(3);
  });

  test('does not couple Admin DDL or writes to v13-owned identity/content tables', () => {
    expect(sql).not.toContain('private.problem_identities');
    expect(sql).not.toContain('ensure_writing_problem_anchor');
    expect(sql).not.toContain('public.problems');
    expect(sql).not.toContain('references private.');
    expect(sql).not.toContain('is_writing_canonical_read_enabled');
    expect(sql).not.toContain('v_canonical_read_enabled');
    expect(sql).not.toContain('canonical_question_payload_hash_frozen');
  });

  test('keeps same-import idempotency and registers its identity before recovery', () => {
    const start = sql.indexOf('if v_existing_import_id = v_row.import_id then');
    const end = sql.indexOf('v_learner_problem_id := coalesce', start);
    const branch = sql.slice(start, end);

    expect(branch).toContain('canonical_question_identity_mismatch');
    expect(branch).toContain('canonical_question_payload_hash_mismatch');
    expect(branch).toContain('perform private.ensure_writing_problem_identity(');
    expect(branch).toContain('v_idempotent_skipped := v_idempotent_skipped + 1');
    expect(branch).not.toContain('delete from public');
  });

  test('restores only the previous anchor interface without obsolete runtime branching or data repair', () => {
    expect(functionDefinition(rawDown)).toContain(
      'perform private.ensure_writing_problem_anchor('
    );
    expect(down).not.toContain('do $$');
    expect(down).not.toContain('ensure_writing_problem_identity');
    expect(down).not.toContain('public.problems');
    expect(down).not.toContain('is_writing_canonical_read_enabled');
    expect(down).not.toContain('v_canonical_read_enabled');
    expect(down).not.toContain('canonical_question_payload_hash_frozen');
  });
});
