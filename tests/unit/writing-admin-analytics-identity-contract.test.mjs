import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';
import { describe, expect, it } from 'vitest';

const migrationPath = join(
  cwd(),
  'supabase',
  'migrations-admin',
  '20260714090000_admin_writing_analytics_learner_identity.sql'
);
const downPath = join(
  cwd(),
  'supabase',
  'migrations-admin',
  'down',
  '20260714090000_admin_writing_analytics_learner_identity.sql'
);
const sql = readFileSync(migrationPath, 'utf8').replace(/\s+/g, ' ').toLowerCase();
const down = readFileSync(downPath, 'utf8').replace(/\s+/g, ' ').toLowerCase();

describe('Admin writing analytics learner identity correction', () => {
  it('fails closed unless the canonical learner identity dependency exists', () => {
    expect(sql).toContain("column_name = 'learner_problem_id'");
    expect(sql).toContain(
      "raise exception 'missing topik_writing dependency: learner_problem_id'"
    );
  });

  it('builds current title and tags from canonical Admin-owned metadata', () => {
    expect(sql).toContain(
      'create or replace view private.admin_writing_question_metadata with (security_invoker = true)'
    );
    expect(sql).toContain('sm.learner_problem_id as problem_id');
    expect(sql).toContain('public.topik_writing_question_recommendation_view');
    expect(sql).toContain('public.topik_writing_question_import imp');
    expect(sql).toContain("imp.raw_payload->>'topic_seed_title'");
    expect(sql).toContain('public.topik_writing_question_tags');
    expect(sql).toContain('and t.is_active');
    expect(sql).not.toContain('select p.title');
    expect(sql).not.toContain('select p.tags');
  });

  it('rewrites every Admin analytics current-content consumer', () => {
    expect(sql).toContain('public.get_admin_user_learning_overview(uuid)');
    expect(sql).toContain('public.get_admin_learning_analytics(integer)');
    expect(sql).toContain(
      'public.get_admin_learning_analytics_filtered(date,date,smallint[],text,text,jsonb,boolean)'
    );
    expect(sql).toContain(
      'left join private.admin_writing_question_metadata p on p.problem_id = ws.problem_id'
    );
    expect(sql).toContain("'sm.legacy_problem_id', 'sm.learner_problem_id'");
    expect(sql).toContain('from public.topik_writing_problem_question_map pm');
  });

  it('fails closed for stale definitions while preserving the latest canonical filtered analytics contract', () => {
    expect(sql).toContain('refusing stale rewrite');
    expect(sql).toContain("length('sm.legacy_problem_id') = 2");
    expect(sql).toContain("position('sm.learner_problem_id' in v_definition) = 0");
    expect(sql).toContain('preserve that newer definition exactly');
    expect(sql).toContain("position('p.problem_title' in v_definition) > 0");
    expect(sql).toContain("position('p.problem_tags' in v_definition) > 0");
  });

  it('does not write or alter v13-owned user data tables', () => {
    expect(sql).not.toMatch(
      /(?:insert\s+into|update|delete\s+from|alter\s+table)\s+public\.(?:writing_submissions|writing_feedback|problems|study_events)/
    );
  });

  it('restores the immediately previous definitions before dropping the helper view', () => {
    expect(sql).toContain(
      'create table if not exists private.admin_writing_analytics_rollback_function'
    );
    expect(down).toContain('execute v_function.function_definition');
    expect(down.lastIndexOf('drop view if exists private.admin_writing_question_metadata'))
      .toBeGreaterThan(down.lastIndexOf('execute v_function.function_definition'));
    expect(down).toContain(
      'drop table if exists private.admin_writing_analytics_rollback_function'
    );
  });
});
