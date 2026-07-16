import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';
import { describe, expect, it } from 'vitest';

const migrationPath = join(
  cwd(),
  'supabase',
  'migrations-admin',
  '20260715103000_admin_writing_analytics_canonical_coverage.sql'
);
const downPath = join(
  cwd(),
  'supabase',
  'migrations-admin',
  'down',
  '20260715103000_admin_writing_analytics_canonical_coverage.sql'
);
const latestCoveragePath = join(
  cwd(),
  'supabase',
  'migrations-admin',
  '20260713120000_admin_learning_analytics_metadata_coverage.sql'
);

const rawSql = readFileSync(migrationPath, 'utf8');
const sql = rawSql.replace(/\s+/g, ' ').toLowerCase();
const down = readFileSync(downPath, 'utf8').replace(/\s+/g, ' ').toLowerCase();
const latestCoverage = readFileSync(latestCoveragePath, 'utf8').toLowerCase();

describe('Admin writing analytics canonical coverage correction', () => {
  it('backs up the latest filtered RPC and migrates resolved historical identities', () => {
    expect(sql).toContain(
      'create table private.admin_writing_analytics_coverage_rollback_function'
    );
    expect(sql).toContain(
      'create view private.admin_writing_question_identity_map with (security_invoker = true)'
    );
    expect(sql).toContain(
      'create table private.admin_writing_historical_identity_aliases'
    );
    expect(sql).toContain(
      'from public.topik_writing_problem_question_map alias join public.topik_writing_question_recommendation_view canonical'
    );
    expect(sql).toContain("alias.mapping_status = 'active'");
    expect(sql).toContain(
      'where current_identity.problem_id = alias.problem_id'
    );
    expect(sql).toContain(
      'alter table private.admin_writing_historical_identity_aliases force row level security'
    );
    expect(sql).toContain('from private.admin_writing_question_metadata metadata');
    expect(sql).toContain("'canonical'::text as mapping_kind");
    expect(sql).toContain("'legacy'::text as mapping_kind");
    expect(sql).toContain("'active'::text as mapping_status");
  });

  it('rewrites every mirror dependency while keeping the latest coverage CTEs', () => {
    const rewritten = latestCoverage
      .replaceAll(
        'from public.topik_writing_problem_question_map pm',
        'from private.admin_writing_question_identity_map pm'
      )
      .replaceAll(
        'public.problems mapped_problem',
        'private.admin_writing_problem_identity_projection mapped_problem'
      )
      .replaceAll(
        'public.problems problem',
        'private.admin_writing_problem_identity_projection problem'
      )
      .replaceAll(
        'public.problems source_problem',
        'private.admin_writing_problem_identity_projection source_problem'
      )
      .replaceAll('problem.id', 'problem.problem_id')
      .replaceAll('problem.question_no', 'problem.item_number');

    expect(latestCoverage).toContain('submission_metadata_facts as');
    expect(latestCoverage).toContain('event_metadata_coverage as');
    expect(rewritten).not.toContain('join public.problems problem');
    expect(rewritten).not.toContain('join public.problems mapped_problem');
    expect(rewritten).not.toContain('join public.problems source_problem');
    expect(rewritten).not.toContain('public.topik_writing_problem_question_map');
    expect(rewritten).toContain(
      'private.admin_writing_problem_identity_projection problem'
    );
    expect(rewritten).toContain(
      'private.admin_writing_problem_identity_projection source_problem'
    );
    expect(rewritten).toContain('problem.item_number = any(v_question_nos)');
    expect(rewritten).toContain('metadata_coverage as');
    expect(rewritten).toContain('event_metadata_coverage as');
  });

  it('fails closed if the source definition or rewritten result drifts', () => {
    expect(sql).toContain(
      'unexpected coverage analytics definition; refusing canonical rewrite'
    );
    expect(sql).toContain('coverage analytics canonical rewrite incomplete');
    expect(sql).toContain("position('public.problems' in v_definition) > 0");
    expect(sql).toContain("position('problem.item_number' in v_definition) = 0");
  });

  it('does not mutate learner-owned data and restores the captured function before dropping helpers', () => {
    expect(sql).not.toMatch(
      /(?:insert\s+into|update|delete\s+from|alter\s+table)\s+public\.(?:writing_submissions|writing_feedback|problems|study_events)/
    );
    expect(down).toContain('execute v_definition');
    expect(down.indexOf('execute v_definition')).toBeLessThan(
      down.indexOf('drop view private.admin_writing_problem_identity_projection')
    );
    expect(down).toContain(
      'drop table private.admin_writing_historical_identity_aliases'
    );
    expect(down).toContain(
      'drop table private.admin_writing_analytics_coverage_rollback_function'
    );
  });
});
