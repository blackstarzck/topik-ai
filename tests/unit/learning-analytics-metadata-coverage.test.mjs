import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { evaluateLearningAnalyticsCoverage } from '../../scripts/check-learning-analytics-metadata-coverage.mjs';

const migration = readFileSync(
  new URL(
    '../../supabase/migrations-admin/20260713120000_admin_learning_analytics_metadata_coverage.sql',
    import.meta.url
  ),
  'utf8'
);
const restoreMigrationUrl = new URL(
  '../../supabase/migrations-admin/20260715173826_restore_learning_analytics_metadata_contract.sql',
  import.meta.url
);
const restoreMigration = readFileSync(restoreMigrationUrl, 'utf8');
const topicStatsMigration = readFileSync(
  new URL(
    '../../supabase/migrations-admin/20260715130000_admin_learning_analytics_topic_stats_by_question.sql',
    import.meta.url
  ),
  'utf8'
);
const topicStatsDownMigration = readFileSync(
  new URL(
    '../../supabase/migrations-admin/down/20260715130000_admin_learning_analytics_topic_stats_by_question.sql',
    import.meta.url
  ),
  'utf8'
);
const restoreDownMigration = readFileSync(
  new URL(
    '../../supabase/migrations-admin/down/20260715173826_restore_learning_analytics_metadata_contract.sql',
    import.meta.url
  ),
  'utf8'
);
const pdfTopicMigration = readFileSync(
  new URL(
    '../../supabase/migrations-admin/20260715190000_admin_learning_analytics_pdf_topics.sql',
    import.meta.url
  ),
  'utf8'
);
const pdfTopicDownMigration = readFileSync(
  new URL(
    '../../supabase/migrations-admin/down/20260715190000_admin_learning_analytics_pdf_topics.sql',
    import.meta.url
  ),
  'utf8'
);
const adminMigrationsUrl = new URL('../../supabase/migrations-admin/', import.meta.url);

function readDollarBlock(sql, tag) {
  const delimiter = `$${tag}$`;
  const start = sql.indexOf(delimiter);
  if (start < 0) throw new Error(`missing SQL block: ${tag}`);
  const contentStart = start + delimiter.length;
  const end = sql.indexOf(delimiter, contentStart);
  if (end < 0) throw new Error(`unterminated SQL block: ${tag}`);
  return sql.slice(contentStart, end);
}

const completeMetrics = {
  eligibleSubmissions: 280,
  mappedSubmissions: 280,
  eligibleEvents: 3333,
  mappedEvents: 3333,
  eligibleProblems: 58,
  mappedProblems: 58,
  fanoutProblems: 0,
  orphanAliases: 0,
  heldReferencedProblems: 0,
  missingRequiredMetadata: 0
};

describe('learning analytics metadata coverage gate', () => {
  it('passes only when every referenced submission, event, and problem is mapped', () => {
    expect(evaluateLearningAnalyticsCoverage(completeMetrics)).toEqual({
      ok: true,
      failures: []
    });
  });

  it.each([
    ['submission_metadata_coverage_below_100', { mappedSubmissions: 279 }],
    ['event_metadata_coverage_below_100', { mappedEvents: 3332 }],
    ['problem_metadata_coverage_below_100', { mappedProblems: 57 }],
    ['problem_id_fanout', { fanoutProblems: 1 }],
    ['orphan_alias', { orphanAliases: 1 }],
    ['referenced_mapping_held', { heldReferencedProblems: 1 }],
    ['required_metadata_missing', { missingRequiredMetadata: 1 }]
  ])('fails closed for %s', (failure, override) => {
    expect(
      evaluateLearningAnalyticsCoverage({ ...completeMetrics, ...override })
    ).toEqual({ ok: false, failures: [failure] });
  });

  it('does not manufacture a failure when the eligible set is empty', () => {
    expect(
      evaluateLearningAnalyticsCoverage({
        ...completeMetrics,
        eligibleSubmissions: 0,
        mappedSubmissions: 0,
        eligibleEvents: 0,
        mappedEvents: 0,
        eligibleProblems: 0,
        mappedProblems: 0
      })
    ).toEqual({ ok: true, failures: [] });
  });

  it.each([
    ['missing object', undefined],
    ['missing fields', {}],
    ['negative count', { ...completeMetrics, eligibleSubmissions: -1 }],
    ['fractional count', { ...completeMetrics, mappedEvents: 1.5 }],
    ['mapped submissions overflow', { ...completeMetrics, mappedSubmissions: 281 }],
    ['mapped events with empty eligible set', {
      ...completeMetrics,
      eligibleEvents: 0,
      mappedEvents: 1
    }]
  ])('fails closed for an invalid metrics contract: %s', (_label, metrics) => {
    expect(evaluateLearningAnalyticsCoverage(metrics)).toEqual({
      ok: false,
      failures: ['invalid_metrics_contract']
    });
  });
});

describe('학습 분석 RPC metadata completeness 계약', () => {
  it('원천 문항 번호 일치와 번호별 필수 메타데이터가 모두 있어야 mapped로 분류한다', () => {
    expect(migration).toContain('mapped_problem.question_no = pm.item_number');
    expect(migration).toContain('v.topic_main is not null');
    expect(migration).toContain('v.topic_detail is not null');
    for (const column of [
      'q51.blank_1_role',
      'q51.blank_2_answer_type',
      'q52.connection_function',
      'q52.answer_scope_type',
      'q53.data_type',
      'q53.required_structure',
      'q54.essay_type',
      'q54.stance_requirement',
      'q54.required_structure'
    ]) {
      expect(migration).toContain(`${column} is not null`);
    }
  });

  it('기본 문항 통계는 매핑 메타데이터가 아니라 problems.question_no를 사용한다', () => {
    expect(migration).toContain('problem.question_no as question_no');
    expect(migration).toContain('where problem.question_no = any(v_question_nos)');
    expect(migration).not.toContain('coalesce(m.item_number, problem.question_no)');
  });
});

describe('학습 분석 RPC metadata 계약 회귀 복구', () => {
  it('문항별 주제 통계 up/down은 직전 함수에서 해당 블록만 바꾸고 metadata 계약을 보존한다', () => {
    for (const sql of [topicStatsMigration, topicStatsDownMigration]) {
      expect(sql).toContain('pg_get_functiondef(v_identity)');
      expect(sql).toContain('submission_metadata_facts as');
      expect(sql).toContain('event_metadata_coverage as');
      expect(sql).toContain("'metadataEligibleSubmissions'");
      expect(sql).toContain('execute v_definition');
      expect(sql).not.toContain('20260710120000');
    }

    expect(topicStatsMigration).toContain(
      "position('topic_total' in v_definition) = 0"
    );
    expect(topicStatsMigration).toContain(
      "position('''questionNo'', t.question_no' in v_definition) = 0"
    );
    expect(topicStatsDownMigration).toContain(
      "position('topic_total' in v_definition) > 0"
    );
    expect(topicStatsDownMigration).toContain(
      "position('''questionNo'', t.question_no' in v_definition) > 0"
    );
  });

  it('문항별 주제 통계 up 후 down은 20260713120000 함수 정의를 정확히 복원한다', () => {
    const previousTopics = readDollarBlock(topicStatsMigration, 'old_topics');
    const perQuestionTopics = readDollarBlock(topicStatsMigration, 'new_topics');
    const previousJson = readDollarBlock(topicStatsMigration, 'old_json');
    const perQuestionJson = readDollarBlock(topicStatsMigration, 'new_json');

    expect(migration).toContain(previousTopics);
    expect(migration).toContain(previousJson);

    const migrated = migration
      .replace(previousTopics, perQuestionTopics)
      .replace(previousJson, perQuestionJson);

    expect(migrated).toContain('metadataEligibleSubmissions');
    expect(migrated).toContain('event_metadata_coverage as');
    expect(migrated).toContain('topic_total');
    expect(migrated).toContain("'questionNo', t.question_no");

    const rolledBack = migrated
      .replace(
        readDollarBlock(topicStatsDownMigration, 'current_topics'),
        readDollarBlock(topicStatsDownMigration, 'previous_topics')
      )
      .replace(
        readDollarBlock(topicStatsDownMigration, 'current_json'),
        readDollarBlock(topicStatsDownMigration, 'previous_json')
      );

    expect(rolledBack).toBe(migration);
  });

  it('가장 최근 RPC 교체가 metadata coverage와 문항별 주제 통계를 함께 유지한다', () => {
    const rpcMigrations = readdirSync(adminMigrationsUrl)
      .filter((name) => name.endsWith('.sql'))
      .map((name) => ({
        name,
        sql: readFileSync(new URL(name, adminMigrationsUrl), 'utf8')
      }))
      .filter(({ sql }) =>
        sql.includes('function public.get_admin_learning_analytics_filtered(')
      )
      .sort((left, right) => left.name.localeCompare(right.name));
    const latestRpcMigration = rpcMigrations.at(-1);

    expect(latestRpcMigration?.name).toBe(
      '20260715190000_admin_learning_analytics_pdf_topics.sql'
    );
    expect(restoreMigration).toContain("'metadataEligibleSubmissions'");
    expect(restoreMigration).toContain("'metadataEligibleEvents'");
    expect(restoreMigration).toContain("'questionNo', t.question_no");
    expect(latestRpcMigration?.sql).toContain('pg_get_functiondef(v_identity)');
    expect(latestRpcMigration?.sql).toContain('submission_metadata_facts as');
    expect(latestRpcMigration?.sql).toContain('event_metadata_coverage as');
    expect(latestRpcMigration?.sql).toContain('topic_total');
    expect(latestRpcMigration?.sql).toContain('pdf_per_topic as');
    expect(latestRpcMigration?.sql).toContain("'perTopic'");
    expect(latestRpcMigration?.sql).toContain('execute v_definition');
  });

  it('canonical identity 전환이 있으면 private projection으로만 다시 쓴다', () => {
    expect(restoreMigration).toContain(
      "to_regclass(\n    'private.admin_writing_question_identity_map'"
    );
    expect(restoreMigration).toContain(
      "to_regclass(\n    'private.admin_writing_problem_identity_projection'"
    );
    expect(restoreMigration).toContain(
      'if v_has_identity_map <> v_has_identity_projection then'
    );
    expect(restoreMigration).toContain(
      "'from private.admin_writing_question_identity_map pm'"
    );
    expect(restoreMigration).toContain(
      "'private.admin_writing_problem_identity_projection problem'"
    );
    expect(restoreMigration).toContain(
      "replace(v_definition, 'problem.id', 'problem.problem_id')"
    );
  });

  it('학습 제출·이벤트·문항 원본에는 쓰기 작업을 하지 않는다', () => {
    expect(`${restoreMigration}\n${pdfTopicMigration}`).not.toMatch(
      /\b(?:insert\s+into|update|delete\s+from|truncate)\s+public\.(?:writing_submissions|student_events|problems)\b/i
    );
  });

  it('PDF 주제 집계는 직접 귀속 이벤트만 문제 유형·주제별로 묶고 많은 순으로 반환한다', () => {
    expect(pdfTopicMigration).toContain("p.attribution = 'attributable'");
    expect(pdfTopicMigration).toContain('and p.matches_scope');
    expect(pdfTopicMigration).toContain(
      'group by p.item_number, p.topic_main, p.topic_detail'
    );
    expect(pdfTopicMigration).toContain(
      'order by p.count desc, p.question_no, p.topic_main nulls last, p.topic_detail nulls last'
    );
    expect(pdfTopicMigration).toContain("'topicMain', p.topic_main");
    expect(pdfTopicMigration).toContain("'topicDetail', p.topic_detail");
  });

  it('PDF 주제 집계 down은 신규 projection·CTE·응답 필드를 제거한다', () => {
    expect(pdfTopicDownMigration).toContain("position('''perTopic''' in v_definition) > 0");
    expect(pdfTopicDownMigration).toContain(
      "position('pdf_per_topic as' in v_definition) > 0"
    );
    expect(pdfTopicDownMigration).toContain(
      "'      end as attribution,'"
    );
    expect(pdfTopicDownMigration).toContain(
      "'  pdf_per_question as ('"
    );
  });

  it('PUBLIC과 anon 실행 권한을 차단하고 authenticated만 허용한다', () => {
    expect(restoreMigration).toContain(
      ') from public;\nrevoke all on function public.get_admin_learning_analytics_filtered('
    );
    expect(restoreMigration).toContain(
      ') from anon;\ngrant execute on function public.get_admin_learning_analytics_filtered('
    );
  });

  it('restore down은 metadata coverage와 문제별 주제 통계를 유지한 채 public identity로 되돌린다', () => {
    expect(restoreDownMigration).toContain('questionNo');
    expect(restoreDownMigration).toContain('topic_total');
    expect(restoreDownMigration).toContain('metadataEligibleSubmissions');
    expect(restoreDownMigration).toContain('submission_metadata_facts as');
    expect(restoreDownMigration).toContain(
      "'from public.topik_writing_problem_question_map pm'"
    );
    expect(restoreDownMigration).toContain(
      "replace(v_definition, 'problem.problem_id', 'problem.id')"
    );
  });
});
