import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import {
  RECONCILIATION_LOCK_KEY,
  buildApplySql,
  buildCandidateSql,
  buildReconciliationManifest,
  buildRestoreSql,
  candidateFingerprint,
  sha256,
  verifyManifest,
} from '../../scripts/etl/lib/learning-analytics-reconciliation-core.mjs';

const GENERATED_AT = '2026-07-13T00:00:00.000Z';
const PROJECT_REF = 'fglggyfvzjdsbyckinqa';
const BATCH = 'analytics-learning-2026-07-13';

const SNAPSHOT = [
  {
    table_name: 'writing_submissions',
    rows: 280,
    hash: 'submissions-hash',
    protected: true,
  },
  {
    table_name: 'study_events',
    rows: 91,
    hash: 'events-hash',
    protected: true,
  },
  {
    table_name: 'topik_writing_question_source_map',
    rows: 700,
    hash: 'source-map-hash',
    protected: false,
  },
  {
    table_name: 'topik_writing_problem_aliases',
    rows: 0,
    hash: 'empty-alias-hash',
    protected: false,
  },
];

function md5Uuid(value) {
  const hex = createHash('md5').update(value).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function candidate(questionId, overrides = {}) {
  const itemNumber = overrides.item_number ?? 51;
  return {
    question_id: questionId,
    item_number: itemNumber,
    expected_problem_id: md5Uuid(questionId),
    problem_exists: true,
    exact_match: true,
    metadata_complete: true,
    input_fingerprint: createHash('md5').update(`${itemNumber}:${questionId}`).digest('hex'),
    has_submission: true,
    has_event: false,
    canonical_question_id: null,
    source_map_question_id: questionId,
    source_map_item_number: itemNumber,
    existing_question_id: null,
    existing_alias_kind: null,
    existing_source: null,
    existing_backfill_batch: null,
    existing_mapping_status: null,
    existing_hold_reason: null,
    existing_match_hash: null,
    ...overrides,
  };
}

function manifestFor(candidates) {
  return buildReconciliationManifest({
    projectRef: PROJECT_REF,
    batch: BATCH,
    snapshot: SNAPSHOT,
    candidates,
    generatedAt: GENERATED_AT,
  });
}

describe('learning analytics metadata reconciliation classification', () => {
  it('classifies deterministic 0700-style candidates as canonical, alias, or source-map anchor deterministically', () => {
    const canonical = candidate('topik-writing-51-0700', {
      canonical_question_id: 'topik-writing-51-0700',
      has_event: true,
    });
    const existingAlias = candidate('topik-writing-51-0701', {
      existing_question_id: 'topik-writing-51-0701',
      existing_alias_kind: 'historical',
      existing_source: 'prior-reconciliation',
      existing_backfill_batch: 'prior-batch',
      existing_mapping_status: 'active',
      existing_match_hash: 'a'.repeat(64),
    });
    const missingAnchor = candidate('topik-writing-51-0702', {
      source_map_question_id: null,
      source_map_item_number: null,
      has_submission: false,
      has_event: true,
    });

    const forward = manifestFor([missingAnchor, canonical, existingAlias]);
    const reversed = manifestFor([existingAlias, canonical, missingAnchor]);

    expect(forward.canonical).toEqual([
      {
        problemId: md5Uuid('topik-writing-51-0700'),
        questionId: 'topik-writing-51-0700',
        questionNo: 51,
      },
    ]);
    expect(forward.desiredAliases).toHaveLength(2);
    expect(forward.desiredAliases.map((row) => row.questionId).sort()).toEqual([
      'topik-writing-51-0701',
      'topik-writing-51-0702',
    ]);
    expect(forward.desiredAliases.every((row) => (
      row.aliasKind === 'environment_reseed'
      && row.source === 'exact_prompt_answer_hash'
      && row.mappingStatus === 'active'
      && row.holdReason === null
      && /^[0-9a-f]{64}$/.test(row.matchHash)
    ))).toBe(true);
    expect(forward.sourceMapAnchors).toEqual([
      {
        questionId: 'topik-writing-51-0702',
        itemNumber: 51,
        backfillBatch: BATCH,
      },
    ]);
    expect(forward.beforeAliases).toEqual([
      {
        problemId: md5Uuid('topik-writing-51-0701'),
        questionId: 'topik-writing-51-0701',
        aliasKind: 'historical',
        source: 'prior-reconciliation',
        backfillBatch: 'prior-batch',
        mappingStatus: 'active',
        holdReason: null,
        matchHash: 'a'.repeat(64),
      },
    ]);
    expect(forward.counts).toEqual({
      metadataQuestions: 3,
      referencedProblems: 3,
      submissionProblems: 2,
      eventProblems: 2,
      canonical: 1,
      aliases: 2,
      sourceMapAnchors: 1,
      holds: 0,
    });
    expect(forward.candidateHash).toBe(candidateFingerprint([canonical, existingAlias, missingAnchor]));
    expect(forward.candidateHash).toBe(reversed.candidateHash);
    expect(forward.manifestHash).toBe(reversed.manifestHash);
  });

  it.each([
    ['deterministic_problem_missing', { problem_exists: false }],
    ['prompt_answer_hash_conflict', { exact_match: false }],
    ['missing_required_dimension', { metadata_complete: false }],
    ['source_map_item_number_conflict', { source_map_item_number: 52 }],
    ['existing_alias_held', {
      existing_question_id: 'topik-writing-51-0700',
      existing_alias_kind: 'environment_reseed',
      existing_source: 'exact_prompt_answer_hash',
      existing_backfill_batch: 'prior-batch',
      existing_mapping_status: 'held',
      existing_hold_reason: 'manual_review',
      existing_match_hash: 'c'.repeat(64),
    }],
    ['canonical_conflict', { canonical_question_id: 'topik-writing-51-0998' }],
    ['alias_conflict', {
      existing_question_id: 'topik-writing-51-0999',
      existing_alias_kind: 'historical',
      existing_source: 'prior-reconciliation',
      existing_backfill_batch: 'prior-batch',
      existing_mapping_status: 'active',
      existing_match_hash: 'b'.repeat(64),
    }],
  ])('holds an unsafe candidate with reason %s', (reasonCode, overrides) => {
    const result = manifestFor([candidate('topik-writing-51-0700', overrides)]);

    expect(result.desiredAliases).toEqual([]);
    expect(result.canonical).toEqual([]);
    expect(result.sourceMapAnchors).toEqual([]);
    expect(result.holds).toEqual([
      expect.objectContaining({
        problemId: md5Uuid('topik-writing-51-0700'),
        questionNo: 51,
        hasSubmission: true,
        hasEvent: false,
        reasonCode,
      }),
    ]);
    expect(result.counts.holds).toBe(1);
  });

  it('uses stable hold precedence when a deterministic candidate violates multiple guards', () => {
    const result = manifestFor([candidate('topik-writing-51-0700', {
      problem_exists: false,
      exact_match: false,
      metadata_complete: false,
      source_map_item_number: 54,
      canonical_question_id: 'topik-writing-51-0998',
      existing_question_id: 'topik-writing-51-0999',
      existing_mapping_status: 'active',
      existing_hold_reason: null,
    })]);

    expect(result.holds[0].reasonCode).toBe('deterministic_problem_missing');
  });

  it('never reactivates an existing held alias during a rerun', () => {
    const result = manifestFor([candidate('topik-writing-51-0700', {
      existing_question_id: 'topik-writing-51-0700',
      existing_alias_kind: 'environment_reseed',
      existing_source: 'exact_prompt_answer_hash',
      existing_backfill_batch: 'prior-batch',
      existing_mapping_status: 'held',
      existing_hold_reason: 'manual_review',
      existing_match_hash: 'd'.repeat(64),
    })]);

    expect(result.desiredAliases).toEqual([]);
    expect(result.holds).toEqual([
      expect.objectContaining({ reasonCode: 'existing_alias_held' }),
    ]);
    expect(result.beforeAliases[0]).toEqual(expect.objectContaining({
      mappingStatus: 'held',
      holdReason: 'manual_review',
    }));
  });

  it('detects manifest payload tampering and rejects hash-valid malformed manifests', () => {
    const valid = manifestFor([candidate('topik-writing-51-0700')]);
    expect(verifyManifest(valid)).toBe(valid);

    expect(() => verifyManifest({ ...valid, batch: 'tampered-batch' }))
      .toThrow('manifest hash mismatch');

    const { manifestHash: _ignored, ...payload } = valid;
    const malformedPayload = { ...payload, desiredAliases: 'not-an-array' };
    const malformed = { ...malformedPayload, manifestHash: sha256(malformedPayload) };
    expect(() => verifyManifest(malformed)).toThrow('invalid reconciliation manifest');
  });
});

describe('learning analytics reconciliation SQL contracts', () => {
  it('builds deterministic candidates from exact numbered metadata and protected learning references', () => {
    const sql = buildCandidateSql();

    expect(sql).toContain('md5(m.question_id)::uuid as expected_problem_id');
    expect(sql).toContain('left join public.problems p on p.id = md5(m.question_id)::uuid');
    expect(sql).toContain("regexp_replace(lower(trim(p.prompt)), '\\s+', ' ', 'g')");
    expect(sql).toContain("coalesce(p.answer_key, 'null'::jsonb) = coalesce(m.answer_key, 'null'::jsonb)");
    expect(sql).toContain('select ws.problem_id, true as has_submission, false as has_event');
    expect(sql).toContain('select coalesce(se.problem_id, ws.problem_id), false, true');
    expect(sql).toContain("where se.event_type <> 'export_downloaded'");
    expect(sql).toContain('q.blank_1_role is not null');
    expect(sql).toContain('q.connection_function is not null');
    expect(sql).toContain('q.data_type is not null');
    expect(sql).toContain('q.essay_type is not null');
  });

  it('builds one atomic apply batch with advisory lock, baseline guards, anchors, idempotent aliases, and fan-out protection', () => {
    const row = candidate('topik-writing-51-0700', {
      source_map_question_id: null,
      source_map_item_number: null,
    });
    const sql = buildApplySql(manifestFor([row]));

    expect(sql.trim().startsWith('begin;')).toBe(true);
    expect(sql.trim().endsWith('commit;')).toBe(true);
    expect(sql).toContain(`pg_advisory_xact_lock(hashtext('${RECONCILIATION_LOCK_KEY}'))`);
    expect(sql).toContain("raise exception 'reconciliation baseline drift: writing_submissions'");
    expect(sql).toContain("'{\"rows\":280,\"hash\":\"submissions-hash\"}'::jsonb");
    expect(sql).toContain('insert into public.topik_writing_question_source_map');
    expect(sql).toContain('on conflict (question_id) do nothing');
    expect(sql).toContain('insert into public.topik_writing_problem_aliases');
    expect(sql).toContain('on conflict (problem_id) do update set');
    expect(sql).toContain('is distinct from');
    expect(sql).toContain('group by problem_id having count(distinct question_id) > 1');
    expect(sql).toContain("raise exception 'problem_id fan-out detected after reconciliation'");

    const beginIndex = sql.indexOf('begin;');
    const lockIndex = sql.indexOf('pg_advisory_xact_lock');
    const baselineIndex = sql.indexOf('reconciliation baseline drift');
    const anchorIndex = sql.indexOf('insert into public.topik_writing_question_source_map');
    const aliasIndex = sql.indexOf('insert into public.topik_writing_problem_aliases');
    const fanOutIndex = sql.indexOf('problem_id fan-out detected after reconciliation');
    const commitIndex = sql.lastIndexOf('commit;');
    expect(lockIndex).toBeGreaterThan(beginIndex);
    expect(baselineIndex).toBeGreaterThan(lockIndex);
    expect(anchorIndex).toBeGreaterThan(baselineIndex);
    expect(aliasIndex).toBeGreaterThan(anchorIndex);
    expect(fanOutIndex).toBeGreaterThan(aliasIndex);
    expect(commitIndex).toBeGreaterThan(fanOutIndex);

    expect(sql).not.toMatch(/(?:insert into|update|delete from) public\.(?:writing_submissions|writing_feedback|feedback_dimension_scores|study_events|problems)\b/i);
  });

  it('blocks apply when any candidate is held or when a baseline table is unknown', () => {
    const held = manifestFor([candidate('topik-writing-51-0700', { exact_match: false })]);
    expect(() => buildApplySql(held)).toThrow('cannot apply with 1 hold(s)');

    const valid = manifestFor([candidate('topik-writing-51-0700')]);
    expect(() => buildApplySql({
      ...valid,
      snapshot: [{ table_name: 'untrusted_table', rows: 1, hash: 'x', protected: false }],
    })).toThrow('unknown snapshot table: untrusted_table');
  });

  it('builds an atomic drift-guarded restore that reinstates before images and removes only safe created anchors', () => {
    const applied = manifestFor([candidate('topik-writing-51-0700', {
      source_map_question_id: null,
      source_map_item_number: null,
      existing_question_id: 'topik-writing-51-0700',
      existing_alias_kind: 'historical',
      existing_source: 'prior-reconciliation',
      existing_backfill_batch: 'prior-batch',
      existing_mapping_status: 'active',
      existing_match_hash: 'c'.repeat(64),
    })]);
    const sql = buildRestoreSql({
      beforeAliases: applied.beforeAliases,
      appliedAliases: applied.desiredAliases,
      createdSourceMapAnchors: applied.sourceMapAnchors,
    });

    expect(sql.trim().startsWith('begin;')).toBe(true);
    expect(sql.trim().endsWith('commit;')).toBe(true);
    expect(sql).toContain(`pg_advisory_xact_lock(hashtext('${RECONCILIATION_LOCK_KEY}'))`);
    expect(sql).toContain('create temporary table expected_learning_aliases');
    expect(sql).toContain('except select * from expected_learning_aliases');
    expect(sql).toContain("raise exception 'restore current alias drift'");
    expect(sql).toContain('delete from public.topik_writing_problem_aliases where problem_id in');
    expect(sql).toContain("'prior-reconciliation'");
    expect(sql).toContain('insert into public.topik_writing_problem_aliases');
    expect(sql).toContain('delete from public.topik_writing_question_source_map sm');
    expect(sql).toContain('sm.legacy_problem_id is null');
    expect(sql).toContain('sm.published_task_id is null');
    expect(sql).toContain('sm.hold_reason is null');
    expect(sql).toMatch(/not exists \([\s\S]*?alias\.question_id = sm\.question_id/);
  });

  it('rejects a restore without explicit alias targets', () => {
    expect(() => buildRestoreSql({ beforeAliases: [], appliedAliases: [] }))
      .toThrow('restore payload has no alias targets');
  });
});
