import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { evaluateLearningAnalyticsCoverage } from '../../scripts/check-learning-analytics-metadata-coverage.mjs';

const migration = readFileSync(
  new URL(
    '../../supabase/migrations-admin/20260713120000_admin_learning_analytics_metadata_coverage.sql',
    import.meta.url
  ),
  'utf8'
);

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
