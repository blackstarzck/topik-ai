import { createHash } from 'node:crypto';

export const RECONCILIATION_LOCK_KEY = 'topik-writing:learning-analytics-metadata-reconciliation:v1';

export const SNAPSHOT_TABLES = [
  { name: 'writing_submissions', orderBy: 'id', protected: true },
  { name: 'writing_feedback', orderBy: 'submission_id', protected: true },
  { name: 'feedback_dimension_scores', orderBy: 'submission_id', protected: true },
  { name: 'study_events', orderBy: 'id', protected: true },
  {
    name: 'problems',
    orderBy: 'id',
    protected: true,
    rowExpression: 'jsonb_build_array(t.id, t.question_no, t.prompt, t.answer_key)',
  },
  { name: 'topik_writing_51_questions', orderBy: 'question_id', protected: true },
  { name: 'topik_writing_52_questions', orderBy: 'question_id', protected: true },
  { name: 'topik_writing_53_questions', orderBy: 'question_id', protected: true },
  { name: 'topik_writing_54_questions', orderBy: 'question_id', protected: true },
  { name: 'topik_writing_question_source_map', orderBy: 'question_id', protected: false },
  { name: 'topik_writing_problem_aliases', orderBy: 'problem_id', protected: false },
];

function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortValue(value[key])]));
  }
  return value;
}

export function stableStringify(value) {
  return JSON.stringify(sortValue(value));
}

export function sha256(value) {
  return createHash('sha256').update(typeof value === 'string' ? value : stableStringify(value)).digest('hex');
}

export function sqlLiteral(value) {
  if (value == null) return 'null';
  return `'${String(value).replaceAll("'", "''")}'`;
}

function normalizeAlias(row) {
  return {
    problemId: row.problem_id,
    questionId: row.question_id,
    aliasKind: row.alias_kind,
    source: row.source,
    backfillBatch: row.backfill_batch,
    mappingStatus: row.mapping_status,
    holdReason: row.hold_reason ?? null,
    matchHash: row.match_hash,
  };
}

export function candidateFingerprint(rows) {
  return sha256(rows.map((row) => ({
    problemId: row.expected_problem_id,
    questionId: row.question_id,
    questionNo: Number(row.item_number),
    hasSubmission: Boolean(row.has_submission),
    hasEvent: Boolean(row.has_event),
    problemExists: Boolean(row.problem_exists),
    exactMatch: Boolean(row.exact_match),
    metadataComplete: Boolean(row.metadata_complete),
    inputFingerprint: row.input_fingerprint,
    canonicalQuestionId: row.canonical_question_id ?? null,
    sourceMapQuestionId: row.source_map_question_id ?? null,
    sourceMapItemNumber: row.source_map_item_number == null ? null : Number(row.source_map_item_number),
    existingAlias: row.existing_question_id ? {
      questionId: row.existing_question_id,
      aliasKind: row.existing_alias_kind,
      source: row.existing_source,
      backfillBatch: row.existing_backfill_batch,
      mappingStatus: row.existing_mapping_status,
      holdReason: row.existing_hold_reason ?? null,
      matchHash: row.existing_match_hash,
    } : null,
  })).sort((a, b) => a.problemId.localeCompare(b.problemId)));
}

export function buildReconciliationManifest({ projectRef, batch, snapshot, candidates, generatedAt }) {
  const desiredAliases = [];
  const beforeAliases = [];
  const sourceMapAnchors = [];
  const canonical = [];
  const holds = [];

  for (const row of candidates) {
    const problemId = row.expected_problem_id;
    const questionId = row.question_id;
    const canonicalQuestionId = row.canonical_question_id ?? null;
    const existingQuestionId = row.existing_question_id ?? null;

    if (existingQuestionId) {
      beforeAliases.push(normalizeAlias({
        problem_id: problemId,
        question_id: existingQuestionId,
        alias_kind: row.existing_alias_kind,
        source: row.existing_source,
        backfill_batch: row.existing_backfill_batch,
        mapping_status: row.existing_mapping_status,
        hold_reason: row.existing_hold_reason,
        match_hash: row.existing_match_hash,
      }));
    }

    let reasonCode = null;
    if (
      existingQuestionId
      && (row.existing_mapping_status !== 'active' || row.existing_hold_reason != null)
    ) reasonCode = 'existing_alias_held';
    else if (!row.problem_exists) reasonCode = 'deterministic_problem_missing';
    else if (!row.exact_match) reasonCode = 'prompt_answer_hash_conflict';
    else if (!row.metadata_complete) reasonCode = 'missing_required_dimension';
    else if (row.source_map_item_number != null && Number(row.source_map_item_number) !== Number(row.item_number)) reasonCode = 'source_map_item_number_conflict';
    else if (canonicalQuestionId && canonicalQuestionId !== questionId) reasonCode = 'canonical_conflict';
    else if (existingQuestionId && existingQuestionId !== questionId) reasonCode = 'alias_conflict';

    if (reasonCode) {
      holds.push({
        problemId,
        questionNo: Number(row.item_number),
        hasSubmission: Boolean(row.has_submission),
        hasEvent: Boolean(row.has_event),
        reasonCode,
        inputFingerprint: row.input_fingerprint,
      });
      continue;
    }

    if (!row.source_map_question_id) {
      sourceMapAnchors.push({ questionId, itemNumber: Number(row.item_number), backfillBatch: batch });
    }

    if (canonicalQuestionId === questionId) {
      canonical.push({ problemId, questionId, questionNo: Number(row.item_number) });
      continue;
    }

    const matchHash = sha256(`${row.item_number}:${row.input_fingerprint}:${questionId}`);
    desiredAliases.push({
      problemId,
      questionId,
      aliasKind: 'environment_reseed',
      source: 'exact_prompt_answer_hash',
      backfillBatch: batch,
      mappingStatus: 'active',
      holdReason: null,
      matchHash,
    });
  }

  desiredAliases.sort((a, b) => a.problemId.localeCompare(b.problemId));
  beforeAliases.sort((a, b) => a.problemId.localeCompare(b.problemId));
  sourceMapAnchors.sort((a, b) => a.questionId.localeCompare(b.questionId));
  canonical.sort((a, b) => a.problemId.localeCompare(b.problemId));
  holds.sort((a, b) => a.problemId.localeCompare(b.problemId));

  const manifest = {
    schemaVersion: 1,
    projectRef,
    generatedAt,
    batch,
    scope: 'all-time referenced TOPIK writing problems (submissions + non-PDF study events)',
    snapshot,
    snapshotHash: sha256(snapshot),
    protectedSnapshotHash: sha256(snapshot.filter((row) => row.protected)),
    candidateHash: candidateFingerprint(candidates),
    counts: {
      metadataQuestions: candidates.length,
      referencedProblems: candidates.filter((row) => row.has_submission || row.has_event).length,
      submissionProblems: candidates.filter((row) => row.has_submission).length,
      eventProblems: candidates.filter((row) => row.has_event).length,
      canonical: canonical.length,
      aliases: desiredAliases.length,
      sourceMapAnchors: sourceMapAnchors.length,
      holds: holds.length,
    },
    canonical,
    desiredAliases,
    beforeAliases,
    sourceMapAnchors,
    holds,
  };
  return { ...manifest, manifestHash: sha256(manifest) };
}

export function verifyManifest(manifest) {
  const { manifestHash, ...payload } = manifest;
  if (!manifestHash || sha256(payload) !== manifestHash) {
    throw new Error('manifest hash mismatch');
  }
  if (!Array.isArray(manifest.desiredAliases) || !Array.isArray(manifest.beforeAliases)) {
    throw new Error('invalid reconciliation manifest');
  }
  return manifest;
}

function signatureExpression(table) {
  const rowExpression = table.rowExpression ?? 'to_jsonb(t)';
  return `(select jsonb_build_object(
    'rows', count(*)::integer,
    'hash', md5(coalesce(string_agg(md5((${rowExpression})::text), ',' order by t.${table.orderBy}), ''))
  ) from public.${table.name} t)`;
}

export function buildSnapshotSql() {
  return SNAPSHOT_TABLES.map((table) => `select ${sqlLiteral(table.name)} as table_name,
    (${signatureExpression(table)}->>'rows')::integer as rows,
    ${signatureExpression(table)}->>'hash' as hash,
    ${table.protected ? 'true' : 'false'} as protected`).join('\nunion all\n') + '\norder by table_name;';
}

export function buildCandidateSql() {
  return `with metadata as (
    select q.question_id, 51::smallint as item_number, q.prompt_text, q.answer_key,
      (q.topic_main is not null and q.topic_detail is not null
       and q.blank_1_role is not null and q.blank_1_function is not null
       and q.blank_1_answer_type is not null and q.blank_2_role is not null
       and q.blank_2_function is not null and q.blank_2_answer_type is not null) as metadata_complete
    from public.topik_writing_51_questions q
    union all
    select q.question_id, 52::smallint, q.prompt_text, q.answer_key,
      (q.topic_main is not null and q.topic_detail is not null
       and q.connection_function is not null and q.answer_scope_type is not null)
    from public.topik_writing_52_questions q
    union all
    select q.question_id, 53::smallint, q.prompt_text, q.answer_key,
      (q.topic_main is not null and q.topic_detail is not null
       and q.data_type is not null and q.required_structure is not null)
    from public.topik_writing_53_questions q
    union all
    select q.question_id, 54::smallint, q.prompt_text, q.answer_key,
      (q.topic_main is not null and q.topic_detail is not null
       and q.essay_type is not null and q.stance_requirement is not null
       and q.required_structure is not null)
    from public.topik_writing_54_questions q
  ), referenced as (
    select ws.problem_id, true as has_submission, false as has_event
    from public.writing_submissions ws
    where ws.question_no between 51 and 54
    union all
    select coalesce(se.problem_id, ws.problem_id), false, true
    from public.study_events se
    left join public.writing_submissions ws on ws.id = se.submission_id
    join public.problems p on p.id = coalesce(se.problem_id, ws.problem_id)
    where se.event_type <> 'export_downloaded' and p.question_no between 51 and 54
  ), references_by_problem as (
    select problem_id, bool_or(has_submission) as has_submission, bool_or(has_event) as has_event
    from referenced where problem_id is not null group by problem_id
  )
  select
    m.question_id,
    m.item_number,
    md5(m.question_id)::uuid as expected_problem_id,
    (p.id is not null) as problem_exists,
    (p.id is not null
      and p.question_no = m.item_number
      and md5(regexp_replace(lower(trim(p.prompt)), '\\s+', ' ', 'g')) = md5(regexp_replace(lower(trim(m.prompt_text)), '\\s+', ' ', 'g'))
      and coalesce(p.answer_key, 'null'::jsonb) = coalesce(m.answer_key, 'null'::jsonb)) as exact_match,
    m.metadata_complete,
    md5(m.item_number::text || ':' || regexp_replace(lower(trim(m.prompt_text)), '\\s+', ' ', 'g') || ':' || coalesce(m.answer_key::text, 'null')) as input_fingerprint,
    coalesce(refs.has_submission, false) as has_submission,
    coalesce(refs.has_event, false) as has_event,
    canonical.question_id as canonical_question_id,
    source_map.question_id as source_map_question_id,
    source_map.item_number as source_map_item_number,
    alias.question_id as existing_question_id,
    alias.alias_kind as existing_alias_kind,
    alias.source as existing_source,
    alias.backfill_batch as existing_backfill_batch,
    alias.mapping_status as existing_mapping_status,
    alias.hold_reason as existing_hold_reason,
    alias.match_hash as existing_match_hash
  from metadata m
  left join public.problems p on p.id = md5(m.question_id)::uuid
  left join references_by_problem refs on refs.problem_id = p.id
  left join public.topik_writing_question_source_map canonical
    on canonical.legacy_problem_id = md5(m.question_id)::uuid
  left join public.topik_writing_question_source_map source_map
    on source_map.question_id = m.question_id
  left join public.topik_writing_problem_aliases alias
    on alias.problem_id = md5(m.question_id)::uuid
  order by m.question_id;`;
}

function aliasValues(rows) {
  if (!rows.length) return null;
  return rows.map((row) => `(${sqlLiteral(row.problemId)}::uuid, ${sqlLiteral(row.questionId)}, ${sqlLiteral(row.aliasKind)}, ${sqlLiteral(row.source)}, ${sqlLiteral(row.backfillBatch)}, ${sqlLiteral(row.mappingStatus)}, ${sqlLiteral(row.holdReason)}, ${sqlLiteral(row.matchHash)})`).join(',\n      ');
}

function sourceMapValues(rows) {
  if (!rows.length) return null;
  return rows.map((row) => `(${sqlLiteral(row.questionId)}, ${row.itemNumber}::smallint, ${sqlLiteral(row.backfillBatch)})`).join(',\n      ');
}

function snapshotGuards(snapshot) {
  return snapshot.map((expected) => {
    const table = SNAPSHOT_TABLES.find((item) => item.name === expected.table_name);
    if (!table) throw new Error(`unknown snapshot table: ${expected.table_name}`);
    return `if ${signatureExpression(table)} <> ${sqlLiteral(JSON.stringify({ rows: Number(expected.rows), hash: expected.hash }))}::jsonb then
      raise exception 'reconciliation baseline drift: ${table.name}';
    end if;`;
  }).join('\n    ');
}

export function buildApplySql(manifest) {
  if (manifest.holds.length) throw new Error(`cannot apply with ${manifest.holds.length} hold(s)`);
  const values = aliasValues(manifest.desiredAliases);
  const anchorValues = sourceMapValues(manifest.sourceMapAnchors);
  return `begin;
select pg_advisory_xact_lock(hashtext(${sqlLiteral(RECONCILIATION_LOCK_KEY)}));
do $guard$
begin
    ${snapshotGuards(manifest.snapshot)}
end
$guard$;
${anchorValues ? `insert into public.topik_writing_question_source_map
  (question_id, item_number, backfill_batch)
values
      ${anchorValues}
on conflict (question_id) do nothing;` : '-- all metadata questions already have source-map anchors'}
${values ? `insert into public.topik_writing_problem_aliases
  (problem_id, question_id, alias_kind, source, backfill_batch, mapping_status, hold_reason, match_hash)
values
      ${values}
on conflict (problem_id) do update set
  question_id = excluded.question_id,
  alias_kind = excluded.alias_kind,
  source = excluded.source,
  backfill_batch = excluded.backfill_batch,
  mapping_status = excluded.mapping_status,
  hold_reason = excluded.hold_reason,
  match_hash = excluded.match_hash,
  updated_at = now()
where (topik_writing_problem_aliases.question_id,
       topik_writing_problem_aliases.alias_kind,
       topik_writing_problem_aliases.source,
       topik_writing_problem_aliases.backfill_batch,
       topik_writing_problem_aliases.mapping_status,
       topik_writing_problem_aliases.hold_reason,
       topik_writing_problem_aliases.match_hash)
  is distinct from
      (excluded.question_id, excluded.alias_kind, excluded.source, excluded.backfill_batch,
       excluded.mapping_status, excluded.hold_reason, excluded.match_hash);` : '-- canonical mappings only: no alias DML required'}
do $post$
begin
  if exists (
    select problem_id from public.topik_writing_problem_question_map
    group by problem_id having count(distinct question_id) > 1
  ) then
    raise exception 'problem_id fan-out detected after reconciliation';
  end if;
end
$post$;
commit;`;
}

export function buildRestoreSql({ beforeAliases, appliedAliases, createdSourceMapAnchors = [] }) {
  const targetIds = appliedAliases.map((row) => `${sqlLiteral(row.problemId)}::uuid`).join(', ');
  const beforeValues = aliasValues(beforeAliases);
  const expectedValues = aliasValues(appliedAliases);
  if (!targetIds) throw new Error('restore payload has no alias targets');
  return `begin;
select pg_advisory_xact_lock(hashtext(${sqlLiteral(RECONCILIATION_LOCK_KEY)}));
create temporary table expected_learning_aliases (
  problem_id uuid primary key, question_id text, alias_kind text, source text, backfill_batch text,
  mapping_status text, hold_reason text, match_hash text
) on commit drop;
insert into expected_learning_aliases values
      ${expectedValues};
do $guard$
begin
  if exists (
    (select problem_id, question_id, alias_kind, source, backfill_batch, mapping_status, hold_reason, match_hash
       from public.topik_writing_problem_aliases where problem_id in (${targetIds})
     except select * from expected_learning_aliases)
    union all
    (select * from expected_learning_aliases
     except select problem_id, question_id, alias_kind, source, backfill_batch, mapping_status, hold_reason, match_hash
       from public.topik_writing_problem_aliases where problem_id in (${targetIds}))
  ) then
    raise exception 'restore current alias drift';
  end if;
end
$guard$;
delete from public.topik_writing_problem_aliases where problem_id in (${targetIds});
${beforeValues ? `insert into public.topik_writing_problem_aliases
  (problem_id, question_id, alias_kind, source, backfill_batch, mapping_status, hold_reason, match_hash)
values
      ${beforeValues};` : '-- before image was empty'}
${createdSourceMapAnchors.length ? `delete from public.topik_writing_question_source_map sm
where (sm.question_id, sm.item_number, sm.backfill_batch) in (
      ${sourceMapValues(createdSourceMapAnchors)}
)
  and sm.legacy_problem_id is null
  and sm.published_task_id is null
  and sm.hold_reason is null
  and not exists (
    select 1 from public.topik_writing_problem_aliases alias
    where alias.question_id = sm.question_id
  );` : '-- no source-map anchors were created by this reconciliation'}
commit;`;
}
