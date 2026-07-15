#!/usr/bin/env node
// 학습 분석에 실제로 참조되는 제출/이벤트 problem_id의 metadata 연결을 차단식으로 검사한다.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { REPO_ROOT } from './etl/lib/env.mjs';

export function evaluateLearningAnalyticsCoverage(metrics) {
  const failures = [];
  const metricNames = [
    'eligibleSubmissions',
    'mappedSubmissions',
    'eligibleEvents',
    'mappedEvents',
    'eligibleProblems',
    'mappedProblems',
    'fanoutProblems',
    'orphanAliases',
    'heldReferencedProblems',
    'missingRequiredMetadata',
  ];
  const validContract = metrics != null
    && typeof metrics === 'object'
    && metricNames.every((name) => Number.isInteger(metrics[name]) && metrics[name] >= 0)
    && metrics.mappedSubmissions <= metrics.eligibleSubmissions
    && metrics.mappedEvents <= metrics.eligibleEvents
    && metrics.mappedProblems <= metrics.eligibleProblems;
  if (!validContract) return { ok: false, failures: ['invalid_metrics_contract'] };
  if (metrics.eligibleSubmissions > 0 && metrics.mappedSubmissions !== metrics.eligibleSubmissions) {
    failures.push('submission_metadata_coverage_below_100');
  }
  if (metrics.eligibleEvents > 0 && metrics.mappedEvents !== metrics.eligibleEvents) {
    failures.push('event_metadata_coverage_below_100');
  }
  if (metrics.eligibleProblems > 0 && metrics.mappedProblems !== metrics.eligibleProblems) {
    failures.push('problem_metadata_coverage_below_100');
  }
  if (metrics.fanoutProblems > 0) failures.push('problem_id_fanout');
  if (metrics.orphanAliases > 0) failures.push('orphan_alias');
  if (metrics.heldReferencedProblems > 0) failures.push('referenced_mapping_held');
  if (metrics.missingRequiredMetadata > 0) failures.push('required_metadata_missing');
  return { ok: failures.length === 0, failures };
}

const coverageSql = `with complete_metadata as (
  select question_id, 51::smallint item_number,
    (topic_main is not null and topic_detail is not null
     and blank_1_role is not null and blank_1_function is not null
     and blank_1_answer_type is not null and blank_2_role is not null
     and blank_2_function is not null and blank_2_answer_type is not null) complete
  from public.topik_writing_51_questions
  union all
  select question_id, 52::smallint,
    (topic_main is not null and topic_detail is not null
     and connection_function is not null and answer_scope_type is not null)
  from public.topik_writing_52_questions
  union all
  select question_id, 53::smallint,
    (topic_main is not null and topic_detail is not null
     and data_type is not null and required_structure is not null)
  from public.topik_writing_53_questions
  union all
  select question_id, 54::smallint,
    (topic_main is not null and topic_detail is not null
     and essay_type is not null and stance_requirement is not null
     and required_structure is not null)
  from public.topik_writing_54_questions
), resolved as (
  select distinct on (pm.problem_id)
    pm.problem_id, pm.question_id, pm.item_number, pm.mapping_status, pm.hold_reason
  from public.topik_writing_problem_question_map pm
  order by pm.problem_id,
    case when pm.mapping_kind = 'legacy' then 0 else 1 end,
    pm.question_id
), usable as (
  select r.problem_id, r.question_id, r.item_number
  from resolved r
  join complete_metadata m on m.question_id = r.question_id
    and m.item_number = r.item_number and m.complete
  where r.mapping_status = 'active' and r.hold_reason is null
), submission_facts as (
  select ws.problem_id, p.question_no, (u.problem_id is not null and u.item_number = p.question_no) mapped
  from public.writing_submissions ws
  join public.problems p on p.id = ws.problem_id
  left join usable u on u.problem_id = ws.problem_id
  where p.question_no between 51 and 54
), event_facts as (
  select coalesce(se.problem_id, ws.problem_id) problem_id, p.question_no,
    (u.problem_id is not null and u.item_number = p.question_no) mapped
  from public.study_events se
  left join public.writing_submissions ws on ws.id = se.submission_id
  join public.problems p on p.id = coalesce(se.problem_id, ws.problem_id)
  left join usable u on u.problem_id = p.id
  where se.event_type <> 'export_downloaded' and p.question_no between 51 and 54
), referenced as (
  select problem_id from submission_facts union select problem_id from event_facts
)
select jsonb_build_object(
  'eligibleSubmissions', (select count(*) from submission_facts),
  'mappedSubmissions', (select count(*) from submission_facts where mapped),
  'eligibleEvents', (select count(*) from event_facts),
  'mappedEvents', (select count(*) from event_facts where mapped),
  'eligibleProblems', (select count(*) from referenced),
  'mappedProblems', (select count(*) from referenced r join usable u using(problem_id)),
  'fanoutProblems', (select count(*) from (
    select problem_id from public.topik_writing_problem_question_map
    group by problem_id having count(distinct question_id) > 1
  ) fanout),
  'orphanAliases', (select count(*) from public.topik_writing_problem_aliases a
    left join public.problems p on p.id = a.problem_id where p.id is null),
  'heldReferencedProblems', (select count(*) from referenced r
    join resolved m using(problem_id)
    where m.mapping_status <> 'active' or m.hold_reason is not null),
  'missingRequiredMetadata', (select count(*) from referenced r
    left join usable u using(problem_id) where u.problem_id is null)
) metrics;`;

async function main() {
  const args = process.argv.slice(2);
  const valueOf = (name, fallback = null) => {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : fallback;
  };
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  const projectRef = valueOf('--project-ref', process.env.SUPABASE_PROJECT_REF);
  const expectedProjectRef = valueOf('--expected-project-ref', process.env.EXPECTED_SUPABASE_PROJECT_REF);
  if (!token) throw new Error('SUPABASE_ACCESS_TOKEN is required');
  if (!projectRef || !expectedProjectRef) {
    throw new Error('--project-ref and --expected-project-ref are required (or set SUPABASE_PROJECT_REF and EXPECTED_SUPABASE_PROJECT_REF)');
  }
  if (projectRef !== expectedProjectRef) {
    throw new Error(`project ref mismatch: requested ${projectRef}, expected ${expectedProjectRef}`);
  }
  const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: coverageSql }),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`coverage query failed (${response.status}): ${text}`);
  const rows = JSON.parse(text);
  const metrics = rows[0]?.metrics;
  if (!metrics) throw new Error('coverage query returned no metrics');
  const verdict = evaluateLearningAnalyticsCoverage(metrics);
  const output = valueOf('--out')
    ? valueOf('--out')
    : join(REPO_ROOT, '.omx', 'evidence', 'analytics-learning', 'predeploy-coverage.json');
  const report = {
    checkedAt: new Date().toISOString(),
    projectRef,
    metrics,
    ...verdict,
  };
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report));
  process.exitCode = verdict.ok ? 0 : 1;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
