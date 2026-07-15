import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';
import { describe, expect, it } from 'vitest';

const migrationPath = join(
  cwd(),
  'supabase',
  'migrations',
  '20260713080015_topik_writing_canonical_read_contract.sql'
);
const downMigrationPath = join(
  cwd(),
  'supabase',
  'migrations',
  'down',
  '20260713080015_topik_writing_canonical_read_contract.sql'
);

const sql = readFileSync(migrationPath, 'utf8');
const normalized = sql.replace(/\s+/g, ' ').toLowerCase();

function section(start, end) {
  const from = normalized.indexOf(start);
  const to = normalized.indexOf(end, from + start.length);
  expect(from).toBeGreaterThanOrEqual(0);
  expect(to).toBeGreaterThan(from);
  return normalized.slice(from, to);
}

describe('canonical writing learner read contract', () => {
  it('derives an immutable learner identity without rewriting legacy provenance', () => {
    expect(normalized).toContain(
      'add column if not exists learner_problem_id uuid generated always as (md5(question_id)::uuid) stored'
    );
    expect(normalized).toContain(
      "attribute.attgenerated, pg_get_expr(definition.adbin, definition.adrelid)"
    );
    expect(normalized).toContain(
      "raise exception 'writing_learner_problem_id_definition_incompatible'"
    );
    expect(normalized).toContain(
      'add constraint topik_writing_source_map_learner_problem_id_key unique (learner_problem_id)'
    );
    expect(normalized).toContain(
      'before update of question_id on public.topik_writing_question_source_map'
    );
    expect(normalized).toContain('writing_question_id_immutable');

    const backfill = section(
      '), resolved as (',
      '-- fail closed if any exact-version pointer'
    );
    expect(backfill).not.toContain('legacy_problem_id');
    expect(backfill).not.toContain('default_problem_id');
  });

  it('recursively reconstructs Q53 charts from explicit learner-safe keys', () => {
    const chartBuilder = section(
      'create or replace function private.build_writing_learner_chart',
      'create or replace view private.topik_writing_question_learner_projection'
    );
    const projection = section(
      'create or replace view private.topik_writing_question_learner_projection',
      'create or replace function private.assert_writing_canonical_content_parity'
    );

    const rootKeys = [...chartBuilder.matchAll(/p_chart->'(\w+)'/g)].map(
      (match) => match[1]
    );
    const seriesKeys = [
      ...chartBuilder.matchAll(/series_value\.value->'(\w+)'/g)
    ].map((match) => match[1]);

    expect(new Set(rootKeys)).toEqual(
      new Set(['chart_type', 'title', 'unit', 'year_range', 'series'])
    );
    expect(new Set(seriesKeys)).toEqual(new Set(['label', 'values']));
    expect(chartBuilder).toContain("jsonb_typeof(point_value.value) = 'number'");
    expect(projection).toContain(
      "'chart_a', private.build_writing_learner_chart(q.source_data->'chart_a')"
    );
    expect(projection).toContain(
      "'chart_b', private.build_writing_learner_chart(q.source_data->'chart_b')"
    );
    expect(projection).not.toContain("'chart_a', q.source_data->'chart_a'");
    expect(projection).not.toContain("'chart_b', q.source_data->'chart_b'");
  });

  it('projects only explicitly learner-safe typed fields', () => {
    const projection = section(
      'create or replace view private.topik_writing_question_learner_projection',
      'create or replace function private.assert_writing_canonical_content_parity'
    );

    expect(projection).toContain('with (security_invoker = true)');
    expect(projection).toContain("'charts'");
    expect(projection).not.toContain("'source_data',");
    for (const forbidden of [
      'resolved_text',
      'model_answer',
      'answer_key',
      'canonical_answer',
      'accepted_answers',
      'accepted_synonyms',
      'target_note',
      'key_findings',
      'scoring_notes',
      'scoring_focus',
      'model_outline',
      "'rubric'",
      'content_team_memo',
      'raw_payload',
      'raw_response_text'
    ]) {
      expect(projection).not.toContain(forbidden);
    }
  });

  it('fails closed when a pinned typed row differs from its promoted inbox payload', () => {
    const parityGuard = section(
      'create or replace function private.assert_writing_canonical_content_parity',
      'create or replace function private.is_writing_question_visible_to_user'
    );

    expect(parityGuard).toContain('to_jsonb(official) is distinct from to_jsonb(');
    expect(parityGuard).toContain('jsonb_populate_record(');
    expect(parityGuard).toContain('import_row.raw_payload || jsonb_build_object(');
    expect(parityGuard).toContain("import_row.mapping_status = 'promoted'");
    expect(parityGuard).toContain('canonical_typed_import_content_mismatch');
    expect(normalized).toContain(
      'select private.assert_writing_canonical_content_parity()'
    );
  });

  it('orders tags deterministically for exact snapshot comparison', () => {
    expect(normalized).toContain(
      'order by first_order, tag_value collate "c"'
    );
  });

  it('derives caller identity from auth.uid and keeps detail/list on one predicate', () => {
    const learnerRpc = section(
      'create or replace function public.get_available_writing_questions',
      'create or replace function private.assert_writing_question_submittable'
    );

    expect(learnerRpc).toContain('security definer');
    expect(learnerRpc).toContain('set search_path = pg_catalog, public, private');
    expect(learnerRpc).toContain('auth.uid()');
    expect(learnerRpc).toContain('private.is_writing_question_visible_to_user(');
    expect(learnerRpc).toContain('(p_problem_id is null or sm.learner_problem_id = p_problem_id)');
    expect(learnerRpc).toContain('sm.learner_problem_id');
    expect(learnerRpc).toContain("imp.raw_payload->>'topic_seed_title'");
    expect(learnerRpc).toContain(
      "imp.raw_payload#>>'{approved_topic_seed,topic_seed_title}'"
    );
    expect(learnerRpc).toContain(
      "imp.raw_payload#>>'{scenario_logic,scenario_title}'"
    );
    expect(learnerRpc).not.toContain('sm.legacy_problem_id');
    expect(learnerRpc).not.toContain('p_user_id');
    expect(learnerRpc).not.toContain('p_affiliation_code');
  });

  it('grants learner and grading interfaces to mutually exclusive roles', () => {
    expect(normalized).toContain(
      'grant execute on function public.get_available_writing_questions(smallint, uuid) to authenticated'
    );
    expect(normalized).toContain(
      'revoke all on function public.get_available_writing_questions(smallint, uuid) from anon'
    );
    expect(normalized).toContain(
      'revoke all on function public.get_available_writing_questions(smallint, uuid) from service_role'
    );
    expect(normalized).toContain(
      'grant execute on function public.get_writing_question_grading_payload(text, bigint) to service_role'
    );
    expect(normalized).toContain(
      'revoke all on function public.get_writing_question_grading_payload(text, bigint) from authenticated'
    );
    expect(normalized).toContain(
      'grant execute on function private.assert_writing_question_submittable(uuid, text, bigint, text, smallint, uuid) to service_role'
    );
    expect(normalized).toContain(
      'revoke all on function private.assert_writing_question_submittable(uuid, text, bigint, text, smallint, uuid) from authenticated'
    );
  });

  it('validates exact version, current availability, and institution exposure before submission', () => {
    const guard = section(
      'create or replace function private.assert_writing_question_submittable',
      'create or replace function public.get_writing_question_grading_payload'
    );

    expect(guard).toContain('sm.learner_problem_id = p_problem_id');
    expect(guard).not.toContain('sm.legacy_problem_id');
    expect(guard).toContain('sm.canonical_import_id = p_canonical_import_id');
    expect(guard).toContain('imp.payload_hash = p_payload_hash');
    expect(guard).toContain("q.service_status = 'available'");
    expect(guard).toContain('private.is_writing_question_visible_to_user(');
  });

  it('pins the official row to an exact promoted import instead of is_latest', () => {
    const learnerRpc = section(
      'create or replace function public.get_available_writing_questions',
      'create or replace function public.get_writing_question_grading_payload'
    );

    expect(learnerRpc).toContain('sm.canonical_import_id');
    expect(learnerRpc).toContain('imp.source_task_id = q.question_id');
    expect(learnerRpc).toContain('imp.promoted_question_id = q.question_id');
    expect(learnerRpc).toContain('imp.item_number = q.item_number');
    expect(learnerRpc).toContain("imp.mapping_status = 'promoted'");
    expect(learnerRpc).not.toContain('imp.is_latest');
  });

  it('backfills and anchors only identities with provable import parity', () => {
    const backfill = section(
      '), resolved as (',
      '-- fail closed if any exact-version pointer'
    );
    const anchorBackfill = section(
      "if to_regprocedure('private.ensure_writing_problem_anchor(uuid,text,smallint)') is null then",
      'create or replace function public.admin_promote_writing_questions'
    );

    expect(backfill).toContain('imp.source_task_id = q.question_id');
    expect(backfill).toContain('imp.promoted_question_id = q.question_id');
    expect(backfill).toContain('imp.item_number = q.item_number');
    expect(backfill).toContain('where r.canonical_import_id is not null');
    expect(normalized).toContain('canonical source-map parity violation');
    expect(normalized).toContain(
      'sm.learner_problem_id is distinct from md5(sm.question_id)::uuid'
    );
    expect(anchorBackfill).toContain('sm.learner_problem_id is not null');
    expect(anchorBackfill).not.toContain('sm.legacy_problem_id');
    expect(anchorBackfill).toContain('sm.canonical_import_id is not null');
    expect(anchorBackfill).toContain('imp.source_task_id = sm.question_id');
    expect(anchorBackfill).toContain('imp.promoted_question_id = sm.question_id');
    expect(anchorBackfill).toContain('imp.item_number = sm.item_number');
  });

  it('keeps data rows during interface rollback', () => {
    const down = readFileSync(downMigrationPath, 'utf8').toLowerCase();
    expect(down).not.toMatch(
      /delete\s+from\s+public\.topik_writing_question_(source_map|import)/
    );
    expect(down).not.toMatch(/drop\s+table/);
    expect(down).not.toContain('drop column');
    expect(down).not.toContain(
      'drop trigger if exists topik_writing_source_map_question_id_immutable'
    );
    expect(down).toContain(
      'drop function if exists private.build_writing_learner_chart(jsonb)'
    );
  });

  it('does not infer canonical versions for historical learner records', () => {
    expect(normalized).not.toMatch(
      /(?:insert\s+into|update)\s+public\.(?:writing_submissions|writing_drafts)/
    );
  });
});
